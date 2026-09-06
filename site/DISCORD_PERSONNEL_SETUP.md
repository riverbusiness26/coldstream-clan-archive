# Discord personnel setup

The code is safe to publish only after the database, Discord provider and role
sync function are ready. Do these in order.

## 1. Discord application

Use the Coldstream Discord application in the Discord Developer Portal.

1. Copy the Discord callback URL shown in Supabase under Authentication,
   Sign In and Providers, Discord.
2. Add that exact URL under OAuth2 redirects in Discord.
3. Keep the bot in the Coldstream Discord server. The role sync uses the bot
   to read one signed-in member at a time.

Do not put the Discord client secret or bot token in this public repository.

## 2. Supabase authentication

Under Authentication, Sign In and Providers, enable Discord and enter the
Discord client id and client secret there.

The allowed redirect list must include:

- `https://coldstreamgaming.com/`
- the local development address used for an approved local OAuth test

## 3. Database

Apply `db/0024_discord_personnel.sql` once. It creates:

- Discord-ready member records
- the rank and medal catalogue
- staff assignments and removals
- the personnel audit log
- the closed evidence-submission foundation
- the public personnel artwork bucket with admin-only writes

## 4. Role sync function

Set these Edge Function secrets in Supabase:

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_ADMIN_ROLE_IDS`
- `DISCORD_MODERATOR_ROLE_IDS`
- `DISCORD_MEMBER_ROLE_IDS` (the current member role is also safely included in the function)

The role id values may be comma-separated. Deploy `discord-member-sync` with
JWT verification on. This function requires a signed-in Supabase user and
rejects people who are not members of the Coldstream Discord.

## 5. Proof before publishing

Test all three roles before the Command Board goes live:

1. An admin can upload PNG, JPEG and WebP artwork, then assign it.
2. A moderator can assign existing artwork and cannot upload a file.
3. A normal member cannot open the Command Board or change personnel data.
4. Replacing a current rank removes the former current rank in the same
   database operation.
5. Catalogue changes and assignments appear in the audit log.
6. The Evidence tab says intake is closed and no member can submit a claim.

Publishing the frontend before those checks would expose controls backed by
an incomplete live configuration. Keep the existing site live until the full
sequence passes.
