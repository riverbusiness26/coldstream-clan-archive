// Who is online right now, and what they are playing.
//
// GET /steam-presence?secret=...   fetches every member's Steam status and
//                                  writes it to steam_presence
//
// Why this exists as a function rather than in the browser: the Steam Web
// API sends no CORS headers, so a browser cannot call it at all, and the key
// must never reach a browser regardless. Doing it here also means one call
// to Steam serves every visitor, instead of one call per person looking at
// the page, which is what turns a tracker into a rate limit incident.
//
// GetPlayerSummaries takes up to 100 ids per request, so the whole community
// is one call until there are more than a hundred linked accounts, and two
// after that. The cost does not grow with traffic, only with membership.
//
// Configuration, all already set for steam-sync:
//   STEAM_API_KEY   the Web API key. Never leaves this function.
//   SYNC_SECRET     shared secret, so only our scheduler can trigger a run.
//   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.

import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  ?? Deno.env.get("SB_SERVICE_ROLE_KEY")!;
const STEAM_KEY = Deno.env.get("STEAM_API_KEY") ?? "";
const SYNC_SECRET = Deno.env.get("SYNC_SECRET") ?? "";

const admin = createClient(SB_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface Summary {
  steamid: string;
  personaname?: string;
  avatarmedium?: string;
  personastate?: number;
  communityvisibilitystate?: number;
  gameextrainfo?: string;
  gameid?: string;
}

const chunk = <T>(xs: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // A shared secret rather than a JWT, because the caller is a scheduler and
  // not a person. Compared after both are known to be non empty, so an unset
  // secret cannot accidentally authorise everyone.
  const given = url.searchParams.get("secret") ?? "";
  if (!SYNC_SECRET || given !== SYNC_SECRET) {
    return new Response("no", { status: 401 });
  }
  if (!STEAM_KEY) {
    return Response.json({ ok: false, error: "STEAM_API_KEY is not set" }, { status: 500 });
  }

  // Everyone who has ever signed in through Steam. The member row is created
  // by steam-auth, so this is exactly the set of linked accounts.
  const { data: members, error: mErr } = await admin
    .from("member")
    .select("steam_id64")
    .not("steam_id64", "is", null);

  if (mErr) {
    return Response.json({ ok: false, error: mErr.message }, { status: 500 });
  }

  const ids = (members ?? []).map((m) => m.steam_id64 as string).filter(Boolean);
  if (ids.length === 0) {
    return Response.json({ ok: true, members: 0, note: "nobody has linked Steam yet" });
  }

  const rows: Record<string, unknown>[] = [];
  const now = new Date().toISOString();

  for (const batch of chunk(ids, 100)) {
    const api = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/"
      + `?key=${STEAM_KEY}&steamids=${batch.join(",")}`;

    let players: Summary[] = [];
    try {
      // Steam goes down, rate limits, and occasionally returns HTML. None of
      // those should take the whole run with them, so a failed batch is
      // skipped and the previous values stay in the table rather than every
      // member appearing to go offline at once.
      const res = await fetch(api, {
        headers: { "User-Agent": "ColdstreamGaming-Presence/1.0 (+https://coldstreamgaming.com)" },
      });
      if (!res.ok) {
        console.error("steam returned", res.status, "for a batch of", batch.length);
        continue;
      }
      const json = await res.json();
      players = json?.response?.players ?? [];
    } catch (e) {
      console.error("steam fetch threw", e);
      continue;
    }

    for (const p of players) {
      // communityvisibilitystate 3 is public. Anything less means Steam will
      // report offline whatever the truth is, so the site can say "private"
      // instead of quietly implying the member never plays.
      const visible = (p.communityvisibilitystate ?? 1) === 3;
      rows.push({
        steam_id64: p.steamid,
        persona_name: p.personaname ?? null,
        avatar_url: p.avatarmedium ?? null,
        persona_state: visible ? (p.personastate ?? 0) : 0,
        game: p.gameextrainfo ?? null,
        game_id: p.gameid ?? null,
        visible,
        checked_at: now,
      });
    }
  }

  if (rows.length === 0) {
    return Response.json({ ok: false, error: "steam returned nothing for any batch" }, { status: 502 });
  }

  const { error: upErr } = await admin
    .from("steam_presence")
    .upsert(rows, { onConflict: "steam_id64" });

  if (upErr) {
    console.error("presence upsert failed", upErr);
    return Response.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    members: ids.length,
    updated: rows.length,
    online: rows.filter((r) => (r.persona_state as number) > 0).length,
    in_game: rows.filter((r) => r.game).length,
  });
});
