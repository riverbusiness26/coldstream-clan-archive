# Coldstream Gaming: community website design and workflow review

## Recommendation

Coldstream should feel like a living regimental collection: a restrained public entrance, a useful weekly member briefing, a personal record worth showing, and an archive that makes the community's longevity tangible. The strongest improvement is not more decoration. It is clearer hierarchy, original artwork in a few deliberate places, accurate records, and fewer competing actions on each screen.

Keep charcoal, warm ivory, crimson and restrained antique brass. Retain the approved campaign image, but remove the red transition under it. Use the supplied cleaner crest as the shared identity mark. Keep detailed rank patches and medals as real objects on one subtle cloth mount. Everything operational, including statistics, filters, review queues and event times, should be compact, readable and predictable.

This report distinguishes public-page observations from recommendations. Comparable sites were inspected through their available public page content, not authenticated dashboards or visual screenshot testing. Source observations were collected on 12 September 2026. Local source findings describe the checkout at that point, before parallel implementation; they are not claims about live production.

## Comparable community and product patterns

### Regiment Control: organize around staff tasks

Regiment Control explicitly groups its product into roster, events and reports, awards and promotions, Discord tools, and administration. Its public description connects recurring events, RSVP, post-event reporting, weekly briefings and an audit trail. It also separates member records from rank definitions and permission settings. These are useful workflow boundaries, not evidence that Coldstream needs every advertised feature. The dashboard URL returned a loading shell, so its internal interface and actual task completion were not verified.[1](https://regimentcontrol.com/)

For Coldstream, adopt task-based navigation: Overview, Members, Reviews, Events, Artwork, Audit and Settings. Group stats, gallery and weekly queues under Reviews while preserving their individual filters. Keep rank and medal creation in Artwork; award them only from the member record. Do not copy promotion voting, rented-server controls or a second Discord management system without a separate requirement.

### 29th Infantry Division: identity has material presence

The 29th public entrance gives a short explanation of its community, its games, an establishment year and recent videos. Its roster offers wide and slim views, rank imagery and hierarchical grouping. A public member page separates the profile from a service record and includes a service-coat image. The inspected member page appears older than the current roster, so its record is evidence of an interface pattern, not a current personnel assertion.[2](https://www.29th.org/) [3](https://www.29th.org/roster) [4](https://www.29th.org/members/wheatley)

Borrow the sense of an earned personal record, not the bureaucracy. Coldstream's avatar should remain recognizable, with a prominent but moderate shoulder patch. Medals belong beside it on the same mount. Keep organizational data and identity synchronization behind staff tools. Do not import public Steam identifiers, donation totals or a large hierarchy into Coldstream's profile.

### 7th Cavalry: recognition creates current community content

The 7th Cavalry homepage places public event notices and named graduation recognition in its news stream. Event notices include start and end information, game context and participation expectations. This demonstrates a useful connection between what a community does and what it celebrates; it does not establish that a forum-style homepage is the best layout for Coldstream.[5](https://7cav.us/)

Coldstream can make weekly features, earned medals, promotions and approved results visible without filling the page with generic activity. A small editorial rail should highlight real people and link to the underlying record. Empty sections should shrink to a short honest state, not reserve a large blank trophy cabinet. Avoid manufactured streaks or achievement currencies that were never requested.

### Third Infantry Division: longevity and schedules are concrete

The Third Infantry homepage prominently states its founding period and explains its history, weekly operations and specializations. Its calendar separates event categories and shows start and end times with a named timezone. The calendar includes adjacent-month events and a clear statement about the timezone used for anonymous visitors. Those are directly useful patterns for a multi-timezone gaming group.[6](https://www.3rdinf.us/) [7](https://www.3rdinf.us/calendar)

Coldstream should similarly state “Since 2011” plainly, then let an era timeline prove that statement through dates, records and stories. Its events page should identify Chicago time in the interface and offer a secondary local-time reading where useful. The color legend should filter events, not merely decorate the calendar.

### 506th Infantry: connect the present to named past chapters

The 506th website distinguishes community, operations, training and after-action material. Its operations page presents dated campaigns with imagery, and its homepage connects recent activity with roster and media sections. Some repeated numerical labels on the operations page are not explained by the retrieved content, so they should not be treated as verified performance data or copied into a Coldstream design.[8](https://506thir.net/) [9](https://506thir.net/operations/)

The transferable pattern is a browsable record of named periods. Coldstream's era timeline should show each period's game, banner, notable people and source-backed stories. Avoid a tall wall of decorative campaign cards. Open one era at a time, keep the era navigation visible, and provide routes into its roster and media.

### Bannerforge and existing Coldstream references

Bannerforge remains an owner-selected reference for finish, original imagery and motion. Coldstream remains the source of identity, functions and archive truth. Their live URLs could not be reliably retrieved in this research pass, so no new live visual or performance claims are made about either. The local museum design plan and supplied artwork establish the current direction, with the newer instruction rejecting green surfaces and red hero gradients taking precedence over older palette proposals.

The redesign should not turn Coldstream into a service-marketing site. Keep Bannerforge's influence in the quality of motion and materials, and the small “Powered by Bannerforge Studios” footer. Avoid importing unrelated product navigation, pricing patterns or visual assets.

## A coherent page system

### Public landing: compact, original, calm

Use a slim shared header with a clean crest, Coldstream Gaming wordmark, restrained navigation and one clear sign-in action. The crest should retain its aspect ratio at small sizes, not be squeezed into a square badge. Keep a generous pointer target around it without making the visible image large. Display the current campaign art within a bounded hero rather than letting it dissolve into a crimson band.

Show the same information with fewer layers: the community name, one short sentence, “Since 2011”, join/sign-in actions, current games, and a compact route into the community's story. Merge repeated motto placements. Use an ivory rule or a clean charcoal boundary between hero and content. A short opacity reveal or small image drift can provide life; continuous smoke, glitter and moving counters would make a simpler page busy again.

Two suitable concepts are a compact split hero with copy left and artwork right, or an image-led masthead with a narrow editorial information strip beneath it. Both preserve live HTML text. Preview both with mobile crops before deciding. No new imagery is necessary simply to change the page's structure.

### Your weekly brief: one editorial lead, useful supporting facts

Rename the member heading to “Your weekly brief”. Preserve the recognizable weekly feature, but make it the clear lead item. On desktop, use a roughly two-thirds media column and one-third highlights rail. On narrow screens, place the media first, then its caption, then a compact highlights row. Upcoming events should follow directly, with the personal record and community activity below.

Fit the frame to the video aperture, not the other way around. The source image's external dimensions include transparent padding and a lower ornament, so stretching the whole graphic to the video rectangle cannot reliably align the opening. Define a stable 16:9 media box and measure the frame's actual inner aperture. Keep the ornament outside the viewing area. The caption and navigation controls should occupy their own row below the image, not intersect the film or adjoining text. CSS aspect ratio provides stable box geometry, while object-fit determines whether image/video content is contained or cropped.[10](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/aspect-ratio) [11](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit)

If the frame cannot be adapted without distortion, regenerate only that asset to a specified inner opening. Keep the approved motif, flat chroma-green production master, transparent final export and measured inset metadata. Never key away dark material inside the frame itself. Verify all four aperture edges against a test video, including its bottom controls, at desktop and phone widths.

Use the submitted title, game, date and description when present; do not invent missing metadata. Separate the submission date from the actual event date. The top-player rail must identify its period and use approved aggregate results. A compact link to the leaderboard is more useful than repeating its entire table.

### Personal record: three preview-first directions

The identity row remains avatar, readable Discord name, current rank text and detachment. Remove the separate Discord identity module. Replace visible “assignment” language with rank, medals and service history while preserving the underlying relational records. If no rank exists, use a quiet “Rank not recorded” state rather than implying the member is waiting for a task.

| Concept | Rank and medals | Statistics | Best use |
| --- | --- | --- | --- |
| A. Uniform mount | One dark cloth panel, moderate shoulder patch on the left, medals in a horizontal row | Six compact numbers below with a single category/period selector | Recommended balanced profile |
| B. Service folio | Narrow visual column with the patch and medal tray; avatar and name across the top | Dense two-column metric table and attendance summary beside it | Members who mainly inspect performance |
| C. Collection record | Wider rank-and-medal display with restrained exhibit labels | A compact record strip, then feature/media contribution history | Strongest sense of ownership and recognition |

Show these as interactive concepts before replacing the working profile. Keep names, dates and award descriptions as real text. Subtle stitching belongs to the cloth mount, not around every card. Preserve the rank image's full silhouette with object containment and consistent maximum height. Medals should be individually inspectable, but a member with no medals should not receive ten conspicuous empty slots.

Statistics should emphasize kills, deaths, K/D, MVPs, Top 5s, attended events and sampled voice time. Avoid giant unlabelled numbers. Featured appearances and media contributions can strengthen the personal record, but their definitions must be settled first: a unique accepted submission is not the same as a week in rotation, and an uploaded file is not necessarily approved media. Show only verified counts, with pending work private to its author and staff.

### History and historical roster

Lead with a navigable era timeline, with stories inside each era. Keep the chronology visible from 2011 to the present and distinguish a continuous community from its different game and banner periods. Inside an era, present a short summary, selected dated stories, original media, notable names and an expandable source record. Do not use generated battlefield imagery as documentary evidence of a gaming event.

The historical roster should be an index rather than a second oversized history page. Use a compact table with Name, Recorded years, Era/game and Open record. Search should match aliases. Sort by name, earliest dated evidence and latest dated evidence. Filter by years actually represented in the record, not only the first year someone appears. Show 25 rows per page and preserve filters while opening a record. No Steam links are needed in the display; original source metadata should remain accessible.

“Recorded years” is more honest than “Year joined” when the only evidence is a dated archived mention. Missing years are unknown, not proof the player left. Deduplication and cross-era identity merges require evidence and should not occur as a side effect of redesigning the table.

## Events and administration

### Events: upcoming first, calendar second

Default to a short upcoming agenda with a featured next event, then a Month/List switch. Desktop can pair the calendar with an event-detail panel. Mobile should prioritize the agenda instead of shrinking a dense seven-column grid until titles become unreadable. Selecting a date opens that day's events; selecting an event opens its body, start/end, game and RSVP.

Keep Public Server blue, Linebattle green and Competitive crimson, paired with visible labels and distinct icons. Other types need readable labels and a neutral fallback. Color alone cannot carry meaning under WCAG's use-of-color criterion.[12](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) Use one shared human-readable type map so the member never sees a raw value such as `public_server`.

Show Chicago time consistently and calculate event-day grouping in Chicago, including daylight-saving transitions. RSVP remains Going, Maybe and Not Going. Its count means intent, not attendance. Keep voice-presence samples and approved event records separate. A small confirmation should be announced after an RSVP, with errors visibly distinct from success and no false optimistic count after a failed save.[13](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

### Administration: a workbench, not another exhibition

Overview should answer three questions: what is waiting, what happens next, and what failed. Make review queues, today's events and recent audit changes immediately reachable. Use plain surfaces, stable columns, visible search, concise labels and predictable save/cancel controls. Keep decoration out of dense forms.

Members should be the single place to edit a person, change a rank, grant medals and select a detachment. Artwork should only manage the reusable rank, medal and detachment definitions. Reviews should contain one master list and one selected item, with the submitter, event/category, round totals and proof visible before Accept or Deny. Keep destructive removal separate from rejection, with clear confirmation where the existing workflow permits removal.

For proof, provide a thumbnail, full-size viewing and an explicit unavailable state. Keep round numbers next to the corresponding image. Loading failure must not look like “no proof submitted”. The thumbnail and decision controls should remain together during review so staff do not lose the selected member after returning from an external image.

The audit display can remain capped at 75 records with 25-row pagination. That frontend limit does not prove database retention. Staff-save success should not silently hide an audit failure. Any change to backend retention or transactional review logic must be separately implemented and verified without losing current records.

## Prioritized source audit

These are reproducible source findings, not a complete production incident assessment. Paths are relative to the repository. Line positions may shift as parallel work lands.

| Priority | Finding and evidence | Required correction |
| --- | --- | --- |
| P1 | `Calendar.tsx` stores `selected` as an event object, but RSVP updates only replace entries in `events`. The open detail can show stale counts. | Store selected ID and derive the current event, or update both from one source. Test repeated Going/Maybe/Not Going changes. |
| P1 | Calendar dates, query boundaries and displayed times use browser-local `Date` methods; Admin event creation explicitly describes the device timezone. | Use one Chicago date/time contract for display, grouping and conversion, not a text-label-only fix. |
| P1 | Calendar month loads have no cancellation or generation guard. Count and personal-RSVP query errors are ignored. | Ignore superseded requests and distinguish failed data from true zero counts. |
| P1 | `Admin.tsx` renders two evidence-review interfaces for the same tab, around the original lines 976 and 983. Both expose decisions. | Consolidate into one filtered queue and one report detail without losing round editing or proof links. |
| P1 | `Admin.tsx` calls `deploy_weekly_content` inside its load routine. `Home.tsx` also calls it during weekly loading. | Treat these routes as potentially mutating in live tests. Review publishing ownership before removing the calls; do not break the existing weekly schedule casually. |
| P1 | `combatStats.ts` filters combat submissions by period but retrieves attendance and voice hours all-time. Filtered combat is based on submission creation time. | Label periods honestly until a unified approved event-period aggregation is verified. Never present mixed periods as one weekly total. |
| P1 | The same stats helper calculates attendance percentage over all RSVP rows, including responses that may concern future events. | Define an eligible completed-event denominator from the approved attendance contract. RSVP intent must not become voice attendance. |
| P1 | Several Admin staff mutations write the audit entry asynchronously after the main action; failure only logs a warning. | Surface audit failure and plan an atomic server-side operation where required. A new visual design cannot guarantee the audit trail. |
| P2 | Calendar displays 42 dates but queries only the selected month. Adjacent-month cells can appear empty incorrectly. | Fetch the visible interval or clearly disable out-of-month cells; test month boundaries. |
| P2 | Event kinds appear as raw stored strings in detail views; only three types appear in the legend. | Shared readable type labels, neutral fallback and filtering for all supported kinds. |
| P2 | `Roster.tsx` filters by `firstYear`, excludes 2017/CSGO records, and lacks explicit sorting or pagination. | Preserve intentional scope until confirmed; use evidence-year overlap, compact paging and clear filters. Do not silently reintroduce excluded records. |
| P2 | Roster footer says names open member pages, while the rendered name is a span. The header says Year joined although cells use evidence spans. | Correct the copy and interaction together; preserve the working record expander. |
| P2 | `PlayerProfileMock.tsx` includes Discord identity, Awaiting assignment, Staff assignments and RSVP-based attendance wording. | Remove unwanted modules/copy in the approved concept, preserving underlying rank/medal records and data provenance. |
| P2 | Admin fetches 50 recent events and 200 gallery records without visible pagination of the underlying queries. | Do not label these as complete all-time inventories; add server-backed paging or explicit scope. |

## Quality and acceptance gates

The site should feel responsive because actions are immediate and state is clear, not because everything moves. Use short transitions for hover, selection and reveal. Respect reduced-motion preferences, remove unnecessary parallax when motion is reduced, and offer a pause for automatically rotating media. W3C distinguishes interaction-triggered motion from automatically starting motion; both need appropriate controls.[14](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) [15](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)

Aim for comfortable 44-pixel controls in the new interface. WCAG 2.2's AA minimum is 24 by 24 CSS pixels or qualifying spacing/exceptions, so 44 pixels is a deliberate usability target, not a claim about the minimum standard.[16](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) Keep visible keyboard focus, semantic headings, labelled filters and focus return after dialogs close.

Measure performance, not just build success. The current Core Web Vitals guidance identifies good thresholds of LCP at 2.5 seconds or less, INP at 200 milliseconds or less and CLS at 0.1 or less, assessed at the 75th percentile. Treat these as release targets, not achieved measurements.[17](https://web.dev/articles/vitals) Use responsive image exports, reserve image dimensions and lazy-load below-fold art. Do not ship full green masters in the member page payload.

Release order should be: fix deterministic layout/data-display defects, review landing and profile concepts, implement the chosen composition, complete workflow tests, then approve publication separately. Test guest/member/staff access, long names, missing artwork, zero and ten medals, unknown stats, failed proof images, empty calendars, month boundaries, narrow screens, keyboard-only use and reduced motion. Live Discord RSVP, production uploads, audit retention and database behavior remain separate verification gates. A successful local build does not prove them.

## Sources

1. Regiment Control. [Product overview](https://regimentcontrol.com/). Public content retrieved 12 September 2026; dashboard shell inaccessible beyond Loading.
2. 29th Infantry Division. [Homepage](https://www.29th.org/). Retrieved 12 September 2026.
3. 29th Infantry Division. [Roster](https://www.29th.org/roster). Retrieved 12 September 2026.
4. 29th Infantry Division. [Member profile: Col. Wheatley](https://www.29th.org/members/wheatley). Retrieved 12 September 2026; page carries 2025 footer and cached content may be older.
5. 7th Cavalry Gaming. [Homepage and current community announcements](https://7cav.us/). Retrieved 12 September 2026.
6. Third Infantry Division. [Homepage](https://www.3rdinf.us/). Retrieved 12 September 2026.
7. Third Infantry Division. [Calendar](https://www.3rdinf.us/calendar). September 2026 view, retrieved 12 September 2026.
8. 506th Infantry Regiment Realism Unit. [Homepage](https://506thir.net/). Retrieved 12 September 2026.
9. 506th Infantry Regiment Realism Unit. [Operations](https://506thir.net/operations/). Retrieved 12 September 2026.
10. MDN Web Docs. [CSS aspect-ratio](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/aspect-ratio). Retrieved 12 September 2026.
11. MDN Web Docs. [CSS object-fit](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit). Retrieved 12 September 2026.
12. W3C WAI. [Understanding SC 1.4.1: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html). Retrieved 12 September 2026.
13. W3C WAI. [Understanding SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html). Retrieved 12 September 2026.
14. W3C WAI. [Understanding SC 2.3.3: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html). Updated 16 September 2025; retrieved 12 September 2026. This is a Level AAA criterion.
15. W3C WAI. [Understanding SC 2.2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html). Retrieved 12 September 2026.
16. W3C WAI. [Understanding SC 2.5.8: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Retrieved 12 September 2026. This is a Level AA criterion.
17. Google web.dev. [Web Vitals](https://web.dev/articles/vitals). Retrieved 12 September 2026.

Local evidence: `site/src/views/Admin.tsx`, `Calendar.tsx`, `Home.tsx`, `PlayerProfileMock.tsx`, `site/src/components/Roster.tsx`, `EventTypeIcon.tsx`, `site/src/lib/combatStats.ts`, `site/src/event-type-icons.css`, `docs/living-hq/MUSEUM-DESIGN-PLAN.md`, the supplied transparent crest and the approved project constraints. Local source inspection is not a substitute for authenticated production testing.
