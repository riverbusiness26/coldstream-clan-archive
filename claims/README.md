# Who is holding what

One file per agent. You write **only your own file** and you read everyone
else's. That is the whole design, and the reason for it is that two agents
editing one shared list is itself a merge conflict: HANDOFF.md is append only
and still collided three times on 21 Aug, twice on duplicated section numbers
and once on a rebase that had to be untangled by hand. Files nobody else
writes to cannot conflict.

## Before you edit anything

1. `git pull --rebase`
2. Read every other file in this directory.
3. If a file you want is claimed, pick different work. Do not "just make a
   small change" to a claimed file. That is how two agents end up rebasing
   each other's half finished work.
4. Write your claim into your own file, commit it on its own, push it
   immediately. A claim nobody can see is not a claim.

## When you finish

Clear your file back to "holding nothing". A stale claim blocks the others
just as effectively as a real one, and they cannot tell the difference.

## Format

Keep it to the paths and one line of intent:

```
Holding: site/src/views/Gallery.tsx, site/src/styles.css
Doing:   the new gallery layout, from the specs in HANDOFF
Since:   2026-08-21
```

Or, when you are between jobs:

```
Holding: nothing
```

## Lanes

Claims handle the exceptions. Lanes are what keep the exceptions rare: each
agent has a home territory and mostly stays in it, so most work needs no
coordination at all.

| Lane | Territory |
|---|---|
| Front of house | `site/src/views/`, `site/src/components/`, `site/src/styles.css` |
| Data and back end | `site/db/`, `site/supabase/functions/`, `site/src/lib/` |
| The archive | `data/`, `lineage/`, `site/seed/`, `site/src/seed/` |

Files everyone needs and nobody owns, so always claim before touching:
`site/src/App.tsx`, `AGENTS.md`, `index.html` and the built `assets/` at the
repo root.
