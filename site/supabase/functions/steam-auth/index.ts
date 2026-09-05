// Steam OpenID 2.0 sign-in for the Coldstream Gaming site.
//
// GET /steam-auth            -> redirects the browser to Steam's login page
// GET /steam-auth?openid...  -> Steam sends the user back here; we verify the
//                               assertion with Steam, upsert the member, and
//                               hand the browser a Supabase session via a
//                               one time magic link.
//
// Configuration.
//
// Supabase injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into every edge
// function by itself, so neither has to be set by hand and the service role
// key never has to be copied anywhere. That key bypasses row level security
// completely, so the safest place for it is the one place it already is.
//
// The SB_ prefixed names are kept as a fallback because Supabase refuses to
// let you set a secret starting with SUPABASE_, so a self-hosted or local run
// still has a way to supply them.
//
// SITE_URL is where the browser is sent after signing in. It defaults to the
// live domain, so nothing has to be configured for the normal case.

import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://coldstreamgaming.com";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  ?? Deno.env.get("SB_SERVICE_ROLE_KEY")!;
const STEAM_OPENID = "https://steamcommunity.com/openid/login";

const admin = createClient(SB_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Where Steam sends the browser back to, and therefore what Steam calls us.
//
// Steam's login page names the site it is about to return you to, and it takes
// that name from openid.realm. OpenID 2.0 requires return_to to sit underneath
// the realm, so pointing return_to at this function meant the realm had to be
// the Supabase project, and Steam told every member that
// "zcpbpcktinlqnxmqddzc.supabase.co is not affiliated with Steam or Valve".
//
// So Steam returns to the community's own domain instead, to a small static
// page that forwards the openid parameters straight back here. That makes the
// realm coldstreamgaming.com, which is both what members expect to see and the
// truthful answer to the question Steam is asking.
//
// This is why it cannot be derived from the request: behind Supabase's gateway
// the function sees an internal URL, with http for a protocol and
// /functions/v1 already stripped.
const RETURN_TO = Deno.env.get("STEAM_RETURN_URL")
  ?? "https://coldstreamgaming.com/steam-return/";

function steamRedirect(returnTo: string): Response {
  const q = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": new URL(returnTo).origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return Response.redirect(`${STEAM_OPENID}?${q}`, 302);
}

async function verifyWithSteam(params: URLSearchParams): Promise<string | null> {
  const check = new URLSearchParams(params);
  check.set("openid.mode", "check_authentication");
  const res = await fetch(STEAM_OPENID, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: check.toString(),
  });
  const text = await res.text();
  if (!/is_valid\s*:\s*true/.test(text)) return null;
  const claimed = params.get("openid.claimed_id") ?? "";
  const m = claimed.match(/\/openid\/id\/(\d{17})$/);
  return m ? m[1] : null;
}

async function steamPersona(steamId: string): Promise<{ name: string; avatar: string | null; ok: boolean }> {
  // The public XML profile needs no API key, but Steam serves an anti-bot
  // interstitial to a client that does not introduce itself, and that reply
  // parses as a member with no name. Hence the User-Agent, and the ok flag:
  // a guessed persona must never overwrite a real one.
  try {
    const res = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`, {
      headers: { "User-Agent": "ColdstreamGaming-SteamAuth/1.0 (+https://coldstreamgaming.com)" },
    });
    const xml = await res.text();
    const name = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] ?? null;
    const avatar = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1] ?? null;
    if (!name) return { name: `Player ${steamId.slice(-5)}`, avatar: null, ok: false };
    return { name, avatar, ok: true };
  } catch {
    return { name: `Player ${steamId.slice(-5)}`, avatar: null, ok: false };
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (!url.searchParams.has("openid.mode")) {
    return steamRedirect(RETURN_TO);
  }

  // Verification is a live call to Steam, and a network failure here used
  // to reject the handler: a raw 500 on the supabase.co origin, with the
  // member never returned to the site at all.
  let steamId: string | null = null;
  try {
    steamId = await verifyWithSteam(url.searchParams);
  } catch (e) {
    console.error("steam verification threw", e);
  }
  if (!steamId) {
    return Response.redirect(`${SITE_URL}/?login=failed`, 302);
  }

  const persona = await steamPersona(steamId);
  const email = `${steamId}@steam.coldstream.local`;

  // Ensure an auth user exists for this Steam ID.
  //
  // The member row already records which auth user a Steam ID belongs to, so
  // for anyone who has signed in before that is one indexed read and no more.
  // Only a genuinely new person reaches createUser.
  let userId: string | null = null;

  const { data: known } = await admin
    .from("member")
    .select("auth_user_id, display_name")
    .eq("steam_id64", steamId)
    .maybeSingle();
  if (known?.auth_user_id) userId = known.auth_user_id as string;

  if (!userId) {
    const { data: created } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { steam_id64: steamId, provider: "steam" },
    });
    userId = created?.user?.id ?? null;
  }

  // Last resort: the auth user exists but nothing points at it, which happens
  // if a previous run created the user and then failed before writing the
  // member row. Page through rather than reading only the first page, because
  // a single page silently stops finding people once the site outgrows it.
  if (!userId) {
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      const users = list?.users ?? [];
      userId = users.find((u) => u.email === email)?.id ?? null;
      if (users.length < 200) break;
    }
  }

  if (!userId) return Response.redirect(`${SITE_URL}/?login=failed`, 302);

  // Upsert the member row, and nothing else.
  //
  // Sign in used to also claim roster history: it looked for roster_entry
  // rows carrying this Steam ID and pointed them at the member who had just
  // signed in. River asked for sign in not to be connected to the roster
  // "or none of that yet", so that link is gone, and the frontend no longer
  // marks "you" anywhere on the roster either. Signing in says who you are
  // on Steam. It claims nothing.
  //
  // Kept here because "yet" means this is likely to be wanted back one day,
  // and it should be put back deliberately rather than reinvented. It ran
  // straight after the upsert, on the returned row:
  //
  //   await admin.from("roster_entry")
  //     .update({ member_id: memberRow.id })
  //     .eq("steam_id64", steamId)
  //     .is("member_id", null);
  //
  // The .is("member_id", null) is the important part: it only ever claimed
  // rows nobody had claimed, so it could not steal history from someone
  // else by matching a recycled or mistyped Steam ID.
  // A failed persona lookup must not rename a member to "Player 97257",
  // and a failed upsert must not still hand out a session: the member row is
  // what the whole site reads, so without it a signed-in browser shows the
  // guest view and explains nothing.
  const keepName = !persona.ok && known?.display_name ? (known.display_name as string) : persona.name;
  const { error: upsertError } = await admin.from("member").upsert(
    { auth_user_id: userId, steam_id64: steamId, display_name: keepName },
    { onConflict: "steam_id64" },
  );
  if (upsertError) {
    console.error("member upsert failed", upsertError);
    return Response.redirect(`${SITE_URL}/?login=failed`, 302);
  }

  // Hand the browser a session: generate a one time link and send them to it.
  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: SITE_URL },
  });
  const action = link?.properties?.action_link;
  return Response.redirect(action ?? `${SITE_URL}/?login=failed`, 302);
});
