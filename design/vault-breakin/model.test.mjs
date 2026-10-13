import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { estimate, eligibility, count, escapeHtml, createActionGate, errorText } from './model.mjs';
import { fixture, createDemoAdapter, TIERS } from './demo-adapter.mjs';
const now = Date.parse('2026-10-13T20:00:00Z');
const wallet = fixture(now);
const target = wallet.leaderboard[1];
test('base odds and renown agree with engine formula across all nine tiers', () => {
  TIERS.forEach((tier, vaultLevel) => {
    const actual = estimate(wallet, { ...target, vaultLevel, renownLevel: 60 });
    assert.ok(Math.abs(actual.chance - Math.max(.005, tier.chance * .7)) < 1e-12);
  });
});
test('tool order: key lowers tier, lockpick adds, powder multiplies, then renown', () => {
  const out = estimate(wallet, target, ['skeleton_key', 'lockpick', 'powder_keg']);
  assert.equal(out.level, 0);
  assert.equal(out.chance, (.09 + .025) * 1.5 * (1 - 11 * .012));
});
test('dog applies after clamp, tripwire guarantees failure even with smoke', () => {
  const high = { ...target, vaultLevel: 8, renownLevel: 60 };
  assert.equal(estimate(wallet, high, [], { guardDogs: 1 }).chance, .01 * .7 * .6);
  assert.equal(estimate(wallet, high, ['smoke_bomb'], { tripwire: true }).chance, 0);
  assert.equal(estimate(wallet, high).scouted, false);
});
test('haul capped at half chest and 2500; unknown defenses are never implied known', () => {
  const out = estimate(wallet, { ...target, chest: 100000, vaultLevel: 0 }, ['powder_keg']);
  assert.equal(out.high, 2500); assert.equal(out.motherlode, 2500);
  assert.equal(estimate(wallet, { ...target, chest: 100, vaultLevel: 0 }, ['powder_keg']).motherlode, 50);
  assert.equal(out.scouted, false);
});
test('eligibility rejects absent data, self, jail, cooldown, reseal, poverty and empty purse', () => {
  assert.match(eligibility(null, target), /unavailable/);
  assert.match(eligibility(wallet, null), /Choose/);
  assert.match(eligibility(wallet, wallet.leaderboard[0]), /own/);
  for (const [patch, text] of [[{ jailUntil: new Date(now + 1).toISOString() }, /guardhouse/]]) {
    assert.match(eligibility({ ...wallet, armory: { ...wallet.armory, ...patch } }, target, null, now), text);
  }
  assert.match(eligibility({ ...wallet, cooldowns: { vault: new Date(now + 1).toISOString() } }, target, null, now), /not ready/);
  assert.match(eligibility(wallet, target, { resealedUntil: new Date(now + 1).toISOString() }, now), /resealed/);
  assert.match(eligibility(wallet, { ...target, chest: 49 }), /minimum/);
  assert.match(eligibility({ ...wallet, profile: { ...wallet.profile, purse: 19 } }, target), /Not enough/);
  assert.equal(eligibility(wallet, target, null, now), null);
});
test('snapshot array inventory and HTML escaping', () => {
  assert.equal(count(wallet, 'spyglass'), 3); assert.equal(count(wallet, 'missing'), 0);
  assert.equal(escapeHtml('<img onerror="x">&\''), '&lt;img onerror=&quot;x&quot;&gt;&amp;&#39;');
});
test('gate refuses concurrent actions and never retries failed actions', async () => {
  let release, calls = 0;
  const gate = createActionGate({ action: async () => { calls++; await new Promise(r => { release = r; }); throw new Error('lost'); } });
  const first = gate.run('vault_crack', {});
  await assert.rejects(gate.run('vault_crack', {}), { code: 'pending' });
  release(); await assert.rejects(first, /lost/); assert.equal(calls, 1); assert.equal(gate.busy, false);
  assert.match(errorText({ code: 'network' }), /Do not repeat/);
});
for (const scenario of ['success', 'motherlode', 'failure', 'tripwire']) {
  test(`demo ${scenario}: cost, consumption, cooldown and response shape`, async () => {
    const demo = createDemoAdapter({ latency: 0, now: () => now }); demo.reset(scenario);
    const out = await demo.action('vault_crack', { targetDiscordId: target.discordId, tools: ['lockpick', 'lockpick', 'smoke_bomb'] });
    assert.equal(count(out.snapshot, 'lockpick'), 1); assert.equal(count(out.snapshot, 'smoke_bomb'), 1);
    assert.equal(Date.parse(out.snapshot.cooldowns.vault) - now, 10800000);
    assert.equal(out.snapshot.profile.purse, 220 + (out.game.amount ?? 0) - (out.game.fine ?? 0));
    assert.equal(out.game.success, ['success', 'motherlode'].includes(scenario));
    if (scenario === 'tripwire') { assert.equal(out.game.smoke, false); assert.equal(Date.parse(out.game.jailUntil) - now, 86400000); }
    if (scenario === 'failure') { assert.equal(out.game.smoke, true); assert.equal(out.game.fine, 0); }
    await assert.rejects(demo.action('vault_crack', { targetDiscordId: target.discordId }), { code: 'cooldown' });
  });
}
test('scout consumes one spyglass; reset never persists a wallet', async () => {
  const demo = createDemoAdapter({ latency: 0 });
  const out = await demo.action('vault_scout', { targetDiscordId: target.discordId });
  assert.equal(count(out.snapshot, 'spyglass'), 2); assert.equal(out.game.intel.targetDiscordId, target.discordId);
  demo.reset(); assert.equal(count(await demo.read(), 'spyglass'), 3);
});
test('upgrade draws chest first; exhausted combined balance prevents upgrade', async () => {
  const demo = createDemoAdapter({ latency: 0 }); const out = await demo.action('vault_upgrade');
  assert.equal(out.snapshot.profile.chest, 160); assert.equal(out.snapshot.profile.purse, 240);
  assert.equal(out.snapshot.armory.card.vault.level, 3);
  await assert.rejects(demo.action('vault_upgrade'), { code: 'insufficient_funds' });
});
test('unknown tools fail without consuming any tools', async () => {
  const demo = createDemoAdapter({ latency: 0 });
  await assert.rejects(demo.action('vault_crack', { targetDiscordId: target.discordId, tools: ['lockpick', 'bad'] }), { code: 'invalid_tools' });
  assert.equal(count(await demo.read(), 'lockpick'), 2);
});
test('preview has no real network or persistence and stays excluded from publishing', async () => {
  for (const file of ['preview.mjs', 'demo-adapter.mjs', 'vault.mjs', 'model.mjs']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|supabase|site-integrations/);
  }
  const html = await readFile(new URL('index.html', import.meta.url), 'utf8'); assert.match(html, /connect-src 'none'/);
});
test('repository excludes design from publishing', async context => {
  let exclusions;
  try { exclusions = await readFile(new URL('../../.assetsignore', import.meta.url), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') { context.skip('Standalone desktop copy; publication exclusion is checked in Git.'); return; } throw error; }
  assert.match(exclusions, /^\/design\/$/m);
});
