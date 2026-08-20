# Coldstream Gaming site

The community website: Steam sign-in, roster, chat room, servers, The Archive.
React + Vite + Supabase. Runs in demo mode (no backend) out of the box.

```
npm install
npm run seed   # regenerates src/seed from ../coldstream-research
npm run dev    # http://localhost:5340
```

Backend setup: apply db/0001_init.sql then db/0002_seed.sql to a Supabase
project, deploy supabase/functions/steam-auth with SITE_URL, SB_URL and
SB_SERVICE_ROLE_KEY secrets, then set VITE_SUPABASE_URL and
VITE_SUPABASE_ANON_KEY in .env.

Rules: no em dashes anywhere, gaming community never club, years not era
counts, every archived item labeled with its source.
