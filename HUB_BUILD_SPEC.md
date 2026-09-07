# Homepage build spec: Order of the Day

Direction D from the September design pass, chosen for build. This is the
signed-in homepage only. Nothing here changes the guest splash, the Events
page, the Leaderboard page or the admin panel.

`design/hub-order-of-the-day.html` is a static reference render at 1440 wide,
self contained, with the real Satoshi and Cormorant Garamond files inlined so
it needs no network and no server.

**Use it for spacing, proportion and type rhythm only.** Open it in a browser
beside the build and check gaps, alignment, relative sizes and where the eye
lands. That is the one job it does better than this document.

Do not use it for anything else. It is not application code: do not import it,
copy its markup, lift its inline styles, or treat its class-free structure as
the component structure. Every number that matters is written down in this
spec, and where the render and the spec disagree, the spec wins. The markup in
it was generated to draw a picture, not to ship.

## Why this direction

It is the densest of the three drafted, and density is the point. The brief
asks for a first screen that answers what is happening this week, how am I
doing, and what should I do next, and it warns against empty hero space that
pushes useful information below the fold. Order of the Day replaces the
current hero block with a 58px status strip, which moves the weekly feature
roughly 220px up the page.

The two rejected directions and the reason, so nobody re-does them by
accident: The Board is the same content as mounted brass plates and runs about
25 percent taller, which costs the leaderboard its place on the first screen.
The Weekly Brief is a single ruled column with numbered paragraphs, which is
the most distinctive of the three and the best on a phone, but it reads as a
document rather than a dashboard.

## Section order

Fixed by the brief. Do not reorder.

1. Status strip
2. This Week in the Coldstream
3. Your statistics
4. Quick access
5. Community modules

## What changes and what does not

Changing: `site/src/views/Home.tsx` and the `hub-` block in
`site/src/styles.css`.

Preserve exactly as they are: the weekly submission flow and its Supabase
calls, `HomeFilm`, `WeeklyUpload`, `SiteNav`, `SiteFooter`, `AccountStrip`,
`DiscordAvatar`, the events fetch and `loadWeekly`, the calendar month cursor
logic, and every existing route. This is a re-layout of a working page, not a
rewrite of its data layer.

Delete on sight: every hardcoded `Pending` and `Placeholder` string in
`Home.tsx`. There are eight. They are the reason the page reads as broken
rather than as early. The replacement rule is in the empty states section.

## Section detail

Icons come from `react-icons/fa6`, the set already imported at the top of
`Home.tsx`. Do not add inline SVG icons.

### 1. Status strip

Replaces `.hub-hero` and `.hub-hero-copy` entirely. New class `hub-status`.

Left: display name prefixed by rank, in Cormorant 20px, then detachment in
muted 12px uppercase. Right: the next event as `Next: <title>, in N days`,
then a primary control reading `I am going`.

| Element | Source |
| --- | --- |
| Display name, avatar | `member.display_name`, `member.avatar_url`. Discord is the source of truth, per the product rules. |
| Rank | current rank from the personnel tables. Default `Volunteer`. |
| Detachment | current detachment. Default `Line Infantry`. |
| Next event | soonest future `event` row not cancelled |
| Going control | writes `event_rsvp` with status `going` |

If there is no future event, the right half shows `No events on the calendar`
with a link to the Events page, and no control.

### 2. This Week in the Coldstream

Grid, `1.62fr 1fr`, 22px gap, `align-items: stretch`. Upcoming events sit
full width directly below the grid, not inside the left column. That placement
is deliberate: putting them in the left column left a 247px hole under the
right rail at 1440.

Left cell, new class `hub-weekly-media`: the approved weekly item at 16:9 with
a `Weekly feature` tag over the top left corner, then an opaque caption bar
carrying the title, `Submitted by <name>`, the expiry, and a
`Previous features` link to the weekly archive.

Right rail, new class `hub-rail`, four stacked items with a flexible spacer
above the last so the rail bottom aligns with the media:

1. Featured member. Name, rank, detachment.
2. Top player of the week. Name, rank, scope, then three figures: kills, K/D, MVPs.
3. Three activity chips: approved features count, events this week, and the reset time, worded `Resets Mon 12:00 AM CT`.
4. The get-featured card, carrying the brief's copy verbatim and an upload control that opens the existing `WeeklyUpload` flow.

Upcoming events, full width: three rows maximum, each with day and weekday,
title, time and kind, going count, and an RSVP control. Header carries a
`Full calendar` link.

| Element | Source |
| --- | --- |
| Weekly media | `weekly_content_submission` where status is approved, deployed, and `featured_until` is in the future |
| Featured member | not in the schema yet. Add a nullable `featured_member_id` to the settings row, set from the admin panel. Until it exists, omit the card. |
| Top player of the week | highest approved `stat_submission` total for the current week |
| Chips | counts from the same three queries |
| Events | `event` joined to `event_rsvp` for the going count |

### 3. Your statistics

Header carries the Day, Week, Month toggle, which is the existing
`.hub-periods` control. Keep its state handling as is.

One row, seven cells, in this order: Kills, K/D, MVPs, Top 5s, Attendance,
Rank, Detachment. Rank and Detachment are set two sizes smaller than the five
figures because they are words, not numbers. Figures use
`font-variant-numeric: tabular-nums` so the row does not jump when the period
changes.

All five figures come from approved `stat_submission` rows only. Nothing
unapproved reaches this row. Attendance is computable today from `event_rsvp`
and `event_presence_sample` and does not wait on the bot.

### 4. Quick access

Five tiles: Events, Leaderboard, Gallery, My profile, Command panel. The
command panel tile renders only for `moderator` and `admin`, carries a brass
border rather than the neutral one, and is labelled `Staff` on the right.

When the member is not staff the grid becomes four columns, not five with a
gap.

### 5. Community modules

Two columns, `1fr 1fr`.

Left, leaderboard preview: two segmented controls, scope over period. Scopes
are Overall, Public Play, Events, Competitive, Attendance, which are the five
already defined in the code. Period is All-time and Weekly. Five rows below,
each with position, name, rank and score.

Right, recent activity: five rows, each with a relative time, the line, and a
kind label on the right. Kinds are Result, Event, Rank change, New member and
Weekly.

The activity feed does not need the bot to be useful. It can be a union over
new `member` rows, `personnel_audit` rank changes, completed `event` rows and
approved `weekly_content_submission` rows, ordered by time.

## Material and tokens

Use the tokens already in `styles.css`. No new colour values.

| Role | Token | Value |
| --- | --- | --- |
| Brass | `--accent` | `#b08d57` |
| Brass, deep | `--accent-deep` | `#8a6d41` |
| Brass, bright | literal | `#cbab74` |
| Text | `--ink` | `#e8eae6` |
| Supporting text | `--muted` | `#9aa19a` |
| Hairline | `--line` | `#262b2f` |
| Display type | `--display` | Cormorant Garamond |
| Body type | `--body` | Satoshi |

Three material rules from the brief, and the current build breaks all three.

**Panels are opaque.** Today `.hub-calendar`, `.hub-stat-block` and
`.hub-signin-prompt` use `rgba(27,31,34,.5)` with `backdrop-filter: blur(5px)`,
which reads as glass. Replace with a flat `#16191c`, no backdrop filter. The
value should read as a board mounted on the cloth, not a window into it.

**The cloth shows in the gaps, not through the panels.** The felt tile stays
as the page ground at 240px repeat. Section gaps and margins are where it is
visible.

**Brass has contact, not glow.** Brass headings and controls take
`text-shadow: 0 1px 0 rgba(0,0,0,.72)`. Raised controls and panels take
`box-shadow: 0 2px 0 rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.045)`.
No outer glow, no coloured shadow.

## Empty states

The rule that matters most on this page: **no element ever displays the word
Pending or Placeholder.**

When a value is not available, one of two things happens.

- If the section has other real content, the unavailable figures are dropped from the row and a single line under it names what is missing and what unlocks it. One line, not one per figure.
- If nothing in the section is available, the section is not rendered at all, and a single line takes its place naming what will appear there and when.

An empty podium of three placeholder names is worse than no podium.

## Responsive

One breakpoint at 640, which is where the existing hub rules already switch.

- The This Week grid becomes one column, media first, rail below.
- Your statistics becomes two columns by four rows. Rank and Detachment keep the smaller size.
- Quick access becomes two columns.
- Community modules stack.
- The leaderboard scope control scrolls horizontally inside its own container. The container gets `overflow-x: auto` and the strip inside gets `width: max-content` and `flex: none`. Without the second part the last scope is clipped rather than reachable, which is the bug this replaced.

## Floors to hold

- Every control at least 44px tall below 640. The measured page has none smaller.
- Body copy no smaller than 14px below 640. Labels no smaller than 11px.
- The page body never scrolls sideways at 320, 375 or 390. Only the scope strip scrolls, inside itself.
- Every figure that lines up in a column uses tabular numerals.

## Acceptance

1. `npm run build --prefix site` passes.
2. `grep -rn "Pending\|Placeholder" site/src/views/Home.tsx` returns nothing.
3. At 1440 the weekly media top edge sits above 400px from the top of the document.
4. At 1440 no two columns of the same grid differ in height by more than 120px.
5. At 375 the body scroll width equals 375 and no control measures under 44px tall.
6. House rules pass: no em dashes, and the copy says gaming community.
7. Signed out, and signed in with no stats, no events and no weekly item, the page renders with no empty tile and no placeholder word.

Check 7 is the one that matters. Most of this page's life so far has been
spent in that state.

## Out of scope

Do not touch the guest splash, the Events page, the Leaderboard page, the
profile, or the admin panel. Do not add custom avatar uploads. Do not publish,
deploy or post to Discord without River's explicit approval.
