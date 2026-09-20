# Personal-stat integrity audit and correction

12 September 2026. Local implementation and mocked verification only. No production query, SQL migration, RLS change or deployment performed.

## Scope and verified evidence

This pass owns only the personal-stat helper, a pure date-range helper and their tests. It does not change the competitive/public leaderboard rules, the weekly top-player view, a UI component or a Discord bot.

| Repository evidence | Meaning |
| --- | --- |
| `site/db/0035_stat_submissions.sql` defines `stat_submission.event_id` as a nullable foreign key to `event(id)`. | Linked submissions can be filtered by the actual event record. Eventless legacy submissions cannot be dated honestly from this schema. |
| `site/db/0010_events.sql` defines non-null `event.starts_at timestamptz`. | This is the verified event-occurrence field. Submission `created_at` is the upload record's time, not necessarily when the member played. |
| `site/db/0035_stat_submissions.sql` defines `stat_round` with a per-submission round number from 1 to 30. | A nested round read is bounded per submission; submission rows still require pagination. |
| `site/db/0035_stat_submissions.sql` defines `stat_leaderboard` from approved rounds, grouped by category/member. | Existing all-time personal combat totals remain on this aggregate view. Its zero-deaths K/D convention remains unchanged: kills when deaths is zero. |
| `site/db/0027_orderly_room.sql` separates RSVP `status` from staff-written `attendance`; `mark_attendance` can set attended/no_show. | Neither a Going response nor an attended mark independently proves strict voice-sample attendance. All RSVP rows are not a valid attendance-rate denominator. |
| `site/db/0027_orderly_room.sql` and `0029_attendance_review.sql` restrict raw samples and roll/window views to staff via RLS. | The frontend must not read these tables for a normal member or widen access as a display fix. |
| `site/db/0044_attendance_two_minute_samples.sql` defines `member_attendance_hours(target_member uuid)`, without period parameters. | The existing member-safe RPC supplies all-time sample-derived hours only. Its formula is sample count × 2 minutes, rounded to one decimal hour. It is not a period/event-count aggregate. |

These are local schema definitions, not proof that every migration is currently applied in production.

## Implemented behaviour

- Day, Week and Month are Chicago civil-calendar periods, not the viewer device's timezone. Weeks begin Monday. Date boundaries reuse the calendar's `chicagoDateKey`, `chicagoMidnight` and `addCalendarDays` helpers, so daylight-saving changes resolve to the correct UTC boundary.
- Filtered combat selects approved submissions linked to events with `starts_at >= period start` and `starts_at < next period start`. It does not use upload or review timestamps. Undated submissions remain included in All time, but are not guessed into a filtered period.
- Filtered submissions use stable ID-ordered keyset pages of 250. A later-page failure returns unknown rather than a plausible partial total. No arbitrary first-1,000 truncation is treated as a complete result.
- All-time combat remains on the existing `stat_leaderboard`. Category behaviour and the existing zero-deaths K/D convention are unchanged.
- Null/error/non-finite/negative/malformed metrics are unknown, not fabricated zero. Genuine numeric zero remains zero. A failed combat query does not discard an independently successful hours query, and vice versa.
- `attendanceHours` uses the existing RPC only for All time. It returns null for Day, Week and Month because that RPC cannot supply the requested period.
- `eventsAttended` and `attendancePercent` return null for all periods. No available member-safe aggregate in the inspected schema proves a sampled event count or the attendance-rate denominator. RSVP queries have been removed from this helper.
- The public function's existing three arguments and result fields remain unchanged. No callers or UI files were modified in this pass.

The root agent approved the null-attendance plan before implementation.

## Required UI wording

Filtered combat should be labelled **Approved, dated events · Chicago time**. All-time includes approved legacy submissions without event links. The UI should not imply that a missing period metric is zero or that every legacy submission has a date.

Voice hours should be labelled as all-time sampled time where the existing RPC is used. Unknown attended-event/rate fields should be omitted or clearly marked unavailable. Do not retain “Confirmed RSVP record” as an attendance explanation.

## Next backend contract, not implemented here

A new, separately approved member-safe aggregation contract is needed before displaying period voice time, strictly sampled attended-event counts or an attendance rate. An implementation should:

1. Authorize the authenticated target member or staff server-side. Return only aggregates for that member, not another member's Discord identity or raw voice samples.
2. Accept validated UTC `period_start` inclusive and `period_end` exclusive, or an explicit all-time request. Resolve Chicago civil boundaries consistently. Echo the selected scope and data completeness so a UI cannot silently mix periods.
3. Derive time exclusively from accepted Discord voice-presence samples. Verify the bot's two-minute cadence, duplicate handling, valid voice channels, sampling gaps and early/late grace windows before altering the current hours formula. Never use RSVP intent or manually entered hours.
4. Define period attribution explicitly: elapsed sampled time within the period versus all sampled time belonging to an event that started in the period. This decision matters when an event or grace window crosses midnight. Do not mix the two conventions without a label.
5. Count distinct eligible events using the approved qualification rule. The local `event_presence_qualified` view currently requires a ten-minute run with gaps no longer than five minutes, but changing or relying on that rule requires verification against the actual bot and desired grace-window policy.
6. Return `hours`, `qualified_event_count`, `eligible_event_count`, a nullable attendance percentage and a completeness indicator. An attendance percentage needs an approved eligible-completed-event denominator, including how joining, discharge, cancellations and nonparticipating game categories affect eligibility. RSVP rows are not that denominator.
7. Test ordinary-member isolation, staff access, no Discord identity, zero samples, failed/incomplete sampling, duplicate samples, multi-channel movement, future/cancelled events, DST and period-boundary grace windows. Unknown or incomplete data must not become a zero-attendance claim.

No function name, SQL signature or migration was invented or applied as part of this frontend correction.

## Remaining related audit findings

- `0039_stat_leaderboard_windows.sql` still bases public-server monthly totals on submission `created_at` and database `date_trunc('month', now())`.
- `0046_stat_leaderboard_week.sql` uses Chicago week boundaries but still filters submission `created_at`.
- Those existing aggregate views were deliberately not changed. A future approved schema pass should reconcile the desired event-occurrence policy for those specific public features, then verify the migration and deployed frontend together. This personal-helper fix does not establish that production leaderboards use the new period semantics.
- An event edited after a submission was approved can change its period under the current linked-event model. The schema has no immutable played-at snapshot. If period history must remain immutable, that needs a separate audited data-model decision.

## Verification

`node --test site/tests/combat-stats.test.mjs` uses the actual TypeScript helpers, bundled in memory, and a mocked client. Fourteen tests passed, zero failed. Coverage includes Chicago day/week/month boundaries, year rollover, leap year, 23-hour and 25-hour DST days, approved/current-member scoping, eventless and out-of-period exclusions, unchanged all-time/KD behaviour, 1,003 submissions across five keyset pages, later-page failure, network rejection, malformed values and no RSVP/raw-presence reads.

`npm run build --prefix site` also passed TypeScript and Vite with 138 modules transformed. Scoped `git diff --check` returned no whitespace errors. These checks verify the local shared checkout, not deployment.

No test connects to Supabase, starts a browser or writes generated test output to the checkout. Root owns the final integrated browser review and publication decision.
