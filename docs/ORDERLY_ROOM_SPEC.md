# Orderly Room — Product Specification

**Version:** 1.0  
**Date:** 2026-08-30  
**Status:** Ready to implement  
**Owner:** single private regiment (not a SaaS, not for resale)

Working name: **Orderly Room**.  
Display name in the UI should be configurable (e.g. “2nd Coldstream”).

This spec is the source of truth for v1. If a feature is not in this document, do not build it.

---

## 1. Purpose

Give officers one place to run a Napoleonic / Holdfast-style regiment:

- See who is in the unit
- Enlist recruits
- Post events and take attendance
- Change ranks without hunting Discord roles by hand
- Leave an audit trail

The Discord server remains the clubhouse. The dashboard is the orderly room.

## 2. Non-goals (v1)

Do **not** build:

- Multi-regiment / multi-tenant hosting
- Billing, Stripe, subscriptions, donate page
- Custom white-label bots per guild
- Mini-games, credits, leaderboards-as-arcade
- Foxhole ship tracking
- Kill-report queues and verification pipelines
- Public marketing site clone
- Administrator bot permission
- Mobile native apps
- AI features

Holdfast-specific kill sheets and weekly honour boards are **v2**, after roster + events are trusted.

## 3. Constraints

- One Discord guild, set in env (`DISCORD_GUILD_ID`)
- English UI
- Dark theme, muted military-admin look (ink, brass, slate). No neon SaaS chrome.
- Must run on a single small VPS or one Railway/Fly project
- Secrets only in env, never committed
- Officers use Discord OAuth; there is no email/password

## 4. Users and access

### 4.1 Discord-side ranks (examples, configurable)

| Band | Typical names | App role |
|---|---|---|
| Command | Colonel, Lt Colonel, Major | `command` |
| Officers | Captains, Lieutenants, NCOs you designate | `officer` |
| Enlisted | Privates, recruits, specialists | `member` |
| Applicant | not yet accepted | `applicant` |
| Unlinked | in Discord, not in roster | — |

Exact rank titles live in the `Rank` table. App permissions use **bands**, not title strings.

### 4.2 App permissions

| Action | command | officer | member | applicant |
|---|---|---|---|---|
| View own profile | yes | yes | yes | limited |
| View roster | yes | yes | yes | no |
| Edit member notes | yes | yes | no | no |
| Change rank / company | yes | command-only for officers; officers may promote within enlisted if configured | no | no |
| Create / edit events | yes | yes | no | no |
| Mark attendance | yes | yes | no | no |
| Review applications | yes | yes | no | no |
| Change rank ladder / role maps | yes | no | no | no |
| View audit log | yes | yes (own actions + promotions) | no | no |
| Manage dashboard access list | yes | no | no | no |

v1 access rule after OAuth:

1. User must be in `DISCORD_GUILD_ID`
2. User must have at least one Discord role listed in `OFFICER_ROLE_IDS` **or** be in the `DashboardAdmin` table
3. Command band = Discord roles in `COMMAND_ROLE_IDS`

Members do **not** need the dashboard in v1. Public-facing member features are Discord-only (RSVP buttons, apply button).

## 5. Architecture

### 5.1 Processes

1. **Web** — Next.js App Router (dashboard + `app/api/*`)
2. **Bot** — discord.js v14, long-running
3. **Database** — PostgreSQL
4. **ORM** — Prisma

Optional later: split API out of Next. Not in v1.

### 5.2 Auth

- Auth.js / NextAuth with Discord provider
- Scopes: `identify`, `guilds`
- Session strategy: JWT or database session; HTTP-only cookie
- After login: fetch guild member; reject if not in guild or lacking officer/command access
- Bot uses a **bot token**, never a user token

### 5.3 Discord application

Create **one** Discord application with:

- Bot user
- OAuth2 redirect: `{APP_URL}/api/auth/callback/discord`

Privileged intents:

- Server Members Intent (required for roster sync)
- Message Content Intent: **off** unless a later spec requires it

Bot permissions integer must **not** include Administrator. Required:

- Manage Roles
- Send Messages
- Embed Links
- Use Application Commands
- Read Message History
- Add Reactions
- Manage Messages (for updating panels)
- View Channels

Bot role must sit above recruit/enlisted roles and below senior staff.

### 5.4 Hosting

- Web + bot can be two processes on one machine
- Bot process must be always-on
- Health: `GET /api/health` returns `{ ok: true, bot: "ready"|"down" }`

## 6. Data model

```prisma
enum MemberStatus {
  applicant
  active
  reserve
  discharged
  banned
}

enum RsvpStatus {
  in
  out
  maybe
  attended
  no_show
}

enum ApplicationStatus {
  pending
  accepted
  denied
  withdrawn
}

model User {
  id            String   @id @default(cuid())
  discordId     String   @unique
  username      String
  globalName    String?
  avatar        String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  member        Member?
  applications  Application[]
  auditActions  AuditEvent[] @relation("Actor")
}

model Member {
  id           String       @id @default(cuid())
  userId       String       @unique
  user         User         @relation(fields: [userId], references: [id])
  rankId       String?
  rank         Rank?        @relation(fields: [rankId], references: [id])
  companyId    String?
  company      Company?     @relation(fields: [companyId], references: [id])
  status       MemberStatus @default(active)
  notes        String?      @db.Text
  enlistedAt   DateTime?
  dischargedAt DateTime?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  rsvps        EventRsvp[]
  awards       MemberAward[]
}

model Rank {
  id             String   @id @default(cuid())
  name           String
  abbreviation   String?
  seniority      Int      // higher = more senior
  band           String   // command | officer | enlisted | recruit
  discordRoleId  String?
  isDefaultRecruit Boolean @default(false)
  members        Member[]
}

model Company {
  id            String   @id @default(cuid())
  name          String
  tag           String?
  discordRoleId String?
  color         String?
  sortOrder     Int      @default(0)
  members       Member[]
}

model Event {
  id          String      @id @default(cuid())
  title       String
  description String?     @db.Text
  type        String      // linebattle | training | social | campaign | other
  startsAt    DateTime
  endsAt      DateTime?
  channelId   String?
  messageId   String?
  createdById String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  rsvps       EventRsvp[]
}

model EventRsvp {
  id        String     @id @default(cuid())
  eventId   String
  event     Event      @relation(fields: [eventId], references: [id], onDelete: Cascade)
  memberId  String
  member    Member     @relation(fields: [memberId], references: [id], onDelete: Cascade)
  status    RsvpStatus
  updatedAt DateTime   @updatedAt
  @@unique([eventId, memberId])
}

model Application {
  id          String            @id @default(cuid())
  userId      String
  user        User              @relation(fields: [userId], references: [id])
  answers     Json
  status      ApplicationStatus @default(pending)
  reviewedBy  String?
  reviewNote  String?
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
}

model Award {
  id            String        @id @default(cuid())
  name          String
  description   String?
  imageUrl      String?
  discordRoleId String?
  sortOrder     Int           @default(0)
  grants        MemberAward[]
}

model MemberAward {
  id         String   @id @default(cuid())
  memberId   String
  member     Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  awardId    String
  award      Award    @relation(fields: [awardId], references: [id])
  awardedBy  String?
  awardedAt  DateTime @default(now())
  note       String?
  @@unique([memberId, awardId])
}

model AuditEvent {
  id        String   @id @default(cuid())
  actorId   String?
  actor     User?    @relation("Actor", fields: [actorId], references: [id])
  action    String
  target    String?
  payload   Json?
  createdAt DateTime @default(now())
}

model DashboardAdmin {
  id        String @id @default(cuid())
  discordId String @unique
  note      String?
}

model Setting {
  key   String @id
  value Json
}
```

Seed v1 ranks with empty Discord role IDs for the implementer to fill:

- Colonel, Lt Colonel, Major (`command`)
- Captain, Lieutenant, Sergeant (`officer`)
- Corporal, Private, Recruit (`enlisted` / recruit)

Companies: start with one company named after the regiment; officers can add more.

## 7. Settings (stored in `Setting` or env)

Env (required):

```
APP_URL=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
COMMAND_ROLE_IDS=               # comma-separated
OFFICER_ROLE_IDS=               # comma-separated
NEXTAUTH_SECRET=
DATABASE_URL=
```

Env (optional):

```
ENLIST_CHANNEL_ID=
LOG_CHANNEL_ID=
EVENT_CHANNEL_ID=
REGIMENT_NAME=2nd Coldstream
```

Dashboard-editable settings (command only):

- Welcome message text
- Application questions (array of `{ id, label, required, type: text|short }`)
- Default recruit rank
- Whether officers may promote within enlisted band

## 8. Feature spec — v1

### 8.1 Roster

**Dashboard `/dashboard/roster`**

- Search by Discord name / nickname
- Filter by company, rank, status
- Table: avatar, name, rank, company, status, enlisted date
- Click row → member file

**Member file `/dashboard/members/[id]`**

- Discord identity (id, username, avatar)
- Rank, company, status (editable by permitted officers)
- Free-text notes
- Awards list
- Event attendance last 30 days
- Audit snippet for this member

**Bot**

- `/roster search <query>` — officer only, ephemeral card
- On `GuildMemberAdd`: if auto-welcome enabled, post welcome text in configured channel. Do **not** auto-enlist.

**Sync**

- Nightly + manual “Sync from Discord” button
- Creates/updates `User` from guild members
- Does not invent ranks; unknown members stay unassigned until an officer places them
- If a member leaves the guild, mark `status = discharged` (do not delete)

### 8.2 Ranks and companies

**Dashboard `/dashboard/structure`** (command only)

- CRUD ranks: name, abbreviation, seniority, band, Discord role
- CRUD companies: name, tag, role, sort
- Changing a member’s rank:
  1. Update DB
  2. Remove other mapped rank roles
  3. Add new rank role
  4. Write `AuditEvent` `rank.change`
- Same for company roles

If Discord role change fails (hierarchy), show the error and do not pretend the rank stuck. Keep DB and Discord in a best-effort transaction: prefer Discord success then DB, or roll back DB on Discord failure.

### 8.3 Events and attendance

**Dashboard `/dashboard/events`**

- Calendar / list of upcoming and past events
- Create: title, type, start, optional end, description, announce channel
- On create: bot posts embed + three buttons: In / Out / Maybe
- Officers can open an event and mark Attended / No-show after the fact
- Counts visible on the event page

**Bot**

- `/event create` with modal or options (officer)
- Button interactions update `EventRsvp` and edit the embed footer counts
- `/event who <event>` ephemeral list

Event types: `linebattle`, `training`, `social`, `campaign`, `other`.

### 8.4 Enlistment

**Discord**

- Persistent panel in enlist channel: “Apply to the regiment” button
- Modal with the configured questions (max 5 fields; Discord modal limits apply)
- Creates `User` if needed + `Application` pending
- Posts a short staff notification in log channel
- Applicant does not get enlisted rank yet

**Dashboard `/dashboard/applications`**

- Queue: pending / accepted / denied
- Accept:
  - `Member` created or set `active`
  - Default recruit rank + optional company
  - Discord recruit role applied
  - Application `accepted`
  - Audit `application.accept`
  - Optional DM: “You are enlisted.”
- Deny: status + note; optional DM

### 8.5 Awards (minimal)

- Command can define awards (name, optional role)
- Officer can grant/revoke on member file
- Grant adds role if mapped
- No public medal wall in v1

### 8.6 Audit

**Dashboard `/dashboard/audit`**

- Reverse chronological
- Filters: action, actor, date
- Actions at minimum:
  - `auth.login`
  - `member.update`
  - `rank.change`
  - `company.change`
  - `application.accept`
  - `application.deny`
  - `event.create`
  - `event.rsvp`
  - `award.grant`
  - `award.revoke`
  - `settings.update`

Never log tokens or raw OAuth responses.

### 8.7 Bot status

**Dashboard `/dashboard` home**

- Bot online / offline
- Guild name, member count
- Pending applications count
- Next 3 events
- Last 10 audit lines

## 9. UI pages (v1)

| Path | Who |
|---|---|
| `/` | Public stub: regiment name, “Officer login”, invite is not required |
| `/login` | Discord OAuth button + short terms note |
| `/dashboard` | Home |
| `/dashboard/roster` | Officers |
| `/dashboard/members/[id]` | Officers |
| `/dashboard/events` | Officers |
| `/dashboard/events/[id]` | Officers |
| `/dashboard/applications` | Officers |
| `/dashboard/structure` | Command |
| `/dashboard/awards` | Command define; officers grant from member file |
| `/dashboard/audit` | Officers |
| `/dashboard/settings` | Command |

No public marketing feature grid.

Visual rules:

- Dark background `#181a21` or similar slate
- One accent (brass / muted gold)
- System font stack or a single serif for headings
- Tables first, cards second
- Every destructive action needs a confirm

## 10. API (Next.js route handlers)

All `/api/*` except `/api/health` and NextAuth routes require an officer session unless noted.

Suggested routes:

```
GET    /api/health
GET    /api/me
GET    /api/roster?q=&rankId=&companyId=&status=
GET    /api/members/:id
PATCH  /api/members/:id
POST   /api/sync/discord
GET    /api/ranks
PUT    /api/ranks
GET    /api/companies
PUT    /api/companies
GET    /api/events
POST   /api/events
GET    /api/events/:id
POST   /api/events/:id/attendance
GET    /api/applications
POST   /api/applications/:id/accept
POST   /api/applications/:id/deny
GET    /api/awards
POST   /api/awards
POST   /api/members/:id/awards
DELETE /api/members/:id/awards/:awardId
GET    /api/audit
GET    /api/settings
PUT    /api/settings
```

JSON errors: `{ "error": "string" }` with proper HTTP codes (401, 403, 404, 409, 422).

## 11. Bot commands (v1)

| Command | Access | Behavior |
|---|---|---|
| `/apply` | anyone in guild | Opens same modal as panel |
| `/event create` | officer | Create + announce |
| `/event who` | officer | RSVP list |
| `/roster search` | officer | Lookup |
| `/member note` | officer | Append note |
| `/sync` | command | Trigger member ingest |

Buttons: enlist panel, event RSVP. No reaction-role cafeteria in v1.

## 12. Security

- Validate every dashboard write against session + band
- Confirm target guild on every bot action
- CSRF on cookie mutations (Next.js defaults)
- Rate-limit OAuth and apply modal (Discord already rate-limits; still cap accepts)
- Do not store `access_token` longer than the session needs
- Prisma parameterized queries only
- File uploads: none in v1 (award images are URLs)
- Log channel must not print application answers that look like contact PII if officers paste them; store answers in DB, show in dashboard

## 13. Acceptance tests

v1 is done when all of the following pass on a test guild:

1. Officer logs in with Discord and lands on `/dashboard`
2. Non-officer in the guild is rejected after OAuth
3. Non-member of the guild is rejected
4. Sync lists guild members on the roster
5. Command maps a rank to a role; promoting a test account changes Discord roles
6. Failed role change (bot too low) surfaces an error; rank is not silently desynced
7. Officer creates a linebattle; embed appears; In/Out/Maybe persist after bot restart
8. Applicant submits modal; row appears in applications; accept assigns recruit role
9. Deny does not assign recruit role
10. Promoting someone writes an audit row with actor + old/new rank
11. Bot process crash does not wipe DB; on restart, buttons still work (customIds stable)
12. `/api/health` works without auth

## 14. v2 backlog (explicitly later)

- Weighted promotion votes
- Medal application forms
- Holdfast kill reports + weekly honour board
- Company transfer requests
- Public roster page on the regiment website
- Suggestion box
- Attendance streaks
- Export CSV
- Multiple event announcement channels by type

## 15. Implementation order

1. Repo + env template + Prisma migrate + seed ranks  
2. Discord app checklist in README  
3. Auth gate  
4. Member sync + roster + member file  
5. Rank/company role mapping  
6. Events + RSVP buttons  
7. Applications  
8. Awards + audit + settings  
9. Deploy notes (systemd or Docker Compose: `web` + `bot` + `db`)

## 16. README requirements for the implementer

README must include:

- Create Discord application steps
- Intent checklist
- Role hierarchy warning
- `cp .env.example .env`
- `prisma migrate dev`
- How to run web and bot locally
- How to post the enlist panel (`/apply` or a one-shot command `/panel enlist`)

## 17. Naming in code

- Repo: `orderly-room`
- Bot username suggestion: `Orderly Room` (changeable)
- Package name: `orderly-room`
- Do not use “Regiment Control”, their client IDs, endpoint maps, or copy

## 18. Definition of done for the first PR

A stranger following the README can stand up a test guild and complete every acceptance test in section 13 without reading this spec twice.
