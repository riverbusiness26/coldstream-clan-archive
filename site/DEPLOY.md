# Making the site real

Five steps, in order. Steps 1 and 2 are the ones that turn a demo into a
working site. Everything here stays inside free tiers.

Project: `https://zcpbpcktinlqnxmqddzc.supabase.co`

---

## 1. Run the migrations

**This is the blocker.** Until it runs, every table returns 401 and the site
falls back to bundled seed data on every page, which looks completely normal
and is not.

Supabase dashboard → **SQL Editor** → **New query** → paste the whole of
`db/RUN_ME_next.sql` → **Run**. Safe to run more than once.

Nine migrations, and the order in that file matters:

| file | what it does |
| --- | --- |
| `0000_role_rename` | renames the `officer` role to `moderator` on a database that already has it. **Has to stay first**: everything after it names `moderator`, and a database created before the rename would reject that and fail the whole script. Does nothing on a fresh one. |
| `0004_grants` | grants the browser roles access to the tables. `0001` switched on row level security and wrote every policy but never granted the tables, and Postgres checks the grant *before* the policy, so everything 401'd. |
| `0005_forum_privacy` | restricted boards were readable by any signed-in member, and thread and post reads were `using (true)` so staff threads were readable straight off the REST API. |
| `0006_shoutbox` | puts `shout` in the realtime publication and trims the log to 200 lines. |
| `0003_gallery_storage` | creates the `gallery` bucket and its policies. No manual bucket step needed. |
| `0007_operator` | the separate back end login. |
| `0008_gallery_moderation` | who may remove a gallery item, and from storage. |
| `0009_gallery_categories` | gallery categories and video submissions. |
| `0010_events` | the events calendar and RSVPs. |

Check it worked, from anywhere:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "apikey: sb_publishable_JvhNGgAid0KgMiAqul5lWw_aSrZj0Bo" "https://zcpbpcktinlqnxmqddzc.supabase.co/rest/v1/board?select=slug&limit=1"
```

`200` means done. `401` means it has not run.

---

## 2. Create the back end login

The admin login is deliberately separate from Steam. An **operator** signs in
with email and password, is not on the roster, never posts, and exists only to
run the site.

**Authentication → Providers → Email**: make sure email is enabled, and turn
**off** the option allowing new users to sign themselves up. Nobody should be
able to create an account here; the only accounts are the ones you make.

**Authentication → Users → Add user → Create new user**:
- a real email address
- a password you choose (I never see it, and neither does the site's code)
- tick **Auto Confirm User**, or the account cannot sign in until someone
  clicks a confirmation email that was never sent anywhere useful

Copy the **User UID** from the users table, then in the SQL editor:

```sql
insert into operator (auth_user_id, label)
values ('PASTE-THE-UID-HERE', 'River');
```

That row is what grants the powers. An auth account with no matching operator
row can sign in and do precisely nothing, which is the intended failure mode.

---

## 3. Deploy the Steam sign-in function

Without this nobody can sign in with Steam, and without that nobody can post,
upload or shout.

Three function secrets. **Supabase reserves any name starting with
`SUPABASE_`**, which is why these are prefixed `SB_`:

| secret | value |
| --- | --- |
| `SITE_URL` | the site's public address, e.g. `https://coldstream.vercel.app` |
| `SB_URL` | `https://zcpbpcktinlqnxmqddzc.supabase.co` |
| `SB_SERVICE_ROLE_KEY` | Settings → API. This project uses the newer key format, so it is the **secret** key starting `sb_secret_...`, the one behind a Reveal button, not the publishable one. **It bypasses row level security entirely.** It belongs here and in the GitHub backup secret, and nowhere else: not in the repo, not in Vercel, not in a chat window. |

Then:

```bash
supabase functions deploy steam-auth --no-verify-jwt
```

`--no-verify-jwt` is not optional. Edge functions verify a JWT by default and
Steam redirects the browser back with none, so without the flag every sign-in
dies at the last step with a 401 that looks like a Steam problem and is not.

---

## 4. Allow the redirect

**Authentication → URL Configuration**: set **Site URL** to the site's address
and add it to **Redirect URLs**. Add `http://localhost:5340` too if you want
sign-in to work while testing locally.

Steam sign-in finishes by sending the browser to a one time link that redirects
back to the site, and Supabase refuses to redirect anywhere not on that list.

---

## 5. Make yourself an admin on the community side

Separate from the operator login. This is your identity as a member: it puts
the colonel's rank against your name and lets you moderate as yourself.

After signing in through Steam once:

```sql
update member set role = 'admin' where steam_id64 = '76561198044997257';
```

Promote others the same way with `'moderator'`. There are three roles: member, moderator and admin.

---

## Which keys are safe where

- **`sb_publishable_...`** (anon) is public by design. It ships inside the
  site's JavaScript, it belongs in Vercel, and every request it makes is still
  gated by row level security. It is not a secret.
- **`sb_secret_...`** (service role) is the opposite. It ignores row level
  security completely. It goes in exactly two places: the edge function secret
  in step 3, and the `SUPABASE_SERVICE_ROLE_KEY` repository secret that the
  nightly backup uses. Nowhere else.

---

## Already handled, nothing to do

- **The storage bucket** is created by `0003` in step 1.
- **Realtime** for the shoutbox is switched on by `0006` in step 1.
- **Nightly backups**: `.github/workflows/backup-database.yml` exports every
  table to `backup/*.json` in the repo. Needs the repository secret above.
  See `DURABILITY.md`.
- **Keeping the project awake**: `.github/workflows/supabase-keepalive.yml`
  reads one row every three days. A free project pauses after seven days idle.
  If it ever goes red with a 401, step 1 has not been run.

---

## Rebuilding the seed data

```bash
node seed/build-seed.mjs ../
```

Writes `src/seed/*.json`, the gallery images under `public/gallery`, the rank
insignia under `public/ranks`, and `db/0002_seed.sql`.
