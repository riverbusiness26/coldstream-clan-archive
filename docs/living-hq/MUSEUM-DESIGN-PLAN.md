# Coldstream Gaming: The Living Regimental Museum
Draft for approval · 11 September 2026

## Controlling direction
UPDATE: River rejected green as a website theme colour after reviewing the first concepts. Restore the original Coldstream charcoal/black, brass, ivory and crimson visual identity with more modern composition, fluid motion and responsive interactions. No olive surfaces or green supporting bands. Green remains only where semantically required, such as existing Skirmisher insignia and the previously approved Linebattle event category. Original source brass token is #B08D57. The old palette table and green textile direction below are superseded by this update.

Two hero drafts and six original functional SVGs now exist in concepts/. They are not approved final assets: revise flag and crest using concepts/REFERENCES.md, and replace green decorative textiles with charcoal in the chosen image. Prototype colours and reveal/hover transitions have been updated locally, not deployed.

River has rejected the golden-hour landing treatment. This decision supersedes the sunset requirement in the earlier Astra brief and the first local redesign. Remove golden-hour imagery from the designed presentation. Keep Coldstream's crest, motto, approved rank designs and real community/archive media. Bannerforge is a reference for composition and interaction, not a second product to build or a source of assets to copy.

Current state: a first local shared-shell redesign exists on codex/living-hq-redesign. It is not a finished or published museum design. The first build and subsequent TypeScript check passed, but full responsive, populated-data and authenticated integration verification remains outstanding. No new imagery has been generated in this run. Implementation is paused at the user's request for this plan.

## What was inspected
- Coldstream and Bannerforge live pages, plus the actual Coldstream source and Bannerforge styles.
- All ten images in Desktop/Bannerforge/Imagery Ref for AI.
- River's attached red and green rank patches and artillery, grenadier and skirmisher presentation sheets.
- The referenced Bannerforge conversation. Its business/Foundry roadmap is not Coldstream's feature scope.

The image folder offers formation, character and battle-scene composition: marching redcoats, standards, ordered muskets, woodland fighting and powder smoke. Some references contain game/creator logos and include French subjects. Use them as visual references, not literal Coldstream artwork or verified historical uniforms.
The rank references establish the actual material language: deep red and green woven fields, pale braid, black cord, raised antique brass and restrained display borders.

## 1. Art direction
A regimental collection brought to life. Museum display craft with the presence of a gaming community.

Use two connected image families:
1. Exhibition surfaces: near-black wool, deep red cloth, dark green cloth, restrained braided edging, brass fittings and small artifact details.
2. Original campaign illustrations: British line-infantry scenes under overcast light, powder-grey atmosphere, desaturated terrain and selective crimson. Painterly realism with enough detail to reward a closer look, without pretending generated art is an archival photograph.

No orange sunsets, sepia wash across everything, neon accents, noisy texture behind body text, giant floating medals, random fantasy heraldry, copied game logos or generated text.
Preserve original archive media without recolouring the historical record. Keep decorative illustrations outside the chronological evidence collection.

### Proposed palette
| Role | Colour | Hex | Use |
| --- | --- | --- | --- |
| Base | Museum charcoal | #101211 | Page ground and quiet negative space |
| Raised surface | Blackened olive | #1B211D | Panels and display mounts |
| Primary accent | Regimental crimson | #781F2B | Primary actions and selected states |
| Secondary accent | Rifle green | #243F32 | Supporting bands, detachment context |
| Metal | Aged brass | #B89B65 | Hairlines, icons, trim |
| Text | Warm ivory | #EEE4D1 | Headings and body text |
| Secondary text | Stone | #B6B0A4 | Supporting information |

Use approximately 75% dark neutrals, 15% ivory/stone, 10% coloured/metal accents. Treat these as starting tokens, then verify actual text contrast, focus and hover states. Do not use dark crimson as small text on charcoal.

Event semantics remain distinct: Public Server blue, Linebattle green, Competitive crimson, always paired with labels/icons. Do not make error/success/event meaning depend on colour alone.

Cormorant Garamond remains the display face; Satoshi remains the reading/UI face. Body copy should be comfortably readable, not tiny museum-label text.

## 2. Landing-page composition
One original hero scene, not a collage of six unrelated styles.

Recommended hero: an exhibition-inspired composition of British line infantry and a standard emerging from a dark, overcast campaign scene. Concentrate the figures to the right; leave a naturally quiet charcoal/grey field for live text on the left. Use deep crimson uniforms, ivory straps and controlled brass highlights. Subtle cloth texture ties the scene into the surrounding page. No generated crest or text. Overlay the existing crest as a separate crisp asset.

Hero content: Coldstream Gaming, Second to none, one short introduction, Join the Coldstream, Continue with Discord.

Below the hero:
1. A compact, source-labelled community record strip.
2. Six destination cards: Events, Leaderboard, History, Media, Join, Member HQ.
3. A weekly brief teaser with a clear member-access action.
4. Holdfast, Minecraft and Valheim cards with matching illustration treatment.
5. A real archive/media selection.
6. A short Discord invitation and restrained footer.

Footer requirement: include the exact text "Powered by Bannerforge Studios" beneath the copyright, in small muted type. Keep it readable but secondary, with no logo, animation or promotional block. Use the shared footer across public and member pages.

Members still land in HQ, not on the public entrance. Preserve current access gates and all old hash links.

## 3. Original imagery production list
Approve the style using two hero concepts before producing the full family:
A. Campaign portrait: an overcast regimental scene integrated into a dark exhibition surface.
B. Display cabinet: cloth, standard, brass and uniform detail, with no battlefield panorama.

Recommend A for the public hero and B as the material language for interiors.

| Asset | Intended placement | Master / export target | Composition requirement |
| --- | --- | --- | --- |
| Desktop hero | Public landing | 3840×2160 master, 1920/1280 web variants | Quiet copy area; crest separate |
| Mobile hero | Public landing | 1440×2160 portrait master, 960/640 variants | Recompose subjects; no blind centre crop |
| Muster scene | Events heading / event overview | 2400×1000 master | Orderly formation, restrained smoke, quiet title area |
| Archive illustration | History introduction | 2400×1000 master | Record-room/old campaign atmosphere; no invented labels |
| Media illustration | Gallery introduction | 2400×1000 master | Subdued regimental scene; small vertical footprint |
| Community/join scene | Join and recruitment band | 2400×1000 master | Shared company rather than lone heroic figure |
| Service-record surface | Profiles | 2000×1400 master | Quiet cloth mount for actual rank and medal PNGs |
| Holdfast card | Games row | 1200×900 master | Original redcoat/formational composition |
| Minecraft card | Games row | 1200×900 master | Building/exploration with the same restrained palette |
| Valheim card | Games row | 1200×900 master | Northern woodland/longboat feel with matching lighting |
| Cloth material family | UI backgrounds | Three 1024-square masters | Charcoal, crimson, rifle green; low-frequency detail |
| Ornament family | Major section breaks only | Vector or alpha-enabled masters | One thin divider, four corners, one subtle braid |

These are production targets, not claims about generated resolution. Inspect each actual output and avoid representing an upscaled file as newly recovered detail. Final file sizes are measured and tuned per placement; do not serve 4K masters to phones.

Generated assets contain no UI, labels, dates or player names. All editable information stays in HTML. Decorative frames cannot define a fixed content height or cover a player, button, caption or neighbouring column.

## 4. Original icon system
Build a Coldstream-owned family, not a collection of mismatched downloaded glyphs.

Two detail levels:
- Functional icons: deliberately drawn SVGs on a 24px grid, tested at 16, 20, 24 and 32px. Consistent strokes, clipped corners and a restrained engraved/brass character. Inherit colour from the interface.
- Display emblems: richer transparent artwork for destination cards and event categories, designed for 64–128px presentation. Do not reduce detailed medal art into a 16px search button.

Initial functional set: Events, Leaderboard, History, Media, Members, Profile, Join, Staff, Upload, Search, Notifications and Attendance. Keep arrows, close and playback actions immediately recognisable.
Event emblem family retains Public Server, Linebattle and Competitive meanings and the approved blue/green/crimson coding.

Deliver separate labelled files, never a single sheet as the production asset. Test transparent edges on charcoal, crimson, green and ivory. Preserve real alpha; no painted checkerboard, black rectangles or pale halos.

Do not regenerate actual assigned rank badges, the crest or existing medal identities merely to make the UI match. The mounts and surrounding materials should match them.

## 5. Motion and genuine activity
Motion should reveal hierarchy, not compete with the content:
- Shared header remains mounted; a small background/blur change after scrolling.
- Hero layers enter once: crest, heading, actions. Short stagger, gentle rise.
- Major sections fade/rise as they enter view; cards lift 2–3px on hover/focus.
- Active controls ease between states; filters show deliberate loading feedback.
- Gallery supports keyboard navigation, swipe, close and restored focus.
- No scroll hijacking, cursor trails, constant glitter, flashing crowns or obligatory sound.
- Reduced-motion mode removes parallax and nonessential movement.
- Keep admin workflows stable; do not animate rows away while staff are reviewing them.

The site feels alive because the records change:
- Next scheduled event with accurate date/time.
- Approved weekly media rotation.
- Weekly top-player results using the existing approved aggregate.
- Recent promotions, medals, new members and events only where a real, permitted source is connected.
- Visible loading, empty, failure and stale states. Never invent names, victories, activity counts or server status.

Do not label polling as instant realtime. Confirm update sources and freshness before promising live behaviour. Keep private staff notes, proof and audit activity out of public feeds.

## 6. Member HQ and interior application
Carry the same materials through every page, with less decoration where information is dense.
- Weekly player: static size, complete video visible, working controls, compact top-left caption. Frame stays outside the playback rectangle. No hover expansion.
- Profile: actual rank subtly stitched into its cloth mount; medal collection in a responsive row/grid; names and dates remain text. No stretched artwork.
- Leaderboard: approved podium assets, real player names, aligned numeric columns, clear period/category controls. Attendance cannot masquerade as Top 5s.
- Events: compact readable month grid, visible event labels, phone day/list detail, category legend, preserved RSVP.
- Gallery: images remain uncropped in the full viewer; preserve search, tags, people, sort, submissions and moderation.
- History: editorial timeline and actual recovered records. No fabricated era counts, no return of unwanted era-header graphics.
- Admin: coherent side navigation, generous form spacing, clear review actions, correct artwork containment. Keep every existing tool and mutation.

## 7. Build and approval order
1. Direction board: palette, type, materials, two hero directions and a small original icon sample. Approval checkpoint.
2. Hero proof: one desktop composition and its phone counterpart, placed in the real page. Check actual text and crest legibility. Approval checkpoint.
3. Asset family: produce the remaining illustrations, material textures and icon variants using the selected hero as the style anchor. Keep a manifest of prompts, references, output dimensions and destinations.
4. Public page: finish the landing, destinations, join flow and preview bands. Test on phone and desktop.
5. Member system: complete HQ, profiles, calendar, leaderboard, gallery, history, roster and staff screens with preserved data contracts.
6. Verification: route/auth/role tests, loading/empty/error states, long names, zero and ten medals, tall rank patches, populated calendar, keyboard/swipe, reduced motion and upload/proof viewing.
7. Release candidate: production build and an explicit local preview. Owner review, then separately authorised Cloudflare publication and live checks.

Generate one style anchor first. Do not batch a dozen unrelated images and attempt to repair the palette afterwards.

## 8. Acceptance checks
- No golden-hour hero or fallback scenery remains in the new designed surface.
- Original crest and assigned artwork remain recognisable and unmodified.
- No text baked into generated art; headings, names and dates remain selectable.
- No black extraction rectangles, alpha holes in metal, clipped ranks or overlapping controls.
- Body text contrast and keyboard focus remain visible on every background.
- Responsive images load the appropriate variant; deferred artwork does not block the hero.
- No horizontal page overflow at 360, 390, 768, 1280 and 1920px.
- Old hash links, gallery deep links, login return and sign-out still behave correctly.
- Staff-only views and data remain staff-only. Demo data is clearly labelled.
- SQL, bot changes and live deployment are not bundled into visual approval.

## Next action
Create the two hero direction boards and a six-icon sample, then review them together in the actual landing layout. This is the next recommended production step, not completed generation.

## Report back
DONE: Design plan grounded in the ten local image references, rank artwork, live sites and current source.
VERIFIED: Reference files inspected; latest local TypeScript check exited 0.
UNVERIFIED: New imagery, complete responsive redesign, live Discord authentication and staff mutations.
BLOCKED: No technical blocker for concept generation; final art direction remains a review checkpoint.
NEXT: Produce and compare the two original museum-inspired hero concepts before generating the asset family.
