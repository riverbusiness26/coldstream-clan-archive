# Progress board

The board is the work record for Coldstream Gaming. The public page is
`/progress/` and the source of truth is `progress/board.json`.

Every task change goes through `scripts/task.mjs`. That records the change,
updates the task counts and rebuilds `progress/index.html` in one step.

```text
node scripts/task.mjs list
node scripts/task.mjs add website "Write the new home page copy" doing
node scripts/task.mjs set web-1 done "Built, checked and published."
node scripts/task.mjs note discord "The bot command was deployed."
```

Every push to `main` also runs `progress-board.yml`. It rebuilds the recent
change feed from the repository history, commits the refreshed page and lets
the normal site publish take it live. The page reloads itself every five
minutes, which is suitable for the tablet display.

Do not type percentages into the generated page. They come from the task
record. Do not hand edit `progress/index.html`; run `node scripts/progress.mjs`
or use the task command instead.
