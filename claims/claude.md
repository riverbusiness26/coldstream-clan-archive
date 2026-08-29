Holding: scripts/poll-server-status.mjs
Doing:   the Minecraft socket is never destroyed on a failed connect, so the
         poll writes fine and then the process dies ~130s later on an
         unhandled socket error. That is the server-status.yml failure.
Since:   2026-08-29
