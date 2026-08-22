#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer as root: sudo bash install-pterodactyl.sh" >&2
  exit 1
fi

if ! grep -qE '^VERSION_ID="?24\.04"?$' /etc/os-release; then
  echo "This installer is tested on Ubuntu 24.04 LTS." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
PANEL_HOST="panel.coldstreamgaming.com"
NODE_HOST="node.coldstreamgaming.com"
CREDENTIAL_FILE="/root/pterodactyl-install-secrets.txt"
DB_PASSWORD=$(openssl rand -hex 24)
ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

apt-get update
apt-get install -y \
  ca-certificates curl gnupg lsb-release nginx mariadb-server redis-server \
  php8.3 php8.3-common php8.3-cli php8.3-gd php8.3-mysql php8.3-mbstring \
  php8.3-bcmath php8.3-xml php8.3-fpm php8.3-curl php8.3-zip \
  tar unzip git certbot python3-certbot-nginx

curl -fsSL https://get.docker.com/ | CHANNEL=stable bash
systemctl enable --now docker mariadb redis-server nginx php8.3-fpm

curl -sS https://getcomposer.org/installer | php -- \
  --install-dir=/usr/local/bin --filename=composer

mariadb <<SQL
CREATE DATABASE IF NOT EXISTS panel;
CREATE USER IF NOT EXISTS 'pterodactyl'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER 'pterodactyl'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON panel.* TO 'pterodactyl'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

install -d -m 0755 /var/www/pterodactyl
cd /var/www/pterodactyl
curl -Lo panel.tar.gz \
  https://github.com/pterodactyl/panel/releases/latest/download/panel.tar.gz
tar -xzf panel.tar.gz
chmod -R 0755 storage bootstrap/cache
cp -n .env.example .env
COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader
php artisan key:generate --force

sed -i \
  -e "s|^APP_URL=.*|APP_URL=http://${PANEL_HOST}|" \
  -e 's|^APP_TIMEZONE=.*|APP_TIMEZONE=America/Chicago|' \
  -e 's|^APP_ENV=.*|APP_ENV=production|' \
  -e 's|^APP_DEBUG=.*|APP_DEBUG=false|' \
  -e 's|^APP_SERVICE_AUTHOR=.*|APP_SERVICE_AUTHOR=admin@coldstreamgaming.com|' \
  -e 's|^CACHE_DRIVER=.*|CACHE_DRIVER=redis|' \
  -e 's|^CACHE_STORE=.*|CACHE_STORE=redis|' \
  -e 's|^SESSION_DRIVER=.*|SESSION_DRIVER=redis|' \
  -e 's|^QUEUE_CONNECTION=.*|QUEUE_CONNECTION=redis|' \
  -e 's|^MAIL_MAILER=.*|MAIL_MAILER=log|' \
  -e 's|^DB_HOST=.*|DB_HOST=127.0.0.1|' \
  -e 's|^DB_PORT=.*|DB_PORT=3306|' \
  -e 's|^DB_DATABASE=.*|DB_DATABASE=panel|' \
  -e 's|^DB_USERNAME=.*|DB_USERNAME=pterodactyl|' \
  -e "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|" \
  .env

php artisan migrate --seed --force
php artisan p:user:make \
  --email=admin@coldstreamgaming.com \
  --username=river \
  --name-first=River \
  --name-last=Coldstream \
  --password="${ADMIN_PASSWORD}" \
  --admin=1
chown -R www-data:www-data /var/www/pterodactyl

cat >/etc/systemd/system/pteroq.service <<'EOF'
[Unit]
Description=Pterodactyl Queue Worker
After=redis-server.service

[Service]
User=www-data
Group=www-data
Restart=always
ExecStart=/usr/bin/php /var/www/pterodactyl/artisan queue:work --queue=high,standard,low --sleep=3 --tries=3
StartLimitIntervalSec=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/cron.d/pterodactyl <<'EOF'
* * * * * www-data php /var/www/pterodactyl/artisan schedule:run >/dev/null 2>&1
EOF
chmod 0644 /etc/cron.d/pterodactyl

cat >/etc/nginx/sites-available/pterodactyl.conf <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${PANEL_HOST};
    root /var/www/pterodactyl/public;
    index index.php;
    client_max_body_size 100m;
    sendfile off;

    access_log /var/log/nginx/pterodactyl.app-access.log;
    error_log /var/log/nginx/pterodactyl.app-error.log error;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        fastcgi_split_path_info ^(.+\.php)(/.+)\$;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param PHP_VALUE "upload_max_filesize = 100M \n post_max_size=100M";
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_param HTTP_PROXY "";
        fastcgi_intercept_errors off;
        fastcgi_buffer_size 16k;
        fastcgi_buffers 4 16k;
        fastcgi_connect_timeout 300;
        fastcgi_send_timeout 300;
        fastcgi_read_timeout 300;
    }

    location ~ /\.ht {
        deny all;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/pterodactyl.conf \
  /etc/nginx/sites-enabled/pterodactyl.conf
nginx -t

install -d -m 0755 /etc/pterodactyl
curl -L -o /usr/local/bin/wings \
  https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_amd64
chmod 0755 /usr/local/bin/wings

cat >/etc/systemd/system/wings.service <<'EOF'
[Unit]
Description=Pterodactyl Wings Daemon
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
User=root
WorkingDirectory=/etc/pterodactyl
LimitNOFILE=4096
PIDFile=/var/run/wings/daemon.pid
ExecStart=/usr/local/bin/wings
Restart=on-failure
StartLimitIntervalSec=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now pteroq
systemctl restart nginx

ufw allow 80/tcp comment 'Pterodactyl panel HTTP'
ufw allow 443/tcp comment 'Pterodactyl panel HTTPS'
ufw allow 2022/tcp comment 'Pterodactyl SFTP'
ufw allow 8080/tcp comment 'Pterodactyl Wings'

cat >"${CREDENTIAL_FILE}" <<EOF
Pterodactyl administrator
URL: http://${PANEL_HOST}
Username: river
Email: admin@coldstreamgaming.com
Temporary password: ${ADMIN_PASSWORD}

Database password: ${DB_PASSWORD}
Application encryption key:
$(grep '^APP_KEY=' /var/www/pterodactyl/.env)

Node host: ${NODE_HOST}
EOF
chmod 0600 "${CREDENTIAL_FILE}"

echo
echo "Pterodactyl Panel and Wings prerequisites are installed."
echo "Private installation secrets: ${CREDENTIAL_FILE}"
echo "Add DNS for ${PANEL_HOST} and ${NODE_HOST}, then configure TLS and the node."
