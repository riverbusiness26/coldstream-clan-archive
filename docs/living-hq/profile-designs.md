# Profile studies, 12 September 2026

Draft for approval. These are three full local profile concepts, not a replacement for the current member page.

## Recommendation

Choose **The display case**. The avatar remains familiar and the member name stays prominent. Rank and medals share one dark felt surface. A modest shoulder patch has a small contact shadow rather than a floating plaque. Compact figures sit alongside the display, not over the artwork. Attendance and community contributions have distinct meanings.

The other options are intentionally different in density:

| Direction | Composition | Best use |
| --- | --- | --- |
| The display case | Familiar horizontal member header; shared rank/medal display beside compact stats; contributions and rank history below | A member profile with visual pride and quick reading |
| The service dossier | Avatar and service history in a left column; honours above a horizontal stat record; attendance and contributions below | Longer records with room for context |
| The fieldbook | Compact identity row; horizontal rank/medal shelf; working tabs for combat, attendance and contributions | Short daily visits and smaller screens |

## Review controls

- Three concept buttons change the full layout without navigating away.
- The fieldbook's record buttons switch real sections rather than showing dead controls.
- Rank history expands in place. No invented progression dates are shown.
- **Artwork study** displays the supplied Colour Sergeant patch as an explicitly illustrative image, not a member's current rank. Medal silhouettes demonstrate position and spacing only. They are not new awards.
- **My record** is available only when a real member session and configured Supabase client are present. It reads existing data without modifying anything. It remains disabled in the offline demo.
- Real awarded medals can open an inline detail panel. Images use `object-fit: contain` so artwork is not clipped.

The three directions keep the user's avatar at approximately 68 to 86 CSS pixels. The shoulder-patch image box is approximately 110 by 165 to 144 by 216 pixels in the two larger designs, including the original image's transparent margin. The fieldbook uses a smaller patch. The existing source PNG was copied without regenerating or changing its artwork; it has genuine alpha transparency, verified from pixel statistics.

## Data contracts preserved

| Display | Existing source | Boundary |
| --- | --- | --- |
| Name and avatar | `Me.display_name`, `Me.avatar_url`; existing `DiscordAvatar` component | No separate identity panel or Steam link |
| Rank and medals | `personnel_item` + the member's `personnel_assignment` records | Technical table name retained; interface says ranks and medals, never assignments |
| Detachment | Member `company_id` -> company `name` | Read-only |
| Rank history | Dated rank records, including removed entries | Latest active rank is current; prior dates remain visible |
| Kills, deaths, K/D, MVPs, Top 5s | Existing `loadCombatStats`, all-time approved aggregate | No invented figures or new ranking formula |
| Voice hours | Existing `member_attendance_hours` via `loadCombatStats` | Displayed as hours and minutes, floored rather than rounded up |
| Events attended | Existing confirmed attendance state via `loadCombatStats` | RSVP intentions are not called attendance hours |
| Weekly feature count | Not yet connected in this concept | Needs a verified definition of a featured member appearance versus a submitted media item |
| Media contribution count | Not yet connected in this concept | Count approved member uploads/links after verifying the authoritative relationship |

The missing value marker is **N/R**, explicitly explained as not recorded, not zero. Request failures produce a visible message. Artwork-study statistics remain unavailable; no demonstration numbers or fake member history were created.

## Existing functionality not replaced

`PlayerProfileMock.tsx`, `Profile.tsx` and `ProfileLive.tsx` were read but not edited. Existing member editing, walls, profile routing, permissions, database writes and admin functions remain unchanged. The new route is for visual approval. The selected concept still needs a deliberate migration of those features before it can become the real profile.

## Files and mount

- `site/src/views/ProfileDesigns.tsx`, default export accepting `{ me: Me | null }`.
- `site/src/profile-designs.css`, automatically imported by the component; all styles scoped under `.profile-designs`.
- `site/public/museum/profile-studies/colour-sergeant.png`, exact copy of the user's supplied rank artwork.

Root mounts `<ProfileDesigns me={me} />` at the local-only `#/design/profile` route. No shared App, Home, global stylesheet, claims or HANDOFF files were changed by this lane.

## Copy options

Draft for approval, short: **Your rank. Your record. The moments you were part of.**

Draft for approval, fuller: **Your rank and awarded medals stay together with your approved results, attendance and the moments you have contributed to Coldstream Gaming.**

## Decisions after viewing

1. Pick a base layout, or combine the display case with the fieldbook's compact record tabs.
2. Decide whether the patch should be slightly larger or smaller after seeing it beside an actual avatar.
3. Decide whether medals show names continuously or reveal them on selection.
4. Confirm whether a weekly-feature count means submitted items featured, or staff-selected featured-member appearances. These should not be merged silently.
5. Confirm whether public profiles should show approved contribution totals, with moderation status restricted to the member and staff.

## Verification

`npm run build --prefix site` passed on 12 September 2026. TypeScript ran first, then Vite reported 131 modules transformed. This checks type safety but does not establish live data behavior.

`git diff --check -- site/src/views/ProfileDesigns.tsx site/src/profile-designs.css` exited zero. The new files contain no em dashes, external Steam links, identity panel or member-facing assignment text.

Sharp verified the source rank at 1024 by 1536 pixels with a four-channel alpha range of 0 to 255. The artwork was copied exactly, not regenerated or keyed again.

Browser verification is coordinated by root after mounting the local preview. Live member-data behavior has not been verified in the offline demo. No deployment, database mutation or Discord operation occurred.
