// Steam OpenID 2.0 sign-in for the Coldstream Gaming site.
//
// GET /steam-auth            -> redirects the browser to Steam's login page
// GET /steam-auth?openid...  -> Steam sends the user back here; we verify the
//                               assertion with Steam, upsert the member, and
//                               hand the browser a Supabase session via a
//                               one time magic link.
//
// Required function secrets:
//   SITE_URL                 e.g. https://coldstreamgaming.com
//   SB_URL                   the Supabase project url
//   SB_SERVICE_ROLE_KEY      service role key (never shipped to the client)

import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL")!;
const SB_URL = Deno.env.get("SB_URL")!;
const SERVICE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY")!;
const STEAM_OPENID = "https://steamcommunity.com/openid/login";

const admin = createClient(SB_URL, SERVICE_KEY, { auth: { persistSession: false } });

function selfUrl(req: Request): string {
  const u = new URL(req.url);
  return `${u.origin}${u.pathname}`;
}

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

async function steamPersona(steamId: string): Promise<{ name: string; avatar: string | null }> {
  // The public XML profile needs no API key.
  try {
    const res = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`);
    const xml = await res.text();
    const name = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] ?? `Player ${steamId.slice(-5)}`;
    const avatar = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1] ?? null;
    return { name, avatar };
  } catch {
    return { name: `Player ${steamId.slice(-5)}`, avatar: null };
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (!url.searchParams.has("openid.mode")) {
    return steamRedirect(selfUrl(req));
  }

  const steamId = await verifyWithSteam(url.searchParams);
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
    .select("auth_user_id")
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

  // Upsert the member row and link any roster history with this Steam ID.
  const { data: memberRow } = await admin
    .from("member")
    .upsert(
      { auth_user_id: userId, steam_id64: steamId, display_name: persona.name, avatar_url: persona.avatar },
      { onConflict: "steam_id64" },
    )
    .select()
    .single();
  if (memberRow) {
    await admin.from("roster_entry")
      .update({ member_id: memberRow.id })
      .eq("steam_id64", steamId)
      .is("member_id", null);
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
