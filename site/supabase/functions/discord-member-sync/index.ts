// Turns a Supabase Discord session into a Coldstream member row.
// Discord is the identity. The community server roles decide whether the
// member is an admin, moderator or ordinary member.
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  ?? Deno.env.get("SB_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const GUILD_ID = Deno.env.get("DISCORD_GUILD_ID")!;

const ids = (name: string) => new Set(
  (Deno.env.get(name) ?? "").split(",").map((value) => value.trim()).filter(Boolean),
);
const ADMIN_ROLES = ids("DISCORD_ADMIN_ROLE_IDS");
const MODERATOR_ROLES = ids("DISCORD_MODERATOR_ROLE_IDS");
const MEMBER_ROLES = ids("DISCORD_MEMBER_ROLE_IDS");
// This is the current Coldstream member role. Keep the environment override
// available for future role rotations, while ensuring a newly enlisted member
// can sign in before the secret is updated.
MEMBER_ROLES.add("1545198564597301298");

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

const overlaps = (roles: string[], allowed: Set<string>) => roles.some((role) => allowed.has(role));

const discordAvatarUrl = (discordId: string, userAvatar: string | null | undefined, guildAvatar: string | null | undefined, discriminator: string | null | undefined) => {
  if (guildAvatar) {
    const extension = guildAvatar.startsWith("a_") ? "gif" : "webp";
    return `https://cdn.discordapp.com/guilds/${GUILD_ID}/users/${discordId}/avatars/${guildAvatar}.${extension}?size=256`;
  }
  if (userAvatar) {
    const extension = userAvatar.startsWith("a_") ? "gif" : "webp";
    return `https://cdn.discordapp.com/avatars/${discordId}/${userAvatar}.${extension}?size=256`;
  }
  const defaultIndex = discriminator && discriminator !== "0"
    ? Number(discriminator) % 5
    : Number((BigInt(discordId) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") {
    if (!allowedOrigin(origin)) return new Response("no", { status: 403 });
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (req.method !== "POST" || !allowedOrigin(origin)) {
    return reply(origin, { ok: false, error: "This action only accepts the Coldstream site" }, 403);
  }
  if (!SB_URL || !ANON_KEY || !SERVICE_KEY || !BOT_TOKEN || !GUILD_ID) {
    return reply(origin, { ok: false, error: "Discord sign in is not configured" }, 500);
  }

  const authorization = req.headers.get("authorization") ?? "";
  const caller = createClient(SB_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  const user = userData.user;
  if (userError || !user) return reply(origin, { ok: false, error: "Sign in required" }, 401);

  const discordIdentity = user.identities?.find((identity) => identity.provider === "discord");
  const identity = discordIdentity?.identity_data ?? {};
  // identity.id can be Supabase's identity-row id. Discord's user id is the
  // provider subject and must win when both are present.
  const discordId = String(identity.sub ?? identity.id ?? discordIdentity?.id ?? "").trim();
  if (!discordId) return reply(origin, { ok: false, error: "This account is not connected to Discord" }, 400);

  const memberResponse = await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}`,
    { headers: { Authorization: `Bot ${BOT_TOKEN}` } },
  );
  if (memberResponse.status === 404) {
    return reply(origin, { ok: false, error: "Join the Coldstream Discord before creating a profile" }, 403);
  }
  if (!memberResponse.ok) {
    console.error("Discord member lookup failed", memberResponse.status);
    return reply(origin, { ok: false, error: "Discord roles could not be checked" }, 502);
  }

  const guildMember = await memberResponse.json() as {
    nick?: string | null;
    avatar?: string | null;
    roles?: string[];
    user?: { username?: string; global_name?: string | null; avatar?: string | null; discriminator?: string | null };
  };
  const roles = guildMember.roles ?? [];
  const isAdmin = overlaps(roles, ADMIN_ROLES);
  const isModerator = overlaps(roles, MODERATOR_ROLES);
  const isMember = overlaps(roles, MEMBER_ROLES);
  const admin = createClient(SB_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: byDiscord, error: discordLookupError } = await admin.from("member").select("id").eq("discord_id", discordId).maybeSingle();
  const { data: byAuth, error: authLookupError } = byDiscord
    ? { data: null, error: null }
    : await admin.from("member").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (discordLookupError || authLookupError) {
    console.error("Member access lookup failed", discordLookupError ?? authLookupError);
    return reply(origin, { ok: false, error: "Member access could not be checked" }, 500);
  }
  const existingId = byDiscord?.id ?? byAuth?.id ?? null;
  if (!existingId && !isAdmin && !isModerator && !isMember) {
    return reply(origin, { ok: false, error: "Member, Moderator or Admin role required" }, 403);
  }
  const role = isAdmin
    ? "admin"
    : isModerator
    ? "moderator"
    : "member";
  const username = guildMember.user?.username
    ?? String(identity.user_name ?? identity.preferred_username ?? "Discord member");
  const displayName = guildMember.nick
    ?? guildMember.user?.global_name
    ?? String(identity.full_name ?? identity.name ?? username);
  // Build this from Discord's live response instead of retaining the OAuth
  // metadata URL. That makes Discord the only avatar source and also respects
  // server-specific profile pictures.
  const avatarUrl = discordAvatarUrl(discordId, guildMember.user?.avatar, guildMember.avatar, guildMember.user?.discriminator);

  const values = {
    auth_user_id: user.id,
    discord_id: discordId,
    discord_username: username,
    display_name: displayName,
    avatar_url: avatarUrl,
    role,
    discord_role_synced_at: new Date().toISOString(),
  };
  const write = existingId
    ? await admin.from("member").update(values).eq("id", existingId).select("id,display_name,avatar_url,discord_id,steam_id64,role").single()
    : await admin.from("member").insert(values).select("id,display_name,avatar_url,discord_id,steam_id64,role").single();

  if (write.error || !write.data) {
    console.error("Discord member write failed", write.error);
    return reply(origin, { ok: false, error: "The member profile could not be created" }, 500);
  }
  return reply(origin, { ok: true, member: write.data });
});
