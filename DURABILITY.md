# Making this outlast us

This document lives in the repository rather than on any website, because a
plan for surviving companies should not depend on one.

## What actually kills sites like this

Not outages. Not hacking. Two things:

1. **Somebody stops paying.** A card expires, a person moves on, a renewal
   notice goes to an address nobody reads. The site does not break, it simply
   is not there one morning.
2. **A company pivots.** Photobucket held this community's screenshots hostage
   behind a sudden paywall. Enjin shut down and took the old site with it. Both
   were reputable. Neither asked.

This project exists because both of those happened. So the goal is not to pick
a company that will not fail. It is to be in a position where it does not
matter when one does.

## What is already right

**The archive is static files and JSON in a git repository.** That single fact
does more for its survival than any hosting decision:

- Any web host on earth can serve it. There is nothing to install and no
  database to restore.
- Anyone with a copy can bring the whole site back, forever, with no account
  and no permission.
- Plain JSON and JPEG are readable in fifty years. A proprietary export is not.

Keep it that way. Every time there is a choice between a clever platform
feature and a flat file in the repo, the flat file is what survives.

## The five layers

### 1. The domain

The one thing that cannot be recreated. If it lapses, someone else can take it
and every link ever posted points at them.

- **Register for ten years up front**, not one. It removes ten chances to
  forget.
- **Turn on auto-renew AND registrar lock.**
- **Put a second contact email on it** that is not only yours.
- Registrar: **Cloudflare Registrar** sells at wholesale with no markup and no
  upsells, currently around $10.50 a year for a .com, but it requires using
  Cloudflare's nameservers. **Porkbun** is a few pence more and simpler to run.
  Either is fine.
- Avoid registrars that discount year one and recover it at renewal. Namecheap
  advertises around $10.98 to register and $18.48 to renew. GoDaddy is worse on
  upsells.

### 2. The code and the data

- **GitHub** is the working copy.
- **Mirror to a second host.** Codeberg or GitLab, pushed on the same commit.
  Costs nothing and means a suspended account is an inconvenience, not a loss.
- **Software Heritage** archives public repositories with their full history,
  permanently and for free. Nonprofit, started by Inria in 2016, and working
  with UNESCO under its Memory of the World programme, with more than 130
  million projects already preserved. Submit the repo once at
  <https://save.softwareheritage.org>.
- **The GitHub Archive Program** exists for the same reason and picks up public
  repos without being asked.

### 3. Hosting

Static hosting is interchangeable, which is the point. Today it is GitHub
Pages, free and requiring no card at all, which matters more for longevity than
any feature. Cloudflare Pages and Netlify are equivalent and take an afternoon
to switch to.

Because there is no card, there is nothing to expire. That is the single most
durable property of the current setup.

### 4. The database, which is the weak link

Everything written **since** the site went up lives in exactly one place, on a
free tier, behind one login: forum threads and posts, gallery submissions, the
shoutbox, member accounts, events.

`.github/workflows/backup-database.yml` exports every table as JSON every
night. Once it is running, losing Supabase entirely costs at most a day.

**It is not running, and never has been.** As of 23 Aug 2026 it had run 59
times and succeeded zero times. Every run dies on its first step, the config
guard, so the export has never executed and nothing after step 2 has ever
been reached. Verified from the GitHub Actions API, not assumed.

This section previously said the export writes to `backup/*.json` in this
repo and needs one secret. Both were wrong, and the second one is why the
job kept failing while the docs looked satisfied. The export pushes to a
**separate private repository**, because this repo is public and writing
member identifiers, staff posts or unapproved uploads here would turn a
backup into a data leak.

It needs **three** things, all under Settings > Secrets and variables >
Actions, and it fails until all three are present:

| Name | Kind | What |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase service role key |
| `BACKUP_REPOSITORY_TOKEN` | Secret | Fine grained token that can write only to the private backup repo |
| `BACKUP_REPOSITORY` | **Variable**, not a secret | `owner/name` of that private repo |

`BACKUP_REPOSITORY` goes on the Variables tab, not the Secrets tab. Putting
it in the wrong tab leaves it empty and the guard fails exactly as if it were
never set.

The private repository has to exist and have at least one commit before this
can work: `actions/checkout` cannot check out a repository with no commits.

`BACKUP_REPOSITORY_TOKEN` is a fine grained token rather than a classic one
on purpose. A classic token's `repo` scope covers every repository on the
account, and this one is stored in a **public** repository's Actions secrets.
A fine grained token pinned to the backup repo with Contents: Read and write
can do exactly what the workflow needs, clone at step 3 and push at step 5,
and nothing else. Metadata: Read is added automatically and is required.

**Fine grained tokens cannot be set to never expire.** GitHub caps them at
366 days. That is this document's own failure mode, the one in the opening
section, wearing a different hat: not an outage and not a hack, just a
credential lapsing quietly while every dashboard stays green. Whatever expiry
you pick, the backup stops on that date.

Three ways to handle it, in order of how well they work:

1. **Put the expiry date in this file when you create the token**, and set a
   calendar reminder a fortnight before. Write it down here rather than only
   in a calendar, because this file is what survives.
2. `node scripts/status.mjs` will catch it within a day either way. It counts
   successful runs of the workflow, so an expired token turns the Backups
   line back to CHECK. That is a detector, not a fix, and it only helps if
   somebody runs it.
3. A GitHub App installation token does not expire the same way, and is the
   right answer if this keeps biting. It is more setup than it is worth for
   one nightly job today.

**Token expires:** not yet created, fill this in.

The service role key is used deliberately: it bypasses row level security,
which is the only way to back up the staff board and the unapproved uploads
as well. It is never printed, and GitHub masks both secrets in logs.

`.github/workflows/supabase-keepalive.yml` already stops the free project
pausing after seven days idle.

### 5. Copies in other people's hands

The most durable backup is the one you do not control.

- Put a copy of the repository on an external drive, and keep it somewhere that
  is not the same building as the computer.
- **Give copies to two or three members.** A zip of the repo is the whole
  archive. Somebody who was there in 2012 having a copy on their own machine is
  worth more than any paid service, because they have a reason to keep it that
  outlives any subscription.
- Submit the live site to the **Internet Archive** at
  <https://web.archive.org/save/> whenever it changes meaningfully. That is how
  the old sites were recovered in the first place, and it is the reason this
  project was possible at all.

## Succession

The failure nobody plans for. If one person holds the domain, the GitHub
account, the Supabase project and the Discord, then the archive has a single
point of failure and it is a person.

- Put at least one other trusted member on the GitHub repository as an owner.
- Write down where everything is and who pays for what. This file is a
  reasonable place.
- Say out loud who takes it over. It costs nothing and it is the difference
  between the record surviving and not.

## In order, if you only do some of it

1. Set the backup secret so the nightly export starts running. It is the only
   data not already safe.
2. Buy the domain for ten years, locked, auto-renewing.
3. Push a mirror to a second git host.
4. Submit the repo to Software Heritage and the site to the Internet Archive.
5. Hand a copy to two members who were there.
6. Add a second owner on the repository.

None of it is expensive. The domain is the only recurring cost, and everything
else on this list is free.
