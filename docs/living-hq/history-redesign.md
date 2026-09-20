# History and historical roster, local review

Draft for approval. Implemented locally on 12 September 2026; not published.

## Direction

The history page leads with 2011 and a six-chapter timeline. Selecting an era changes the story and its verified film selection, rather than expanding another long page of repeated modules. The palette remains charcoal, ivory and subdued brass, with a small crimson detail. Motion is limited to a short chapter transition and image hover; reduced-motion preferences disable both.

The six community chapters follow PROJECT.md. These are not the separate four linebattle gameplay eras. Earlier approved story details are retained inside the appropriate chapters. Videos are assigned by known catalogue identity, not by turning a rounded YouTube age into an exact date. All 32 catalogue films remain accessible regardless of chapter selection.

The roster is a single compact browser. Name/previous-handle search, recorded-year and game filters, four sort orders, 25-name pagination and source expansion work against the existing bundled records. Selecting an era's people button applies a real date-range filter. This matches any dated source row in the range, not an inferred join date.

Profile navigation uses the existing `#/member/{person.key}` route, confirmed by the root agent. No Steam links are rendered. Records with a missing readable name remain available under “Name not preserved”; numeric identifiers are not used as display names or profile links. All original seed data remains unchanged.

## Concrete defects corrected

| Previous behaviour | Replacement |
| --- | --- |
| All people whose first year was 2017, or whose games included CSGO, were excluded. | No game or year is silently excluded. The 2017–2018 filter has 81 matching people from actual dated evidence. |
| “Year joined” described the earliest archive evidence, including inferred `firstYear` values. | “Dated evidence” comes only from `rosterEntries.year`; 11 people with no dated rows are labelled Undated. Ranges explicitly do not claim uninterrupted membership. |
| Era roster/video buttons opened “connected soon” text. | Real era filtering and actual film links, plus a complete searchable catalogue. |
| Roster was hidden inside another deep-archive accordion and then required another year selection. | One visible search/filter surface, one pagination level, sources expandable inline. |
| Text said names opened a member page, but they were unlinked spans. | Existing member routes are linked by readable person keys. |
| “Archive site” pointed back to `/#/archive`. | Misleading self-link removed. Original video/channel links and source descriptions remain. No unknown archive URL has been invented. |
| Rounded relative film ages could be misread as exact dates. | Counts are labelled archived, and exact source dates are not inferred from rounded ages. |

## Verification performed

- `npm run build --prefix site`: passed TypeScript then Vite, 132 modules transformed in the first integrated check.
- A later full-build recheck passed TypeScript but stopped on concurrent Admin work: `Could not resolve "../admin-redesign.css" from "src/views/Admin.tsx"`. Root was notified; the Admin file was not changed by this agent. A final integrated build is still required after the shared work completes.
- `git diff --check -- site/src/views/Archive.tsx site/src/components/Roster.tsx site/src/history-redesign.css`: no whitespace errors.
- Vite SSR loading of the actual Roster component, rendered with ReactDOMServer and checked using Node assertions: 25 initial rows, 16 pages, 384 archived names, no Steam href, no “Year joined”, member profile links present, era filtering returns the correct matching rows.
- Source integrity: 384 people, 596 source records and 32 films remain unchanged. 81 people have dated records in 2017–2018; 11 have no dated source rows.

## Browser review still required

The root agent holds the browser surface while other page work is integrated. It must review desktop and mobile layout, timeline changes, roster search/sort/next/previous/source expansion, record-to-profile navigation and the shared archive player. This report does not claim those interactions were browser-tested by this subagent.

Recommended review route: `http://127.0.0.1:4180/#/archive` in the local member preview.

No database migration, production write, authentication mutation, external post or deployment was performed.
