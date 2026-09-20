# Shillings social layer

Draft for River's review, 2026-09-19. Scoped to Shillings, not the service-record profile or public website. This is a proposed implementation sequence, not shipped functionality.

## Confirmed

- Bottom-right live chat, website-only first. No Discord message mirroring.
- River confirmed profiles should not be private and private messages should be included. Interpret profile visibility as all signed-in members, consistent with the existing guest gate. This does not authorize public exposure of private transaction records, messages or staff notes.
- Members need to visit one another's Shillings profiles and have reasons to interact.
- Preserve existing games, fictional currency, balances, one cosmetic per type and six displayed keepsakes.
- Existing no-gifting decision remains in force unless explicitly changed.
- Category levels approved for Dice, Blackjack, Heists, Duty and Daily Ration. Local implementation and release limits are recorded in `shillings-activity-levels.md`; this does not mark the remaining social features shipped.

## Awaiting choices

- Wallet and Pay Chest visibility still need an explicit field-level choice; open profiles do not automatically make all account data public.
- Presence: recommend available, away, busy and appear-offline controls. Website presence is never Discord attendance credit.

## Current source findings

- QuartermasterSocial.tsx supports duels, Split or Steal, heist recruitment and lottery. Peer selection comes from snapshot.leaderboard, not a dedicated player directory.
- QuartermasterBillet.tsx renders the current member's editable display. A visitor view needs its own read-only data contract and route, not reuse of the private /me response.
- quartermaster.ts BoardMember currently includes purse, chest and net. Making savings private must also change the server payload, not merely hide text.
- 0006_shoutbox.sql provides legacy realtime publication and last-200-line trimming. This is not evidence of a current usable or sufficiently protected Shillings chat. Audit membership, grants, moderation and rate limits before reuse. Do not silently delete old shout data or reuse public access rules.
- An independent Living Campaign/Field Kitchen prototype is claimed by another task. Coordinate any future cooperative objective integration instead of duplicating it.

## First release: a connected room

1. Floating Chat launcher, bottom-right, unread badge, collapsible. One members-only Mess Room with message replies, modest reactions, clickable names, muted notifications and plain-text links. Keep event/game notices in a separate Activity tab. On phones open a full-width sheet above safe-area controls, never cover game confirmation buttons.
2. Players directory with name search, profile thumbnails, current equipped title, real website availability, and a Looking for a game filter. Deduplicate multiple tabs and expire stale presence. No invented online counts or last-seen claims.
3. Visitable Shillings profiles with avatar, frame, cloth, six keepsakes, game wins and optional short introduction. Click names in chat, leaderboard, invitations and outcomes to open the same profile. Visitor controls: invite to game, invite to crew, view displayed item. Editing stays owner-only.
4. Looking for players board with persistent game invitation cards. Show host, game, stakes, available seats and expiry. Accept/decline from a single notification inbox across all Shillings sections. A join action uses the existing server-authoritative game flow, with explicit stake confirmation.
5. Foundation safety: author identity derived from authenticated membership, server timestamps, escaped content, message length/rate limits, report, block/mute, admin moderation, pagination, reconnect catch-up and duplicate-send protection. Blocks prevent direct invitations, not just hide chat lines. Staff audit cap remains 75; chat retention is a separate policy. Propose 30-day chat history with a documented, separately approved report-evidence retention policy.
6. Private messages, approved by River: one-to-one conversations integrated into the chat drawer, unread state, member lookup, mute/block/report, message requests for first contact, server-enforced participant-only access and permission checks on every read/write. Do not expose DMs through the community chat feed, member profile or broad realtime subscriptions. No claim of end-to-end encryption. Define staff access to specifically reported evidence before launch.

## Collection and rare-reward expansion, proposed

River wants exceptionally rare heist rewards that can be displayed in a showcase, and enough social activities to support longer voluntary sessions. These are design proposals, not changed odds or economy rules.

- Add cosmetic-only personal artifact rolls once per eligible, settled heist participant, alongside existing currency settlement. Persist outcome atomically and idempotently; reloads, retries, spectators, duplicate tabs and cancelled/refunded crews cannot create more rolls. Proposed eligibility includes finished failures so loss does not make every session empty. Validate this rule before implementation.
- Initial discussion tiers per eligible roll: rare 3%, very rare 0.5%, exceptional 0.1%. Use one mutually exclusive tier roll and publish exact per-item odds after the pool is designed; tier odds are not each item's odds. These numbers need group-size simulation before approval. A 0.1% chance averages one find per 1,000 eligible rolls across the population, not a guaranteed reward after 1,000 plays.
- Examples: sealed campaign map, engraved spyglass, presentation flintlock, miniature captured standard. All are Shillings collectibles, not official regiment ranks or medals.
- Every item gets source, acquisition date and consenting crew attribution, plus a stable artifact ID. Profile showcases retain six display positions; full collection opens separately. Let visitors inspect, react, learn the source and invite the owner to play.
- Guaranteed milestone collection rewards sit beside rare luck: collection journals, permanent progress towards themed display pieces and crew achievements. Never replace exceptional drops with cash-bought rolls, paid luck boosts or wallet-powered odds boosts. No gifts/trading yet, preserving River's previous choice.
- Social session options: shared game tables and spectators, crew recruitment, short co-op dispatch puzzles, opt-in community mini-events, shared jukebox requests with supplied licensed tracks, collection comparison, crew recap cards and weekly showcases. Coordinate longer cooperative objectives with the separate Living Campaign task.
- No currency for raw chatting, repeated profile clicks or time online. No lost collection progress for taking breaks. Players should be able to keep socialising without endlessly increasing wagers.

Collection references: Guild Wars 2's item collection achievements link discovered items to longer goals (https://www.guildwars2.com/en/news/introducing-the-collections-achievement-category/). FFXIV Gold Saucer GATEs demonstrate shared participatory mini-events (https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/goldsaucer/gate/). These are inspiration, not a request to duplicate their systems.

## Reasons to visit and return

| Addition | Interaction it supports | Suggested stage |
| --- | --- | --- |
| Inspect displayed cosmetics | See what another member owns and find it in the store | First release |
| Challenge from a profile | Go straight from a player to a supported game | First release |
| Crew recruitment cards in chat | Fill real heist places without searching menus | First release |
| Friend or favourite list | Find familiar people quickly | Second release |
| Mutual head-to-head record | Remember friendly rivalries without public shaming | Second release |
| Game result cards | Discuss a shared outcome and offer a rematch | Second release |
| Spectator seats | Watch supported games and react | Second release, only after hidden-state audit |
| Profile commendations | Appreciate a collection with one changeable reaction per person | Second release |
| Weekly collection spotlight | Feature willing members' displays, no purchases required | Second release |
| Cooperative community objectives | Work towards shared milestones with capped, server-verified contributions | Coordinate with Living Campaign task |
| Temporary crew room | Coordinate a heist together, then close the room cleanly | Later |
| Organised games nights | Give people a common time to meet | Later |
| Community polls | Let members choose a future cosmetic theme or activity | Later |
| Opt-in Discord game invitations | Bring friends into website games without mirroring all chat | Later, separate channel approval |

Do not award currency for raw message counts, repeated profile visits or reactions. Those encourage farming and clutter. No forced daily social streak, unsolicited DMs, fake activity, repeated invite spam or punishments for being offline. Meaningful cooperative rewards require a separate economy review.

## Data and realtime approach

Use the existing authenticated member identity. Keep chat and presence separate from the shared game engine's authoritative balances and settlements. Supabase is a candidate for the social transport already present in this stack: Presence is intended for slow-changing online state, and Realtime supports authorization policies for private channels. This does not establish deployment settings or production capacity.

References checked: https://supabase.com/docs/guides/realtime/presence and https://supabase.com/docs/guides/realtime/authorization.

Persist chat messages in an explicitly protected table if history is required; broadcasts alone are not a durable chat history. Profile endpoints return allowlisted public-to-members fields only. Browser presence is an availability hint, never proof of membership, attendance, identity or eligibility. Every game invite must be validated server-side when accepted; no client-generated payouts or exposed secret Split or Steal choices/dealer cards. No credentials or private ledger data in realtime payloads.

## Delivery gates

1. Show local clickable Chat/Players/Profile/Invite layout using clearly labelled synthetic content. Include approved open-to-members profiles and DMs; settle account-field visibility and message moderation policy before real data integration.
2. Implement authenticated profile reads and membership-gated durable chat with moderation before opening it to members.
3. Wire existing games into invitations and recruitment, with one source of truth for expiry and acceptance.
4. Test two independent member sessions: send/reply, reconnect history, unread state, visitor profile privacy, invite/decline/accept, blocked invites, expired/full games, duplicate requests, moderation and logout revocation. Check keyboard access, screen readers, 390px layout and reduced motion.
5. Review locally. No production deployment, schema changes, Discord posts or real member transactions are authorized by this planning pass.
