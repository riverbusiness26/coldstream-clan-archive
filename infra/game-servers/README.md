# Coldstream Gaming server host

This directory builds the Coldstream Gaming OVH VPS as a Pterodactyl game
server host. Pterodactyl runs each game server in an isolated Docker container
and provides River with a web administration panel.

| Server | Port | Initial mode |
|---|---:|---|
| Garry's Mod | 27015 | Trouble in Terrorist Town |
| Counter-Strike: Source | 27016 | Classic rotation |
| Counter-Strike 1.6 | 27017 | Classic rotation |

The official Panel, Wings, Docker Engine, MariaDB, Redis and NGINX make up the
management stack. Docker isolation prevents one game process from directly
sharing another server's filesystem.

## Host assumptions

- OVH VPS-3
- Ubuntu 24.04 LTS
- 6 vCores and 12 GB RAM
- A fresh host with root SSH access

Ubuntu 26.04 should not be used yet. It is not an LTS release available for
production deployment at the time this plan was written, and game server
dependencies are safer on Ubuntu 24.04 LTS.

## Installation

Copy this directory to the VPS, then run as root:

```bash
sudo bash install-pterodactyl.sh
```

The panel will live at `panel.coldstreamgaming.com`. Wings uses
`node.coldstreamgaming.com`. Both names point to the VPS, but their Cloudflare
records must remain DNS-only because Cloudflare's ordinary proxy does not carry
the game and Wings traffic used here.

## Daily operation

Sign in to the panel as `river`. The initial administrator password is generated
on the VPS and stored in `/root/pterodactyl-install-secrets.txt` with root-only
permissions. Change it immediately after the first login and save the panel's
`APP_KEY` in an encrypted password manager. The application key is required to
restore encrypted panel data from backups.

## Resource plan

The first allocation intentionally leaves headroom for Ubuntu, Steam updates,
and traffic spikes:

| Service | Expected memory |
|---|---:|
| Garry's Mod TTT | 3 to 4 GB |
| Counter-Strike: Source | 1.5 to 2 GB |
| Counter-Strike 1.6 | 0.5 to 1 GB |
| Host and monitoring | 1.5 to 2 GB |

The remaining memory is deliberate safety margin for map changes, addon load,
Steam updates, backups, and short traffic spikes.

## Backups

Pterodactyl creates per-server backups through Wings. OVH automated backup
protects the whole VPS, but it should not be the only copy. The next
infrastructure step is encrypted offsite storage for panel data, database
backups, server configs, maps, addons, and player data.

## Legacy installer

`bootstrap.sh` and the LinuxGSM templates are retained only as a record of the
original deployment path. River selected Pterodactyl before any game files were
installed. Do not run both management systems on the same host.
