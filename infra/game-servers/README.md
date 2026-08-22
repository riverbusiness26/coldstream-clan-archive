# Coldstream Gaming server host

This directory builds the Coldstream Gaming OVH VPS as a dedicated Linux game
server host. It installs and separates three servers:

| Server | LinuxGSM name | Port | Initial mode |
|---|---|---:|---|
| Garry's Mod | `gmodserver` | 27015 | Trouble in Terrorist Town |
| Counter-Strike: Source | `cssserver` | 27016 | Classic rotation |
| Counter-Strike 1.6 | `hldsserver` | 27017 | Classic rotation |

The servers run under separate Linux accounts. A compromised addon or game
process therefore does not automatically gain access to the other servers.

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
sudo bash bootstrap.sh
```

The script installs the operating system dependencies, creates a 4 GB swap
file, configures the firewall, creates one account per server, installs each
server through LinuxGSM, and enables automatic monitoring and updates.

After installation, keep secrets out of Git and edit each private LinuxGSM
configuration on the VPS:

```bash
sudo -u gmodserver nano /home/gmodserver/lgsm/config-lgsm/gmodserver/gmodserver.cfg
sudo -u cssserver nano /home/cssserver/lgsm/config-lgsm/cssserver/cssserver.cfg
sudo -u hldsserver nano /home/hldsserver/lgsm/config-lgsm/hldsserver/hldsserver.cfg
```

Set a strong `rconpassword` for every server. Set `gslt` for Garry's Mod and
Counter-Strike: Source after creating tokens in Steam's game server account
management page. Do not commit either value.

## Daily operation

```bash
sudo -u gmodserver /home/gmodserver/gmodserver details
sudo -u gmodserver /home/gmodserver/gmodserver start
sudo -u gmodserver /home/gmodserver/gmodserver stop
sudo -u gmodserver /home/gmodserver/gmodserver restart
sudo -u gmodserver /home/gmodserver/gmodserver console
```

Replace `gmodserver` with `cssserver` or `hldsserver` for the other games.
Detach from a console with `Ctrl+B`, then `D`. Do not use `Ctrl+C`, which may
stop the game process.

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

LinuxGSM creates local compressed backups. OVH automated backup protects the
whole VPS, but it should not be the only copy. The next infrastructure step is
an encrypted offsite copy of server configs, maps, addons, and player data.
