#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer as root: sudo bash bootstrap.sh" >&2
  exit 1
fi

if ! grep -qE '^VERSION_ID="?24\.04"?$' /etc/os-release; then
  echo "This installer is tested on Ubuntu 24.04 LTS." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

dpkg --add-architecture i386
apt-get update
apt-get install -y \
  curl wget ca-certificates tar gzip bzip2 xz-utils unzip file jq bc binutils \
  tmux cron nano ufw fail2ban unattended-upgrades software-properties-common \
  lib32gcc-s1 lib32stdc++6 libsdl2-2.0-0:i386 libtinfo6:i386 libncurses6:i386

if [[ ! -f /swapfile ]]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

cat >/etc/sysctl.d/99-coldstream-games.conf <<'EOF'
vm.swappiness=10
net.core.rmem_max=26214400
net.core.wmem_max=26214400
net.core.netdev_max_backlog=5000
EOF
sysctl --system >/dev/null

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 27015/tcp comment 'Garrys Mod'
ufw allow 27015/udp comment 'Garrys Mod'
ufw allow 27016/tcp comment 'Counter-Strike Source'
ufw allow 27016/udp comment 'Counter-Strike Source'
ufw allow 27017/tcp comment 'Counter-Strike 1.6'
ufw allow 27017/udp comment 'Counter-Strike 1.6'
ufw --force enable

systemctl enable --now cron fail2ban unattended-upgrades

install_linuxgsm() {
  local account=$1
  local script=$2

  if ! id "$account" >/dev/null 2>&1; then
    adduser --disabled-password --gecos '' "$account"
  fi

  if [[ ! -x "/home/$account/$script" ]]; then
    runuser -u "$account" -- bash -lc \
      "curl -Lo linuxgsm.sh https://linuxgsm.sh && chmod +x linuxgsm.sh && bash linuxgsm.sh $script"
  fi

  runuser -u "$account" -- bash -lc "./$script auto-install"
}

install_linuxgsm gmodserver gmodserver
install_linuxgsm cssserver cssserver
install_linuxgsm hldsserver hldsserver

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

install -o gmodserver -g gmodserver -m 0640 "$SCRIPT_DIR/configs/gmodserver.cfg" \
  /home/gmodserver/lgsm/config-lgsm/gmodserver/gmodserver.cfg
install -o cssserver -g cssserver -m 0640 "$SCRIPT_DIR/configs/cssserver.cfg" \
  /home/cssserver/lgsm/config-lgsm/cssserver/cssserver.cfg
install -o hldsserver -g hldsserver -m 0640 "$SCRIPT_DIR/configs/hldsserver.cfg" \
  /home/hldsserver/lgsm/config-lgsm/hldsserver/hldsserver.cfg

install -o gmodserver -g gmodserver -m 0640 "$SCRIPT_DIR/server-cfg/gmod-server.cfg" \
  /home/gmodserver/serverfiles/garrysmod/cfg/server.cfg
install -o cssserver -g cssserver -m 0640 "$SCRIPT_DIR/server-cfg/css-server.cfg" \
  /home/cssserver/serverfiles/cstrike/cfg/server.cfg
install -o hldsserver -g hldsserver -m 0640 "$SCRIPT_DIR/server-cfg/hlds-server.cfg" \
  /home/hldsserver/serverfiles/cstrike/server.cfg

install -m 0644 "$SCRIPT_DIR/systemd/coldstream-game-server@.service" \
  /etc/systemd/system/coldstream-game-server@.service
systemctl daemon-reload
systemctl enable --now \
  coldstream-game-server@gmodserver \
  coldstream-game-server@cssserver \
  coldstream-game-server@hldsserver

cat >/etc/cron.d/coldstream-game-servers <<'EOF'
*/5 * * * * gmodserver /home/gmodserver/gmodserver monitor >/dev/null 2>&1
*/5 * * * * cssserver /home/cssserver/cssserver monitor >/dev/null 2>&1
*/5 * * * * hldsserver /home/hldsserver/hldsserver monitor >/dev/null 2>&1
17 5 * * * gmodserver /home/gmodserver/gmodserver update >/dev/null 2>&1
27 5 * * * cssserver /home/cssserver/cssserver update >/dev/null 2>&1
37 5 * * * hldsserver /home/hldsserver/hldsserver update >/dev/null 2>&1
15 6 * * 1 gmodserver /home/gmodserver/gmodserver backup >/dev/null 2>&1
25 6 * * 1 cssserver /home/cssserver/cssserver backup >/dev/null 2>&1
35 6 * * 1 hldsserver /home/hldsserver/hldsserver backup >/dev/null 2>&1
EOF
chmod 0644 /etc/cron.d/coldstream-game-servers

echo
echo 'Coldstream Gaming servers are installed and started.'
echo 'Set private RCON passwords and Source GSLTs before opening to players.'
