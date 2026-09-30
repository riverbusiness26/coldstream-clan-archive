import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transform } from 'esbuild';

const source = readFileSync(new URL('../supabase/functions/discord-member-sync/index.ts', import.meta.url), 'utf8');
const { code } = await transform(source.replace(/^import .*createClient.*;$/m, ''), { loader: 'ts' });

function harness({ authenticated = true, roles = [], existing = true } = {}) {
  let handler, written, calls = 0;
  const env = { SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', DISCORD_BOT_TOKEN: 'bot', DISCORD_GUILD_ID: 'guild' };
  const user = { id: 'auth-member', identities: [{ provider: 'discord', identity_data: { sub: '188835722822680576' } }] };
  const chain = {
    select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: existing ? { id: 'member' } : null, error: null }; },
    update(value) { written = value; return this; }, insert(value) { written = value; return this; },
    async single() { return { data: { id: 'member', ...written }, error: null }; },
  };
  runInNewContext(code, {
    Deno: { env: { get: key => env[key] }, serve: value => { handler = value; } },
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? user : null }, error: null }) }, from: () => chain }),
    fetch: async () => { calls++; return Response.json({ roles, user: { username: 'fixture' } }); },
    Response, console,
  });
  return {
    call: () => handler(new Request('https://example.invalid', { method: 'POST', headers: { origin: 'https://coldstreamgaming.com' } })),
    written: () => written, calls: () => calls,
  };
}

test('asymmetric-compatible gateway keeps authentication inside the handler', async () => {
  assert.match(readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'), /verify_jwt\s*=\s*false/);
  const h = harness({ authenticated: false });
  assert.equal((await h.call()).status, 401);
  assert.equal(h.calls(), 0);
  assert.equal(h.written(), undefined);
});

test('current Discord administrator role preserves admin access', async () => {
  const h = harness({ roles: ['1548897236782555176'] });
  assert.equal((await h.call()).status, 200);
  assert.equal(h.written().role, 'admin');
});

test('ordinary member role cannot gain staff access', async () => {
  const h = harness({ roles: ['1545198564597301298'] });
  assert.equal((await h.call()).status, 200);
  assert.equal(h.written().role, 'member');
});

test('new account without an allowed Discord role cannot create a member', async () => {
  const h = harness({ existing: false });
  assert.equal((await h.call()).status, 403);
  assert.equal(h.written(), undefined);
});
