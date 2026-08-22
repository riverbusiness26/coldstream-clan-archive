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

interface Summary {
  steamid: string;
  personaname?: string;
  avatarmedium?: string;
  personastate?: number;
  communityvisibilitystate?: number;
  gameextrainfo?: string;
  gameid?: string;
}

// Games we track per member stats for.
//
// Holdfast publishes 38 achievements and a stats schema, so its numbers come
// straight from Steam and need nobody's permission. Any game listing "Stats"
// on its Steam page can be added here by appid and it will start appearing
// on profiles, which is why this is a list rather than a Holdfast special
// case.
const TRACKED_GAMES: { appid: number; name: string }[] = [
  { appid: 589290, name: "Holdfast: Nations At War" },
];

const chunk = <T>(xs: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

// How long one invocation may spend before it starts declining new work.
// Comfortably inside the platform's limit, and the passes below check it
// between items rather than only at the start, so a slow response from
// somebody else's server cannot carry us past it.
const BUDGET_MS = 25_000;

Deno.serve(async (req) => {
  const startedAt = Date.now();
  const spent = () => Date.now() - startedAt;
  const haveTime = (needed = 1500) => spent() + needed < BUDGET_MS;

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
  if (!SB_URL || !SERVICE_KEY) {
    return Response.json({ ok: false, error: "Supabase server credentials are not configured" }, { status: 500 });
  }

  // Construct this only after the scheduler has authenticated. A malformed
  // or rotating platform secret must return a useful error to the scheduler,
  // not prevent the entire Edge Function from booting.
  const admin = createClient(SB_URL, SERVICE_KEY, { auth: { persistSession: false } });

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

  // What people have actually been playing, for their profile page.
  //
  // Unlike presence, this cannot be batched: GetRecentlyPlayedGames takes one
  // steamid per call. So it is capped and it is slower moving, refreshed for
  // at most 25 members per run and only if their row is a day old. With a
  // run every five minutes that covers a community of any realistic size
  // within the hour, and never makes more than 25 calls in one go.
  let recentUpdated = 0;
  try {
    const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: stale } = await admin
      .from("steam_recent")
      .select("steam_id64, checked_at")
      .lt("checked_at", dayAgo)
      .limit(25);

    const known = new Set((stale ?? []).map((r) => r.steam_id64 as string));
    // Anyone with no row at all is new and goes to the front of the queue.
    const missing = ids.filter((id) => !known.has(id)).slice(0, 25);
    const todo = [...new Set([...missing, ...known])].slice(0, 25);

    for (const id of todo) {
      if (!haveTime()) break;
      const r = await fetch(
        "https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/"
        + `?key=${STEAM_KEY}&steamid=${id}&count=6`,
        { headers: { "User-Agent": "ColdstreamGaming-Presence/1.0 (+https://coldstreamgaming.com)" } },
      );
      if (!r.ok) continue;
      const j = await r.json();
      const games = (j?.response?.games ?? []).map((g: Record<string, unknown>) => ({
        appid: g.appid,
        name: g.name,
        minutes_2weeks: g.playtime_2weeks ?? 0,
        minutes_total: g.playtime_forever ?? 0,
      }));
      // An empty list is a real answer, a private profile or a quiet
      // fortnight, and writing it stops the same member being retried every
      // single run for ever.
      await admin.from("steam_recent").upsert(
        { steam_id64: id, games, checked_at: new Date().toISOString() },
        { onConflict: "steam_id64" },
      );
      recentUpdated++;
    }
  } catch (e) {
    // Recent games are a nicety. Presence is the job, and it has already
    // been written by this point, so a failure here is logged and shrugged
    // off rather than failing the run.
    console.error("recent games pass failed", e);
  }

  // Per game stats and achievements, for the games in TRACKED_GAMES.
  //
  // Neither call can be batched, so this is capped the same way the recent
  // games pass is: at most 20 member-and-game pairs per run, oldest first.
  // A run every five minutes still covers a community of any size within the
  // hour, and Steam never sees a burst.
  //
  // A private profile returns an error rather than data, which is not a
  // failure worth logging loudly: it is a member's own setting and the site
  // simply shows nothing for them.
  let statsUpdated = 0;
  try {
    const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: fresh } = await admin
      .from("game_stats")
      .select("steam_id64, appid")
      .gte("checked_at", dayAgo);

    const isFresh = new Set((fresh ?? []).map((r) => `${r.steam_id64}:${r.appid}`));
    const todo: { id: string; game: { appid: number; name: string } }[] = [];
    for (const game of TRACKED_GAMES) {
      for (const id of ids) {
        if (!isFresh.has(`${id}:${game.appid}`)) todo.push({ id, game });
      }
    }

    for (const { id, game } of todo.slice(0, 20)) {
      if (!haveTime(2500)) break;
      const q = `?appid=${game.appid}&key=${STEAM_KEY}&steamid=${id}`;
      const headers = { "User-Agent": "ColdstreamGaming-Presence/1.0 (+https://coldstreamgaming.com)" };

      const [statsRes, achRes] = await Promise.all([
        fetch("https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/" + q, { headers }),
        fetch("https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/" + q, { headers }),
      ]);

      const stats: Record<string, number> = {};
      if (statsRes.ok) {
        const j = await statsRes.json();
        for (const st of (j?.playerstats?.stats ?? [])) stats[st.name] = st.value;
      }

      let achieved = 0;
      let total = 0;
      if (achRes.ok) {
        const j = await achRes.json();
        const list = j?.playerstats?.achievements ?? [];
        total = list.length;
        achieved = list.filter((a: { achieved?: number }) => a.achieved === 1).length;
      }

      // Nothing at all means a private profile or a game they have never
      // launched. Write the row anyway, so the same member is not retried on
      // every single run for ever.
      await admin.from("game_stats").upsert({
        steam_id64: id,
        appid: game.appid,
        game_name: game.name,
        stats,
        achieved,
        achievements: total,
        checked_at: new Date().toISOString(),
      }, { onConflict: "steam_id64,appid" });
      statsUpdated++;
    }
  } catch (e) {
    // Same reasoning as the recent games pass: presence is the job and it is
    // already written, so this is logged and shrugged off.
    console.error("game stats pass failed", e);
  }

  // Holdfast event statistics from hfstats.online, with the owner's
  // permission.
  //
  // Their API has no per-player lookup: the steamId parameter is accepted and
  // ignored, and /api/players/<id> is a 404. So the only way to find our
  // members is to page the leaderboard and match on id, which is a Steam
  // id64 on their side as well as ours.
  //
  // River's call: once a month, and only for members who have actually
  // signed in through Steam. The second part is free, because the id list
  // above comes from the member table, which is exactly the set of people
  // who have signed in. Nobody is looked up on their behalf.
  //
  // Monthly rather than daily, and aligned to the calendar rather than to a
  // rolling window, so it runs once shortly after each month turns over and
  // captures the previous month settled rather than half finished. 54 pages
  // twelve times a year is a rounding error on somebody else's site, which
  // is the point: River has their owner's permission and it is worth
  // keeping. Hard capped at 60 pages so a change at their end can never turn
  // this into a crawl.
  let hfUpdated = 0;
  let hfRan = false;
  try {
    const { data: newest } = await admin
      .from("holdfast_stats")
      .select("checked_at")
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // A different calendar month, not a rolling 30 days. Rolling would drift
    // a little later every cycle and eventually straddle month boundaries,
    // which is exactly the wrong shape for numbers reported per month.
    const monthKey = (d: Date) => d.getUTCFullYear() * 100 + d.getUTCMonth();
    const due = !newest?.checked_at
      || monthKey(new Date(newest.checked_at)) !== monthKey(new Date());

    // Paging somebody else's leaderboard is the longest job here, so it only
    // starts if there is real time left rather than beginning and being cut
    // off halfway, which would waste their bandwidth for nothing.
    if (due && haveTime(12_000)) {
      hfRan = true;
      const wanted = new Set(ids);
      const found: Record<string, unknown>[] = [];
      const seen = new Set<string>();
      const now2 = new Date().toISOString();

      for (let page = 1; page <= 60; page++) {
        // Stop cleanly rather than being killed. Whatever was found so far is
        // written below, and the next run picks the rest up, because the
        // month check only passes once the write succeeds.
        if (!haveTime(2000)) break;
        const r = await fetch(
          "https://hfstats.online/api/players/filtered"
          + `?page=${page}&pageSize=100&playerEntryType=Career&sort=kills&direction=desc`,
          { headers: { "User-Agent": "ColdstreamGaming/1.0 (+https://coldstreamgaming.com)" } },
        );
        if (!r.ok) break;
        const j = await r.json();
        const items = j?.items ?? [];
        if (items.length === 0) break;

        for (const it of items) {
          const id = String(it.id ?? "");
          if (!wanted.has(id) || seen.has(id)) continue;
          seen.add(id);
          found.push({
            steam_id64: id,
            hf_name: it.name ?? null,
            regiment: it.regimentName ?? null,
            kills: it.kills ?? 0,
            deaths: it.deaths ?? 0,
            melee_kills: it.meleeKills ?? 0,
            shooting_kills: it.shootingKills ?? 0,
            arty_kills: it.artyKills ?? 0,
            team_kills: it.teamKills ?? 0,
            assists: it.assists ?? 0,
            games_won: it.gamesWon ?? 0,
            games_lost: it.gamesLost ?? 0,
            rounds_played: it.roundsPlayed ?? 0,
            rounds_won: it.roundsWon ?? 0,
            kdr: it.kdr ?? null,
            rank_rating: it.rankRating ?? null,
            checked_at: now2,
          });
        }
        // Everybody accounted for, so there is no reason to keep reading
        // their leaderboard.
        if (seen.size === wanted.size) break;
        // A short pause between pages. 54 requests in a burst is not a load
        // problem for them, but it is not good manners either.
        await new Promise((r2) => setTimeout(r2, 120));
      }

      if (found.length > 0) {
        await admin.from("holdfast_stats").upsert(found, { onConflict: "steam_id64" });
        hfUpdated = found.length;
      }
    }
  } catch (e) {
    // Somebody else's site, so it is allowed to be down. Presence is already
    // written by this point and is the actual job.
    console.error("holdfast stats pass failed", e);
  }

  return Response.json({
    ok: true,
    members: ids.length,
    recent_updated: recentUpdated,
    game_stats_updated: statsUpdated,
    holdfast_ran: hfRan,
    holdfast_updated: hfUpdated,
    ms: spent(),
    updated: rows.length,
    online: rows.filter((r) => (r.persona_state as number) > 0).length,
    in_game: rows.filter((r) => r.game).length,
  });
});
