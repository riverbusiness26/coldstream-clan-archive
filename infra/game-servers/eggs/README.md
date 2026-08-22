# Deployment-ready Pterodactyl templates

These files make games available in Pterodactyl without creating or starting a
server. Importing an egg stores its installation recipe and launch settings.
Game files are downloaded only when River creates a server from that egg.

## Ready templates

| Game | Template | Default ports | Source |
|---|---|---|---|
| Minecraft Java | Paper, Forge, Vanilla and Bungeecord | 25565 | Included with Pterodactyl Panel |
| Valheim | `egg-valheim.json` | 2456 and 2457 UDP | Pterodactyl `game-eggs` repository |
| Holdfast: Nations At War | `egg-holdfast-nations-at-war.json` | 20100, 8700 and 27018 UDP | Coldstream template using Steam app 1424230 |

The Valheim egg is copied without modification from Pterodactyl's maintained
game-eggs repository. Its provenance is:

`https://github.com/pterodactyl/game-eggs/tree/main/valheim/valheim_vanilla`

The Holdfast egg is maintained here because Pterodactyl does not currently ship
a maintained official Holdfast egg. Its install and launch behavior follows the
maintained Linux dedicated-server implementation at:

`https://github.com/CM2Walki/HoldfastNaW`

## Before launch

- Replace every default game and administrator password.
- Add every listed game and query port as an allocation on the Pterodactyl node.
- Set realistic memory and disk limits for the selected game.
- Confirm current Steam application IDs and release notes before first use.
- Take a Pterodactyl backup after configuration and before adding mods.

Do not create a Minecraft server merely because its templates are present. The
templates are inventory, not running services.
