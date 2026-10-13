// Optional offline check against the existing website engine checkout.
// Reads code and non-secret config only. Uses fabricated users, never a live-state dump.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { estimate } from './model.mjs';
import { fixture } from './demo-adapter.mjs';
if (!process.argv[2]) throw new Error('Pass the quartermaster-website engine directory. No live state file needed.');
const root = resolve(process.argv[2]);
const file = relative => pathToFileURL(resolve(root, relative));
const { applyAction } = await import(file('src/engine/index.js'));
const { context, ensureUser } = await import(file('src/engine/core.js'));
const { breakinOdds, armory } = await import(file('src/engine/armory.js'));
const config = JSON.parse(await readFile(file('config/economy.json'), 'utf8'));
const seed = JSON.parse(await readFile(file('data/seed.json'), 'utf8'));
const now = new Date('2026-10-13T20:00:00Z');
const opts = rng => ({ config, seed, now, rng });
function fresh() {
  const state = { users: {}, ledger: [] }, ctx = context(opts(() => .5));
  for (const id of ['1', '2']) {
    const user = ensureUser(state, id, ctx, `Fixture ${id}`);
    user.purse = 500; user.chest = 2000; user.lifetimeEarned = 0;
    user.inventory = { lockpick: 2, skeleton_key: 2, powder_keg: 2, smoke_bomb: 2, spyglass: 2 };
    armory(user);
  }
  return state;
}
const act = (s, action, args = {}, rng = () => .99, extra = {}) => applyAction(s, { discordId: '1', action, args: { targetDiscordId: '2', ...args }, ...extra }, opts(rng));
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
check('public odds parity: 9 tiers x 16 tool combinations x 4 renown levels', () => {
  const s = fresh(), ctx = context(opts(() => .5)), w = fixture();
  const slugs = ['lockpick', 'skeleton_key', 'powder_keg', 'smoke_bomb'];
  for (let tier = 0; tier < 9; tier++) for (let mask = 0; mask < 16; mask++) for (const renown of [1, 12, 26, 60]) {
    const tools = slugs.filter((_, i) => mask & (1 << i));
    const target = s.users['2']; target.armory.vaultLevel = tier; target.lifetimeEarned = 25 * (renown - 1) ** 2;
    const engine = breakinOdds(target, tools, ctx);
    const view = estimate(w, { vaultLevel: tier, renownLevel: renown, chest: 2000 }, tools);
    assert.equal(view.chance, engine.chance); assert.equal(view.level, engine.level);
  }
});
check('success transfers chest funds, consumes tools, reseals, records notice and cooldown', () => {
  const s = fresh(); let calls = 0;
  const out = act(s, 'vault_crack', { tools: ['lockpick', 'lockpick'] }, () => calls++ === 0 ? 0 : .5).result;
  assert.equal(out.success, true); assert.equal(s.users['1'].inventory.lockpick, 1);
  assert.equal(s.users['2'].chest, 2000 - out.amount);
  assert.equal(Date.parse(s.users['2'].armory.resealUntil) - +now, 86400000);
  assert.equal(Date.parse(s.users['1'].cooldowns.vault) - +now, 10800000);
  assert.ok(s.ledger.some(row => row.type === 'vault_notice' && row.discordId === '2'));
});
check('motherlode and haul caps', () => {
  const s = fresh(); s.users['2'].chest = 100000;
  const out = act(s, 'vault_crack', { tools: ['powder_keg'] }, () => 0).result;
  assert.equal(out.motherlode, true); assert.equal(out.amount, 2500);
});
check('dog consumes charge and pays the failed fine to its owner', () => {
  const s = fresh(); s.users['2'].inventory.guard_dog = 1;
  const out = act(s, 'vault_crack').result;
  assert.equal(out.success, false); assert.equal(out.dog, true); assert.equal(s.users['2'].inventory.guard_dog, 0);
  assert.equal(s.users['2'].purse, 500 + out.fine); assert.equal(out.fine, Math.floor(480 * .12));
});
check('smoke avoids ordinary fine and jail but not the entry cost', () => {
  const s = fresh(); const out = act(s, 'vault_crack', { tools: ['smoke_bomb'] }).result;
  assert.equal(out.fine, 0); assert.equal(out.jailUntil, null); assert.equal(s.users['1'].purse, 480);
});
check('tripwire overrides smoke with 24h jail and is consumed', () => {
  const s = fresh(); s.users['2'].inventory.tripwire = 1;
  const out = act(s, 'vault_crack', { tools: ['smoke_bomb'] }, () => 0).result;
  assert.equal(out.success, false); assert.equal(out.alarm, true); assert.equal(out.smoke, false);
  assert.equal(Date.parse(out.jailUntil) - +now, 86400000); assert.equal(s.users['2'].inventory.tripwire, 0);
});
check('scout shape and spyglass consumption', () => {
  const s = fresh(), out = act(s, 'vault_scout').result;
  assert.equal(out.intel.targetDiscordId, '2'); assert.equal(s.users['1'].inventory.spyglass, 1);
});
check('validation failures are atomic', () => {
  for (const [code, change, args, extra] of [
    ['not_owned', s => { s.users['1'].inventory.lockpick = 0; }, { tools: ['powder_keg', 'lockpick'] }],
    ['self_target', () => {}, { targetDiscordId: '1' }],
    ['target_poor', s => { s.users['2'].chest = 49; }],
    ['insufficient_funds', s => { s.users['1'].purse = 19; }],
    ['resealed', s => { s.users['2'].armory.resealUntil = '2026-10-14T20:00:00Z'; }],
    ['jailed', s => { s.users['1'].armory.jailUntil = '2026-10-14T20:00:00Z'; }],
    ['cooldown', s => { s.users['1'].cooldowns.vault = '2026-10-14T20:00:00Z'; }],
    ['protected_member', () => {}, {}, { targetImmune: true }],
  ]) { const s = fresh(); change(s); const before = structuredClone(s); assert.throws(() => act(s, 'vault_crack', args, () => .99, extra), { code }); assert.deepEqual(s, before); }
});
console.log(`${checks} engine groups passed; 576 odds vectors. No production data read or written.`);
