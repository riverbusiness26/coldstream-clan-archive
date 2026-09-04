// Attaches a Steam account to a member who is already signed in through
// Discord, and detaches it again.
//
// This is not a way in. Discord is the identity and the only way to get a
// session; a Steam ID here is a link on a member row that already exists, and
// the function refuses outright if the caller has no member row of their own.
// That is the difference between this and steam-auth, which mints an account
// and is what produced two member rows for the same person.
//
// Why the verification has to happen here rather than in the browser.
//
// The browser sends Steam's OpenID assertion, and a browser can send anything.
// Steam is the only thing that can say whether an assertion is genuine, so the
// parameters are handed straight back to Steam with mode check_authentication
// and nothing is written unless Steam says is_valid:true. A member cannot
// claim somebody else's Steam ID by typing it, and cannot replay a captured
// assertion either, because Steam refuses a nonce it has already answered for.
//
// The write goes through the service role on purpose. guard_member_row raises
// "steam id cannot be changed" for anything with auth.uid() set, which is every
// write from a browser, and that guard is worth keeping exactly as it is: it is
// what stops a member editing the column directly through PostgREST. The
// service role has no auth.uid(), so this one sanctioned path gets through and
// the direct one still does not.
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  ?? Deno.env.get("SB_SERVICE_ROLE_KEY")!;
const STEAM_OPENID = "https://steamcommunity.com/openid/login";

const allowedOrigin = (origin: string) =>
  origin === "https://coldstreamgaming.com"
  || origin === "https://www.coldstreamgaming.com"
  || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": allowedOrigin(origin) ? origin : "https://coldstreamgaming.com",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const reply = (origin: string, body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: cors(origin) });

// Ask Steam whether it really said this. Returns the 17 digit ID or null.
//
// Only the openid.* parameters are forwarded. The return trip carries our own
// query values as well, and posting those back changes the signed set Steam is
// being asked about, which makes a genuine assertion fail.
async function verifyWithSteam(params: URLSearchParams): Promise<string | null> {
  const check = new URLSearchParams();
  for (const [key, value] of params) {
    if (key.startsWith("openid.")) check.append(key, value);
  }
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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") {
    if (!allowedOrigin(origin)) return new Response("no", { status: 403 });
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (req.method !== "POST" || !allowedOrigin(origin)) {
    return reply(origin, { ok: false, error: "This action only accepts the Coldstream site" }, 403);
  }
  if (!SB_URL || !ANON_KEY || !SERVICE_KEY) {
    return reply(origin, { ok: false, error: "Steam linking is not configured" }, 500);
  }

  const authorization = req.headers.get("authorization") ?? "";
  const caller = createClient(SB_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  const user = userData.user;
  if (userError || !user) return reply(origin, { ok: false, error: "Sign in required" }, 401);

  const admin = createClient(SB_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // The member row is looked up by auth_user_id, never by anything the browser
  // sent. Whoever holds the session is the only member this can ever write to.
  const { data: me, error: meError } = await admin
    .from("member")
    .select("id, steam_id64")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (meError) {
    console.error("member lookup failed", meError);
    return reply(origin, { ok: false, error: "Your member record could not be read" }, 500);
  }
  if (!me) return reply(origin, { ok: false, error: "Sign in through Discord first" }, 403);

  let body: { action?: string; params?: string } = {};
  try { body = await req.json(); } catch { /* an empty body is an unlink of nothing */ }

  if (body.action === "unlink") {
    const { error } = await admin.from("member")
      .update({ steam_id64: null }).eq("id", me.id);
    if (error) {
      console.error("unlink failed", error);
      return reply(origin, { ok: false, error: "That could not be unlinked" }, 500);
    }
    return reply(origin, { ok: true, steam_id64: null });
  }

  if (!body.params) return reply(origin, { ok: false, error: "No Steam response to check" }, 400);

  let steamId: string | null = null;
  try {
    steamId = await verifyWithSteam(new URLSearchParams(body.params));
  } catch (e) {
    console.error("steam verification threw", e);
    return reply(origin, { ok: false, error: "Steam could not be reached. Try again." }, 502);
  }
  if (!steamId) return reply(origin, { ok: false, error: "Steam did not confirm that sign in" }, 400);

  // Already linked to this same account is a success, not an error. A member
  // who taps the button twice, or reloads the return page, should be told they
  // are linked rather than shown a failure for something that is already true.
  if (me.steam_id64 === steamId) return reply(origin, { ok: true, steam_id64: steamId });

  // steam_id64 carries a unique constraint, so the database is what actually
  // decides this. Checking first and then writing would leave a gap between
  // the two where a second member could claim the same ID.
  const { error } = await admin.from("member")
    .update({ steam_id64: steamId }).eq("id", me.id);
  if (error) {
    if (error.code === "23505") {
      return reply(origin, {
        ok: false,
        error: "That Steam account is already linked to another Coldstream member. An admin can move it.",
      }, 409);
    }
    console.error("link failed", error);
    return reply(origin, { ok: false, error: "That could not be linked" }, 500);
  }

  return reply(origin, { ok: true, steam_id64: steamId });
});
