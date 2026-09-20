# Events workspace, 12 September 2026

## What changed locally

`Calendar.tsx` now presents an upcoming agenda first, with a Month switch for the complete calendar. A next-event card leads into an event briefing beside the list. The briefing includes the event's real title, category, game, date, start/end time, duration, description, RSVP totals and the member's response.

The visual treatment is charcoal with restrained brass typography. Public Server is blue, Linebattle is green and Competitive is crimson in the filter legend, cards, calendar markers and briefing. Labels and distinct emblems accompany the colors. Training, Game Night, Campaign and Community Event remain available through the neutral Other events filter.

Search matches title, game and the readable event type. The agenda can include earlier events; the default keeps forthcoming and ongoing events. The month grid includes all 42 visible days, including adjacent months. A day opens its event list; an event opens its briefing. Month navigation and Today remain available. Narrow screens use the agenda comfortably, and the month view uses readable day numbers and event markers rather than tiny clipped titles.

## Correctness fixes

- The selected event is now an ID derived from the current event list, not a detached object with stale totals.
- Every event-day bucket, month boundary, day label and time display follows Chicago time. CDT/CST appears in the time itself, while the page identifies Central Time and America/Chicago.
- The query covers the actual visible 42-day interval. Adjacent-month cells are no longer false empty states caused by a shorter query.
- Each month load has an abort signal and generation guard. A superseded request cannot replace a newer month or member's data.
- Failed count or personal-RSVP requests are visible. Failed counts show N/R, not a made-up zero.
- Going, Maybe and Not Going use the existing `event_rsvp` upsert and existing member permission requirements. Counts are re-read after a successful save instead of guessed by optimistic arithmetic.
- A successful RSVP followed by a failed total refresh says that the response was saved. It does not falsely tell the member that the write failed.
- In-flight saves are guarded against repeat submission and late updates after navigation. The busy state clears without leaking into a different month.
- The Today action returns to the Chicago month and selected day, even when returning from another month.
- Attendance is described separately from RSVP intent. The design does not turn Going into attendance or voice hours.

## Local preview boundary

When the site has no configured Supabase client, three clearly labelled illustrative events demonstrate the layout. Every sample carries a Preview label. The page states that these are not scheduled events, and every RSVP action is disabled. No fake going/maybe counts are supplied. This is not evidence that the production event feed works.

When a backend is configured, the component reads actual event data and contains no sample fallback. An error remains an error. No preview event is ever inserted into the database or posted to Discord.

## Files

- `site/src/views/Calendar.tsx`
- `site/src/events-redesign.css`, scoped under `.coldstream-events`
- `site/src/lib/calendarTime.ts`, dependency-free pure time helpers
- `site/tests/calendar-time.test.mjs`

The existing event icon component, global styles, Home, App, Admin and profile routes were not changed by this lane. The time helper's `chicagoDateKey`, `chicagoMidnight` and `addCalendarDays` exports are also available to the separate statistics lane.

## Verified

`node --test site/tests/calendar-time.test.mjs` passed all 11 tests. Coverage includes Chicago/UTC day differences, winter/summer offsets, spring's 23-hour day, fall's 25-hour day, repeated-hour grouping, adjacent-month bounds, DST-spanning query bounds, leap days, year rollover, date-only labels, CDT/CST time labels, elapsed event duration and invalid dates.

The same test file passed with the process timezone set to Pacific/Honolulu, demonstrating that the helper's Chicago contract does not rely on the host timezone.

`npm run build --prefix site` passed, with TypeScript first and Vite reporting 138 modules transformed. Scoped `git diff --check` exited zero.

## Still to verify before publication

Root is coordinating browser checks on desktop and mobile. The new calendar requires a visual check of long event names, all category filters, empty search results, day selection, month navigation, Today, focus visibility and reduced motion.

No authenticated RSVP was submitted during this work. Actual database policies, Discord synchronization and live post-save aggregate refresh remain unverified until an approved round-trip test. Event creation and the admin editor are a separate lane and are not changed by this calendar display pass.

Nothing has been published.
