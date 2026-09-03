# Orderly Room, mapped onto this stack

Read `ORDERLY_ROOM_SPEC.md` next to this file first. That is River's spec and
it is the source of truth for what v1 contains. This file is the other half:
what already exists here, what is genuinely missing, and the order to build it.

Two decisions were taken on 3 Sep 2026 and they override the spec where they
conflict:

1. **Built on this stack, not a fresh repo.** The spec asks for Next.js,
   Prisma, its own Postgres and its own bot. We already run Vite and React on
   Supabase with Discord OAuth working, plus Coldstream Guard. Building the
   spec as written would mean a second database, a second login and a second
   bot, with the roster living in both. Everything below keeps one of each.
2. **Single regiment, as specced.** No multi-tenant, and no seams left in for
   it either. If this is ever sold to another community it is a rewrite, and
   that was accepted knowingly.

## What already exists

More than the spec assumes. Roughly half of v1 is live.

| Spec | Here today | State |
|---|---|---|
| `User` + `Member` (§6) | `member`: discord_id, discord_username, display_name, avatar_url, role, auth_user_id, steam_id64 | Discord identity and OAuth work. No status, notes, enlisted date |
| Officer access gate (§4.2) | `discord-member-sync` edge function reads guild roles and sets admin, moderator or member | Working, and it is the spec's access rule already |
| `Rank` (§6) | `personnel_item` with kind `rank`: name, description, artwork, active, sort_order | No seniority, band, or Discord role mapping |
| Current rank | `personnel_assignment` with a unique index enforcing one live rank per member | Better than the spec's single FK. Keeps history |
| `Award` + `MemberAward` | `personnel_item` kind `medal`, same assignment table | No Discord role mapping |
| `AuditEvent` (§8.6) | `personnel_audit`: actor, action, member, item, detail | Only covers catalogue and assignments |
| `Event` (§6) | `event`: title, body, game, starts_at, duration_minutes, server_key, cancelled, historic | No type, no channel or message id |
| `EventRsvp` | `event_rsvp`: going, maybe, out | **No attended or no_show.** This is the gap behind the original attendance question |
| `Application` (§8.4) | `enlistment`: display_name, free text body | No structured answers, no review workflow |
| `Company` | nothing | New |
| `Setting` | nothing | New |
| `DashboardAdmin` | nothing | Role comes from Discord ids. An override table is only needed if someone must have access without the role |
| Bot | Coldstream Guard, private repo `coldstream-guard` | Needs the panels, buttons and commands in §11 |

## What is actually missing

Five things, in rough order of risk.

1. **Rank ladder with meaning.** `personnel_item` holds artwork, not structure.
   It needs `seniority`, `band`, `discord_role_id` and `is_default_recruit`
   before a promotion means anything beyond a picture.
2. **Writing roles back to Discord.** Everything today only reads from Discord.
   §8.2 wants promotion in the dashboard to change the member's Discord role,
   which needs Manage Roles, the bot's role sitting above the ranks it grants,
   and honest failure: the spec is explicit that a failed role change must not
   silently leave the database claiming the promotion stuck.
3. **Attendance.** `event_rsvp` records intent. Marking who actually turned up
   is the missing half, and it is the thing that started all of this.
4. **Applications as a queue.** `enlistment` is a free text post. §8.4 wants
   structured answers, a pending queue, and accept assigning the recruit role.
5. **Companies and settings.** Both new, both small.

## Build order

Each step ends somewhere usable. Nothing here needs the step after it to be
worth having.

1. **Migration 0027.** Rank ladder columns on `personnel_item`, `company`,
   `setting`, member status and notes and enlisted date, `attended` and
   `no_show` on the RSVP check constraint, and widening `personnel_audit` into
   a general audit table. One migration, no application code.
2. **Attendance.** Presence sampling in Coldstream Guard during an event, an
   approval card for admins afterwards, and the result on the member's profile.
   Answers the original question and proves the bot can write back before
   anything depends on it doing so.
3. **Rank ladder and Discord role write-back.** The structure page, then
   promotion changing the real role. Riskiest step, so it goes after the bot
   has been proven on something reversible.
4. **Roster and member file.** Mostly a rebuild of the existing Members tab
   with rank, company, status, notes and attendance on it.
5. **Applications.** Panel, modal, queue, accept assigns the recruit role.
6. **Companies, settings, audit page.** The remainder of §8.5 to §8.7.

## Open question for River

The spec calls the middle band `officer` throughout, and it is a band name that
ends up in the schema. The house voice rules say admin and moderator, never
officer. The rest of this database already says `moderator`. Worth settling
before 0027 rather than renaming a column later, the way `0000_role_rename`
had to.
