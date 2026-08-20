# Deploying the site

Five steps, in this order. Steps 1 and 2 are the ones that have to happen
before anything on the site works at all.

Everything here stays inside free tiers.

---

## 1. Run the database migrations

**This is the blocker.** Until it runs, every table returns 401 and the site
falls back to bundled seed data on every page, which looks fine and is not.

Supabase dashboard → **SQL Editor** → **New query** → paste the whole of
`db/RUN_ME_next.sql` → **Run**. Safe to run more than once.

It bundles four migrations:

| file | what it does |
| --- | --- |
| `0004_grants.sql` | grants the browser roles access to the tables. Row level security was switched on in `0001` and the policies were written, but no role was ever granted the tables. Postgres checks the grant before it looks at a policy, so everything came back 401. |
| `0005_forum_privacy.sql` | closes three holes: restricted boards were readable by any signed-in member, thread and post reads were `using (true)` so staff threads were readable straight off the REST API, and nothing enforced the posting bar or the thread lock. |
| `0006_shoutbox.sql` | puts `shout` in the realtime publication and trims the log to the last 200 lines. |
| `0003_gallery_storage.sql` | creates the `gallery` storage bucket and its policies, so member uploads have somewhere to land. |

Check it worked, from anywhere:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "apikey: sb_publishable_JvhNGgAid0KgMiAqul5lWw_aSrZj0Bo" "https://zcpbpcktinlqnxmqddzc.supabase.co/rest/v1/board?select=slug&limit=1"
```

`200` means done. `401` means it has not run yet.

---

## 2. Deploy the Steam sign-in function

Without this nobody can sign in, and without signing in nobody can post,
upload, or shout.

The function needs three secrets. **Supabase reserves any name starting with
`SUPABASE_`**, which is why these are prefixed `SB_`:

| secret | value |
| --- | --- |
| `SITE_URL` | the site's public address, e.g. `https://coldstream.vercel.app` |
| `SB_URL` | `https://zcpbpcktinlqnxmqddzc.supabase.co` |
| `SB_SERVICE_ROLE_KEY` | Settings → API → `service_role`. **Never put this in the repo, in Vercel, or in a chat window.** It bypasses row level security entirely. |

Then deploy it. Note the flag:

```bash
supabase functions deploy steam-auth --no-verify-jwt
```

`--no-verify-jwt` is not optional. Edge functions verify a JWT by default, and
Steam redirects the browser back to this endpoint with no JWT at all, so
without the flag every sign-in dies at the last step with a 401.

Then Supabase dashboard → **Authentication** → **URL Configuration** → add the
site's address to **Redirect URLs**. The sign-in finishes by sending the
browser to a one time link that redirects there, and Supabase refuses to
redirect anywhere not on that list.

---

## 3. Deploy the site to Vercel

Import `riverbusiness26/coldstream-clan-archive` at vercel.com/new, then:

- **Root Directory**: `site` (not the repo root, which is the archive)
- Framework preset, build command and output directory are read from
  `site/vercel.json`, so leave them alone.

Add two environment variables, for all environments:

| name | value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://zcpbpcktinlqnxmqddzc.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_JvhNGgAid0KgMiAqul5lWw_aSrZj0Bo` |

Both of these are public by design: they ship inside the site's JavaScript
either way, and every request they make is still gated by row level security.
They are not secrets and do not need hiding. The `service_role` key from step 2
is the opposite, and does not belong anywhere near Vercel.

`.env` is gitignored, so without these two set the build produces a site stuck
in demo mode with no backend at all.

If the deployed address is not what you put in `SITE_URL` in step 2, go back
and fix it, then redeploy the function.

---

## 4. Make yourself an admin

Everyone lands as `member`. After signing in for the first time, run this once:

```sql
update member set role = 'admin' where steam_id64 = '76561198044997257';
```

Admins and officers can moderate threads and clear gallery uploads. Promote
others the same way with `'officer'`.

---

## 5. Keep the database awake

Already handled: `.github/workflows/supabase-keepalive.yml` reads one row every
three days. A free Supabase project pauses after seven days with no database
activity, and an unpausing project is a dead site until somebody notices.

Nothing to configure. Check it under the repo's **Actions** tab after the first
run, or trigger it by hand with **Run workflow**. If it goes red with a 401,
step 1 has not been run.

---

## Rebuilding the seed data

The site ships with the archive baked in, built from the research repo:

```bash
node seed/build-seed.mjs ../
```

It writes `src/seed/*.json`, the gallery images under `public/gallery`, and
`db/0002_seed.sql` for the database. One caveat: the news items came from a
Wayback extraction pass whose source file is not in `data/`, so on any machine
without it the builder keeps what is already seeded rather than writing an
empty list over nine real posts.
