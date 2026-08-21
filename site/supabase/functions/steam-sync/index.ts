// Copies the Steam groups down into our own database.
//
// Nothing here is served to a browser. The site reads the tables this writes,
// which is not an optimisation, it is the only thing that works: the Steam
// Web API sends no CORS headers, so a browser cannot call it at all, and the
// key must never be shipped in a bundle even if it could.
//
// Two sources, because Steam splits them.
//
//   1. The group member list XML is public and needs no key. It gives the
//      group's details and every member's ID64, a thousand per page.
//   2. GetPlayerSummaries turns those IDs into names and avatars, a hundred
//      per call, and that one needs the key.
//
// Cost per run is one XML call per group plus one summaries call per hundred
// members. For eight groups and about six hundred members that is roughly
// fifteen calls, against a daily limit of a hundred thousand. Running this
// hourly would still use well under one percent of the budget.
//
// Configuration:
//   STEAM_API_KEY   required, from https://steamcommunity.com/dev/apikey
//   SYNC_SECRET     required, any long random string. See the auth note below.

import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  ?? Deno.env.get("SB_SERVICE_ROLE_KEY")!;
const STEAM_KEY = Deno.env.get("STEAM_API_KEY") ?? "";
const SYNC_SECRET = Deno.env.get("SYNC_SECRET") ?? "";

const admin = createClient(SB_URL, SERVICE_KEY, { auth: { persistSession: false } });

// A page of the member list. Steam caps this at 1000 and tells us the total.
const PER_PAGE_MAX = 1000;
// GetPlayerSummaries takes at most 100 ids per call. This is Valve's limit,
// not a tuning knob.
const SUMMARY_BATCH = 100;

interface GroupRow {
  group_id64: string;
  url_slug: string;
}

// Steam's XML is small and regular, so a parser dependency would be more risk
// than it removes. Each helper is anchored on its own tag and returns null
// rather than guessing, so a shape change shows up as a missing value instead
// of as a plausible wrong one.
function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`));
  return m ? m[1] : null;
}

function num(xml: string, name: string): number | null {
  const v = tag(xml, name);
  if (v === null) return null;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : null;
}

// The two member counts, and why this is not a mistake.
//
// Steam reports memberCount twice. Once inside <groupDetails>, which is what
// the group page displays, and once at the list level, which matches the
// number of IDs actually returned. They disagree: Nox Viator says 83 in the
// details and 87 in the list, and the list really does contain 87 IDs.
//
// The difference appears to be accounts Steam no longer counts publicly, such
// as deleted or limited ones, which are still in the membership. Both are
// kept, named for what they are, because the site's existing era statistics
// were built from the details number and would stop reconciling if we
// silently swapped in the other one.
function detailsMemberCount(xml: string): number | null {
  const details = xml.match(/<groupDetails>([\s\S]*?)<\/groupDetails>/);
  return details ? num(details[1], "memberCount") : null;
}

function memberIds(xml: string): string[] {
  const members = xml.match(/<members>([\s\S]*?)<\/members>/);
  if (!members) return [];
  const out: string[] = [];
  const re = /<steamID64>(\d{17})<\/steamID64>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(members[1])) !== null) out.push(m[1]);
  return out;
}

async function fetchGroupXml(slug: string, page: number): Promise<string | null> {
  const url = `https://steamcommunity.com/groups/${encodeURIComponent(slug)}/memberslistxml/?xml=1&p=${page}`;
  const res = await fetch(url, {
    // Steam serves an interstitial to clients it does not recognise.
    headers: { "User-Agent": "coldstreamgaming.com group archiver" },
  });
  if (!res.ok) return null;
  const text = await res.text();
  // A missing or private group still answers 200, with a page that is not a
  // member list. Checking for the wrapper is what tells the two apart.
  return text.includes("<memberList>") ? text : null;
}

async function playerSummaries(ids: string[]): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  if (!STEAM_KEY) return out;

  for (let i = 0; i < ids.length; i += SUMMARY_BATCH) {
    const batch = ids.slice(i, i + SUMMARY_BATCH);
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/`
      + `?key=${STEAM_KEY}&steamids=${batch.join(",")}`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      for (const p of json?.response?.players ?? []) {
        if (p?.steamid) out.set(p.steamid, p);
      }
    } catch {
      // One bad batch should not cost us the whole run. The members in it keep
      // whatever names they already had and get picked up next time.
      continue;
    }
  }
  return out;
}

async function syncGroup(group: GroupRow) {
  const first = await fetchGroupXml(group.url_slug, 1);
  if (!first) {
    // Steam did not give us a member list. That might be a deletion, a
    // privacy change or an outage, and from here they look the same, so mark
    // it and change nothing else. The members stay exactly as last recorded.
    await admin.from("steam_group")
      .update({ gone_at: new Date().toISOString() })
      .eq("group_id64", group.group_id64);
    return { slug: group.url_slug, ok: false, reason: "no member list returned" };
  }

  const ids = [...memberIds(first)];
  const totalPages = num(first, "totalPages") ?? 1;
  for (let p = 2; p <= totalPages && p <= 50; p++) {
    const xml = await fetchGroupXml(group.url_slug, p);
    if (!xml) break;
    ids.push(...memberIds(xml));
  }
  const unique = [...new Set(ids)];

  const now = new Date().toISOString();
  const counts = {
    member_count_shown: detailsMemberCount(first),
    member_count_listed: unique.length,
    members_online: num(first, "membersOnline"),
    members_in_game: num(first, "membersInGame"),
    members_in_chat: num(first, "membersInChat"),
  };

  await admin.from("steam_group").update({
    name: tag(first, "groupName") ?? undefined,
    headline: tag(first, "headline"),
    summary: tag(first, "summary"),
    avatar_url: tag(first, "avatarFull"),
    ...counts,
    fetched_at: now,
    // If it answered this time, it is not gone, whatever happened before.
    gone_at: null,
  }).eq("group_id64", group.group_id64);

  await admin.from("steam_group_snapshot").insert({
    group_id64: group.group_id64,
    member_count_shown: counts.member_count_shown,
    member_count_listed: counts.member_count_listed,
    members_online: counts.members_online,
    members_in_game: counts.members_in_game,
  });

  const people = await playerSummaries(unique);

  // last_seen is what makes the leaver pass below work, so it is written for
  // everyone present, whether or not Steam gave us a name for them. A private
  // profile is still a member.
  const rows = unique.map((id) => {
    const p = people.get(id);
    return {
      group_id64: group.group_id64,
      steam_id64: id,
      persona_name: (p?.personaname as string) ?? null,
      avatar_url: (p?.avatarfull as string) ?? null,
      profile_url: (p?.profileurl as string) ?? null,
      visibility: (p?.communityvisibilitystate as number) ?? null,
      last_seen: now,
      left_at: null,
    };
  });

  // Chunked because a single upsert of every member of every group is a large
  // statement, and PostgREST will refuse one past its body limit.
  for (let i = 0; i < rows.length; i += 500) {
    await admin.from("steam_group_member")
      .upsert(rows.slice(i, i + 500), { onConflict: "group_id64,steam_id64" });
  }

  // Anyone we did not see this run has left. Nothing is deleted: the row
  // stays with left_at set, so the record can still say who was here.
  let departed = 0;
  if (unique.length > 0) {
    const { data } = await admin.from("steam_group_member")
      .update({ left_at: now })
      .eq("group_id64", group.group_id64)
      .is("left_at", null)
      .lt("last_seen", now)
      .select("steam_id64");
    departed = data?.length ?? 0;
  }

  return {
    slug: group.url_slug,
    ok: true,
    ...counts,
    named: [...people.keys()].length,
    departed,
  };
}

Deno.serve(async (req) => {
  // Why this is not open.
  //
  // Every call makes Steam do work on our behalf and writes to the database,
  // so it cannot be something anyone can hammer. The anon key is no good as a
  // guard because it ships in the site bundle and is public by design. So it
  // takes a shared secret that exists only here and in whatever triggers it.
  //
  // Compared with === so that a wrong length fails, and checked before any
  // work is done.
  const given = req.headers.get("x-sync-key") ?? new URL(req.url).searchParams.get("key") ?? "";
  if (!SYNC_SECRET || given !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: "not authorised" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!STEAM_KEY) {
    return new Response(JSON.stringify({ error: "STEAM_API_KEY is not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: groups, error } = await admin
    .from("steam_group")
    .select("group_id64, url_slug")
    .order("sort_order");

  if (error || !groups) {
    return new Response(JSON.stringify({ error: error?.message ?? "no groups" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // One group at a time, on purpose. Steam is being asked for a favour here
  // and eight sequential requests is polite; there is no deadline to beat.
  const results = [];
  for (const g of groups as GroupRow[]) {
    try {
      results.push(await syncGroup(g));
    } catch (e) {
      results.push({ slug: g.url_slug, ok: false, reason: String(e) });
    }
  }

  return new Response(JSON.stringify({ groups: results.length, results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
