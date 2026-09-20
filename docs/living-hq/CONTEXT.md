# Living HQ rebuild

Working context, 11 September 2026. Design and copy are a local draft for review.

UPDATE: River subsequently rejected the golden-hour direction and requested original museum-inspired imagery based on the supplied rank artwork and Desktop/Bannerforge/Imagery Ref for AI. MUSEUM-DESIGN-PLAN.md is now the controlling visual plan. Older landscape-preservation notes below are superseded. Implementation is paused for the requested planning step; no new imagery or production release is complete.

## Decided in the Website conversation

Coldstream is a gaming community established in 2011. Preserve the existing crest, engraved wordmark, golden-hour landscape, Cormorant Garamond and Satoshi. Use navy, cream, brass and small crimson accents. Holdfast is central; Minecraft and Valheim remain represented. The weekly player stays static in size with playback controls and a compact top-left caption. Rank and medal art uses the existing transparent assets. Player names remain live text. Events retain blue Public Server, green Linebattle and crimson Competitive categories.

Discord controls identity and staff roles. Steam linking is not required. Member HQ, events, stats and service records remain member-gated per the earlier conversation. Public archive/gallery access already exists in git. Retain it. Staff mutations remain in the Command Board, including proof review, members, artwork, events, attendance, weekly/gallery submissions and the 75-entry audit view. Never replace data with invented activity.

## Existing implementation and current verification

Vite, React 18, TypeScript and Supabase. Cloudflare serves the committed root bundle. Source lives in site/. On inspection the source checkout contains weekly ranking work beyond origin/main. Retain it. The live entrance is still a full-screen landscape/crest with two buttons; Bannerforge uses a persistent compact header, large serif hero, restrained destination cards and dark editorial bands. Both live sites inspected in the browser.

The existing homepage fetches approved statistics, weekly content and upcoming events. Profiles fetch assignments, company, artwork and combat/voice-hour aggregates. Gallery merges seed/archive data with approved member uploads, with filters, uploads and a keyboard lightbox. Archive owns historical roster, timeline and films. Admin contains real mutation handlers and role checks. The existing Home header incorrectly hardcodes Volunteer / Line Infantry; replace with its already-loaded rank and detachment. Archive displays an unsupported 1227 events; use the bundled summary's 362 with provenance.

Status script: domain and Discord sync healthy; unrelated house-rules workflow failure and stale server/presence schedules reported. These are pre-existing operational findings, outside this visual rebuild. Weekly view migration 0046 is recorded as not applied in the preceding handoff; runtime verification is still needed. No SQL is required or applied by this design work.

## Reconciliation and open items

The brief's public events/leaderboard proposal conflicts with prior member-access decisions. Keep those gates. Keep hash routing and add aliases rather than change OAuth callback URLs or hosting. /iceberg, /recovery and /vector have no feature implementations in site/src; do not invent them from dependency-bundle strings. Existing archive roster is historical, not the Discord member catalogue. Expose it as a historical roster and retain staff member management. No new identity workflow.

Regiment Foundry directory supplied earlier is absent. Desktop/Bannerforge exists, but the attached brief explicitly targets Coldstream; work is in the Coldstream repository.

## Route and feature matrix

| Existing | Alias / destination | Access | Preserved capabilities |
| --- | --- | --- | --- |
| /, #/landing | Public front page | Public; members land in HQ | Existing crest/wordmark/stills, join, Discord login; new destinations, game and archive bands |
| #/home | #/brief, /brief | Member | Weekly player, upload, upcoming events, statistics, top players, activity |
| #/events | /events | Member | Month/day navigation, category legend, details, RSVP |
| #/leaderboard | /leaderboard | Member | Category ranks, podium assets, named rows; existing aggregate contracts |
| #/gallery[/id] | #/media[/id], /media[/id] | Public read, member submit, staff moderate | Search, tags, people, sort, uploads, films, lightbox, deep links |
| #/archive | #/history, /history | Public | Historical eras, evidence links, films, historical roster |
| #/members | Unchanged archive alias | Public | Existing historical roster destination |
| New #/roster | /roster | Member | Existing historical roster component; clearly labelled historical |
| #/profile, #/player-profile | /profile | Member | Discord identity, rank, medals, detachment, stats, voice hours |
| #/member/:key | Unchanged | Existing archive person access | Profile record and its existing data rules |
| #/admin | /admin | Admin/moderator | All current tabs, mutation handlers, proof links, audit limits |
| #/servers | /servers | Existing public access | Existing server page retained, no hosting assertions |
| New #/join | /join | Public | Three explanatory steps, Discord invite, existing sign-in |
| New #/login | /login | Public | Existing Discord sign-in action, unchanged token callback handling |
| #/progress | Existing progress site link | Public | Link to existing operational board |
| Unknown | Not-found page | Public | Clear return path; no accidental nested HQ shell |

Clean path aliases work once the host serves the SPA fallback. Hash links remain the canonical links so the current deployment continues working without hosting changes.

## Data and asset inventory

Routes above preserve view modules Home, Landing, Calendar, Leaderboard, Gallery, Archive, Profile, PlayerProfileMock, Admin and Servers. Supporting UI includes Roster, Ranks, ProfileLive, SteamGroups, Discord, DetachmentEmblem, EventTypeIcon, MediaGrid, MediaToolbar, UploadDrawer and PlateViewer. Libraries: auth/supa, asset, combatStats, content/data, media/gallery/image, games, steamLink, useLiveServers and rel. Generated seed records remain unchanged.

Auth uses Supabase Discord OAuth, discord-member-sync, persisted coldstream-discord-session, current role lookup and existing sign-out. Frontend environment names are VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY; values must not be copied into notes. Existing Edge Functions include discord-member-sync, progress-board and legacy steam functions. No new backend or realtime transport. No application channel subscription was found in site/src; bundled Phoenix code belongs to Supabase's dependency.

Data surfaces: member, company, personnel_item, personnel_assignment, personnel_audit, stat_submission, stat_round, stat_proof, stat_leaderboard, stat_leaderboard_week, stat_leaderboard_public_server_month, weekly_content_submission, gallery_item, event, event_rsvp, event_attendance, event_presence_roll, event_presence_window and the existing combatStats attendance queries. Preserve create_managed_event, manage_event, assign_personnel_item, remove_personnel_assignment, reorder_personnel_items, set_member_file, mark_attendance, record_audit, deploy_weekly_content and archive_expired_weekly_content. Storage: personnel-artwork, stat-proof and gallery. Admin queries/mutations are retained verbatim.

Keep all site/public and archive seed files. Use crest.webp, wordmark.webp, landing-desktop.jpg, landing-mobile.jpg, existing fonts, cloth/felt textures, detachment PNGs, podium PNGs, rank/medal plates, weekly-feature-frame-transparent.png, gallery images and video/memories. Existing films remain linked with their titles and dates. No crest regeneration, no generated historical imagery or counts.

## Build sequence and acceptance

Persistent shell and routes, public scene and destination bands, then member HQ and the interior design system for calendar/media/history/leaderboard/profile/roster/admin. Motion is opacity/translation, progressive-enhancement scroll reveal and subtle hero-only parallax. Reduced motion removes these effects. Check build and route/access tests, then browser review at desktop and phone widths, gallery keyboard navigation and staff gate. Demo review must be labelled and must not be presented as verified Discord login or live writes.
