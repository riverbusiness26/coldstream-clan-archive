# Regiment Wars: local playtest

Publication update, 20 September 2026: the completed solo practice mode is approved for public release with a visible Work in progress label and sample-currency limits. See `PUBLIC-PRACTICE-RELEASE.md`. The notes below record the original local-only handoff.

Open http://localhost:4197/regiment-wars.html while the preview is running.

This is an isolated, playable mockup. It is not a public release and cannot spend real Shillings. Nothing has been pushed or deployed. No profile file or live member record was edited. The website's concurrently edited Quartermaster files were not copied into this worktree or modified.

## Play

1. Claim First Muster, the free starter pack. Break the seal, reveal the cards, and choose Build my deck.
2. Open My decks. All 15 slots are shown together: ten infantry in five pairs, with five support slots below. Your cards opens as a grid underneath the board. Drag a card up into a matching slot, or click a card and then its destination. Collapse cards hides the tray; Show cards opens it again. New decks stay empty after claiming the starter. Existing saved decks are preserved. Clear deck returns to 15 empty slots without losing cards; Undo restores the last change. Auto-fill deck is an optional shortcut that preserves existing choices.
3. Take the field against one of three AI opponents. Choose simultaneous orders, use the command/drummer abilities, and watch for bayonet range. Battles save after every exchange.
4. Spend the sample purse in Card packs. Rare and Legendary packs guarantee their named rarity or better. Duplicate cards become supplies, which craft missing cards from the collection.
5. Inspect the battle journal and receipts. Practice battles have no Shilling payout. How to play contains rules, export and a confirmed local reset.

Tips on/off remembers the preference on this browser, separately from the game save. Switching tips off hides the coaching panel and placement advice while keeping counts, controls and action feedback visible. Find & filter cards opens search, type, rarity and Not in this deck filters. All owned cards appear by default, including cards marked In deck.

On phones, all five sections remain visible in a wrapping board, followed by a two-column collection tray. Tap a card and then a slot, or tap an empty slot first to filter the tray to compatible cards. Drag with the four-arrow handle; card bodies allow normal scrolling. Keyboard users can select cards and positions with Tab and Enter/Space; Escape cancels. Card information buttons show full abilities and stats. Deck edits during a battle apply to the next battle.

## UX references

Functional inspiration, not copied artwork or code:
- [Hearthstone: Deck Recipes](https://hearthstone.blizzard.com/en-us/news/20056279): help new players start with a playable deck and replace cards from their collection. Adapted here as the free starter and Fill empty slots.
- [MTG Arena: Getting Started](https://magic.wizards.com/en/mtgarena/getting-started): starter decks, collection growth and a direct deck-selection path. Adapted here as starter → deck → solo battle, readable collection ownership and contextual next actions.

Regiment Wars keeps its own five-section infantry/support formation, Coldstream visual style, art placeholders, pack reveals and military sound direction. No new runtime package was needed for pointer dragging.

## Decisions from River in this task

- Name: Regiment Wars, with its own Shillings tab.
- First release direction: solo AI, then player-versus-player.
- Formation: 15 cards, 10 line infantry and any 5 support cards. Repeated support roles are allowed; individual identities are unique within a deck.
- Larger collection: this draft has 20 infantry and 10 support options, 30 total.
- Rare and Legendary cards are stronger, not merely cosmetic.
- Focus on the core card game; no campaign map in this pass.
- Placeholder images and names for now, Napoleonic 2nd Coldstream styling.
- Pack opening should feel rewarding, with animations and sound. Selected sound direction: military paper, drums and restrained brass.
- Approved first-playtest prices: Starter free, Common 30, Rare 90, Legendary 240 Shillings.
- Player profiles are reserved for another task. No display, stats, trophies or game fields have been added to profiles.
- No push, publishing, live transactions or changes to other active projects.

## Provisional details

The starter contains 15 fixed Common cards and can be claimed once per local save. Paid packs contain 4 / 5 / 6 cards. Normal slot Common/Rare/Legendary odds are 85/14/1, 65/30/5 and 50/40/10 percent. The final Rare slot is 95% Rare and 5% Legendary; the final Legendary slot is 100% Legendary. Each card within its rarity pool is equally likely. Duplicates can occur within a pack.

Duplicate supplies: 5 / 20 / 60. Commission costs: 30 / 120 / 360. Starting sample purse: 600. These are mockup economy decisions, not changes to the live economy. No trading or real-money pack purchase is implemented.

Support includes Officer, Sergeant, Colour Sergeant, Fifer and Drummer. Local section bonuses follow placement. Repeated roles add coverage and resilience, while army-wide bonuses do not stack. The two once-per-battle abilities are shared by the army. Army morale is 21 plus rounded average card morale, capped at 30. All numbers remain balance candidates.

## Art and audio

The supplied conversation's later visual decisions were used: company banner, four stats, trait, quote, dark frame, gold details and Second to None. Crest appears on packs and branding, not character frames. The transparent replacement supplied by River (`codex-clipboard-404f6a21-b974-400a-a69b-26303cb7eba7.png`) is copied byte-for-byte to `site/public/regiment-wars/card-reference.png`. Its alpha transparency is retained. CardArtwork uses the full reference for collection/pack cards and a shorter view for arranging, with current names, four stats and traits overlaid as readable game text. Every card temporarily shares this illustration. The reference image’s printed Richardson stats and Skirmisher/terrain text are not new game rules. The earlier opaque reference is not included. The existing campaign image remains on the war-room hero.

Pack sound is synthesized locally through Web Audio: filtered paper noise, drum strokes and brass-like tones. No recording or media license dependency. Sound has a persistent mute toggle, stops on mute, starts only after an opening/reveal gesture, and never blocks progress if unavailable. Reduced motion uses immediate reveals; skip and reveal-all controls are present. Rare and Legendary treatments follow actual saved contents; no simulated near-miss display.

## Start again later

In this worktree, run `npm run dev --prefix site -- --host 127.0.0.1 --port 4197`, then open the link above. Node dependencies are installed in this worktree only. Do not copy a production `.env` into this playtest.

The in-site integration is at `/#/stores`: click the existing demo sign-in button to enter the local preview member, then Regiment Wars. This link and `/#/regiment-wars` are gated by development mode and the absence of live Supabase configuration. The standalone HTML entry also builds for local inspection, but is not safe to present as a live economy.

## Where the work lives

- Branch: `codex/regiment-wars`, based on local committed `ee215b2`.
- Worktree: `C:\Users\thegr\Desktop\AI Projects\coldstream-regiment-wars`.
- `site/src/regiment-wars/CardArtwork.tsx` and `cardArtwork.css`: shared reference-based card presentation.
- `site/src/regiment-wars/catalogue.ts`: cards, prices, odds, crafting values.
- `site/src/regiment-wars/DeckBuilder.tsx`, `deckBuilder.css` and `deckLayout.ts`: drag/click/tap/keyboard formation editor, undo and fill helpers.
- `site/src/regiment-wars/engine.ts`: pure simultaneous-combat rules.
- `site/src/regiment-wars/store.ts` and `useGame.ts`: local state, transactions, recovery and browser-tab coordination.
- `site/src/regiment-wars/PackOpening.tsx` and `sound.ts`: reveal theatre and synthesized sound.
- `site/src/views/RegimentWars.tsx` and `site/src/regiment-wars.css`: page and responsive styling.
- `site/tests/regiment-wars.test.mjs`: executable game checks.
- `LAUNCH-INTEGRATION.md`: work still needed before real member play.

The browser save is device-local and intentionally editable by its owner. It is never authoritative account data. Export is a diagnostic backup; importing/restoring backups is not implemented yet. Twenty recent battle reports are retained; receipts remain until reset. No production account data was copied.

Browser QA used the 127.0.0.1 origin. The delivered localhost origin retains the user’s own playtest progress without deleting or resetting either save. Browser storage is separate for these two hostnames.
