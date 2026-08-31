import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  ?? Deno.env.get("SB_SERVICE_ROLE_KEY")!;

const lanes = new Set([
  "website",
  "game-servers",
  "discord",
  "graphics",
  "archive",
  "2nd-coldstream",
  "training-map",
]);

const allowedOrigin = (origin: string) =>
  origin === "https://coldstreamgaming.com"
  || origin === "https://www.coldstreamgaming.com"
  || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": allowedOrigin(origin)
    ? origin
    : "https://coldstreamgaming.com",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
});

const reply = (origin: string, body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: cors(origin) });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";

  if (req.method === "OPTIONS") {
    if (!allowedOrigin(origin)) return new Response("no", { status: 403 });
    return new Response(null, { status: 204, headers: cors(origin) });
  }

  if (!SB_URL || !SERVICE_KEY) {
    return reply(origin, { ok: false, error: "Task service is not configured" }, 500);
  }

  const admin = createClient(SB_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("progress_task")
      .select("id,lane,title,note,status,created_at")
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) return reply(origin, { ok: false, error: "Tasks could not be read" }, 500);
    return reply(origin, { ok: true, tasks: data ?? [] });
  }

  if (req.method !== "POST") {
    return reply(origin, { ok: false, error: "Method not allowed" }, 405);
  }
  if (!allowedOrigin(origin)) {
    return reply(origin, { ok: false, error: "This form only accepts the Coldstream site" }, 403);
  }

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return reply(origin, { ok: false, error: "The task was not valid" }, 400);
  }

  // A filled honeypot gets the same quiet success as a real insert. Bots do
  // not need a useful signal that helps them tune the next attempt.
  if (String(input.company ?? "").trim()) {
    return reply(origin, { ok: true }, 201);
  }

  const lane = String(input.lane ?? "").trim();
  const title = String(input.title ?? "").trim().replace(/\s+/g, " ");
  const note = String(input.note ?? "").trim().replace(/\s+/g, " ");
  if (!lanes.has(lane)) return reply(origin, { ok: false, error: "Choose a valid workstream" }, 400);
  if (title.length < 3 || title.length > 120) {
    return reply(origin, { ok: false, error: "Keep the task between 3 and 120 characters" }, 400);
  }
  if (note.length > 280) {
    return reply(origin, { ok: false, error: "Keep the context under 280 characters" }, 400);
  }

  const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count, error: countError } = await admin
    .from("progress_task")
    .select("id", { count: "exact", head: true })
    .gte("created_at", hourAgo);
  if (countError) return reply(origin, { ok: false, error: "The task could not be checked" }, 500);
  if ((count ?? 0) >= 60) {
    return reply(origin, { ok: false, error: "The board has had too many additions this hour" }, 429);
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: duplicate } = await admin
    .from("progress_task")
    .select("id")
    .eq("lane", lane)
    .eq("title", title)
    .gte("created_at", dayAgo)
    .limit(1);
  if (duplicate?.length) {
    return reply(origin, { ok: false, error: "That task is already on this workstream" }, 409);
  }

  const { data, error } = await admin
    .from("progress_task")
    .insert({ lane, title, note, status: "todo", source: "public" })
    .select("id,lane,title,note,status,created_at")
    .single();

  if (error) return reply(origin, { ok: false, error: "The task could not be added" }, 500);
  return reply(origin, { ok: true, task: data }, 201);
});

