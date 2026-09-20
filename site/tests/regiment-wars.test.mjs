import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
async function load(path) { const r = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false }); return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`); }
const { CARDS, STARTER, BY_ID, PACKS } = await load('../src/regiment-wars/catalogue.ts');
const { freshSave, readSave, applyAction } = await load('../src/regiment-wars/store.ts');
const { startBattle, resolveExchange, validateDeck, alive } = await load('../src/regiment-wars/engine.ts');
const { deckSlots, deckStamp, fitsSlot, placeCard, removeCard, fillEmptySlots, nextOpenSlot, supportTip, tipsEnabled } = await load('../src/regiment-wars/deckLayout.ts');
const buy = (pack, id = pack) => ({ type: 'pack', pack, id, at: '2026-09-19T18:00:00Z' });
// Battle fixtures explicitly assemble a deck; claiming a starter now leaves placement to the player.
const starter = () => { const s = applyAction(applyAction(freshSave(), buy('starter')), { type: 'dismiss-pack' }); return applyAction(s, { type: 'deck', deck: { ...s.decks[0], cards: [...STARTER] } }); };

test('quick-add finds the next compatible gap and never replaces a full row silently', () => {
  const draft = deckSlots([]); draft[0] = 'inf-1'; draft[10] = 'officer-1';
  assert.equal(nextOpenSlot(draft, 'inf-2'), 1); assert.equal(nextOpenSlot(draft, 'fifer-1'), 11);
  const added = placeCard(draft, 'fifer-1', nextOpenSlot(draft, 'fifer-1'), STARTER);
  assert.equal(added[10], 'officer-1'); assert.equal(added[11], 'fifer-1');
  assert.equal(nextOpenSlot(STARTER, 'inf-20'), -1); assert.equal(nextOpenSlot(STARTER, 'officer-2'), -1);
  assert.equal(nextOpenSlot(draft, 'unknown'), -1);
});
test('deck tips default on, respect the saved off preference, and explain real support scope', () => {
  assert.equal(tipsEnabled(null), true); assert.equal(tipsEnabled('on'), true); assert.equal(tipsEnabled('off'), false);
  assert.match(supportTip('sergeant-1'), /two cards in its section/);
  assert.match(supportTip('fifer-1'), /steady volley/);
  assert.match(supportTip('officer-1'), /choose which section/);
  assert.match(supportTip('colours-1'), /whole line/);
  assert.match(supportTip('drummer-1'), /once per battle/);
});

test('dragging an owned replacement returns the previous card without duplicating or mutating the deck', () => {
  const original = [...STARTER]; const owned = [...STARTER, 'inf-11'];
  const next = placeCard(original, 'inf-11', 0, owned);
  assert.equal(next[0], 'inf-11'); assert.ok(!next.includes('inf-1')); assert.deepEqual(original, STARTER);
  assert.equal(new Set(next).size, 15); assert.deepEqual(validateDeck(next, owned), []);
  const s = starter(); s.owned = owned;
  const saved = applyAction(s, { type: 'deck', deck: { ...s.decks[0], cards: next } });
  assert.deepEqual(readSave(JSON.stringify(saved)).decks[0].cards, next);
});
test('dragging within a deck swaps occupied positions and moves into an empty position', () => {
  const swapped = placeCard(STARTER, 'inf-1', 9, STARTER);
  assert.equal(swapped[9], 'inf-1'); assert.equal(swapped[0], 'inf-10');
  const draft = removeCard(swapped, 'inf-10');
  const moved = placeCard(draft, 'inf-1', 0, STARTER);
  assert.equal(moved[0], 'inf-1'); assert.equal(moved[9], '');
  assert.deepEqual(placeCard(STARTER, STARTER[10], 14, STARTER).slice(10), [STARTER[14], ...STARTER.slice(11, 14), STARTER[10]]);
});
test('incompatible, unowned and outside drops cannot change a deck', () => {
  const original = [...STARTER];
  for (const [id, slot] of [['inf-1', 10], ['officer-1', 0], ['inf-20', 2], ['unknown', 0], ['inf-1', -1], ['inf-1', 15], ['inf-1', 1.5]]) {
    assert.throws(() => placeCard(original, id, slot, STARTER)); assert.deepEqual(original, STARTER);
  }
  assert.equal(fitsSlot('fifer-1', 14), true); assert.equal(fitsSlot('fifer-1', 9), false);
});
test('auto-fill preserves selected cards, uses only owned cards, and never repeats an identity', () => {
  const owned = [...STARTER, 'inf-20', 'officer-2'];
  const draft = deckSlots([]); draft[4] = 'inf-20'; draft[10] = 'officer-2';
  const filled = fillEmptySlots(draft, owned);
  assert.equal(filled[4], 'inf-20'); assert.equal(filled[10], 'officer-2'); assert.deepEqual(validateDeck(filled, owned), []);
  assert.deepEqual(draft.filter(Boolean), ['inf-20', 'officer-2']);
  assert.deepEqual(fillEmptySlots(filled, owned), filled);
  const partial = fillEmptySlots([], ['inf-1', 'officer-1']);
  assert.equal(partial.filter(Boolean).length, 2); assert.equal(partial[0], 'inf-1'); assert.equal(partial[10], 'officer-1');
  assert.deepEqual(fillEmptySlots([], CARDS.map(c => c.id)), STARTER);
});
test('empty deck positions explain missing cards without claiming duplicates or unknown cards', () => {
  const errors = validateDeck(deckSlots(['inf-1']), STARTER);
  assert.match(errors[0], /14 positions/);
  assert.ok(!errors.some(e => /unknown|only once|from your collection/.test(e)));
});
test('a removal can be undone through the normal save action without changing inventory or purse', () => {
  const s = starter(); const before = s.decks[0];
  const changed = applyAction(s, { type: 'deck', deck: { ...before, cards: removeCard(before.cards, 'fifer-1') } });
  assert.notEqual(deckStamp(changed.decks[0].cards), deckStamp(before.cards));
  const undone = applyAction(changed, { type: 'deck', deck: before });
  assert.deepEqual(undone.decks, s.decks); assert.deepEqual(undone.owned, s.owned); assert.equal(undone.purse, s.purse);
  assert.equal(deckStamp([]), deckStamp(Array(15).fill('')));
});
test('30 cards, full starter and four disclosed packs', () => { assert.equal(CARDS.length, 30); assert.equal(new Set(CARDS.map(c => c.id)).size, 30); assert.equal(CARDS.filter(c => c.role === 'infantry').length, 20); assert.deepEqual(validateDeck(STARTER), []); assert.equal(PACKS.length, 4); });
test('starter is free, complete, once only, and retry is idempotent', () => { const s = applyAction(freshSave(), buy('starter')); assert.equal(s.purse, 600); assert.equal(s.owned.length, 15); assert.ok(s.decks.every(d => deckSlots(d.cards).length === 15 && d.cards.every(id => !id))); assert.deepEqual(applyAction(s, buy('starter')), s); assert.throws(() => applyAction(applyAction(s, { type: 'dismiss-pack' }), buy('starter', 'second')), /already/); });
test('pack receipt and inventory survive reload before animation; pending pack blocks another charge', () => { const s = applyAction(starter(), buy('rare'), () => .01); assert.equal(s.purse, 510); assert.equal(s.pendingPack.cards.length, 5); assert.deepEqual(readSave(JSON.stringify(s)), s); assert.throws(() => applyAction(s, buy('common')), /Reveal/); });
test('rare and legendary guarantees survive the lowest random roll; duplicate supplies awarded within same pack', () => { for (const rarity of ['rare', 'legendary']) { const s = applyAction(starter(), buy(rarity), () => 0); assert.equal(BY_ID[s.pendingPack.cards.at(-1).id].rarity, rarity); assert.equal(s.pendingPack.cards[0].duplicate, true); assert.equal(s.supplies, (s.pendingPack.cards.length - 1) * 5); } });
test('failed purchase cannot overdraw or mutate state', () => { const s = starter(); s.purse = 20; const copy = structuredClone(s); assert.throws(() => applyAction(s, buy('common')), /more preview/); assert.deepEqual(s, copy); });
test('crafting checks supplies, spends once and grants only the chosen missing card', () => { const s = starter(); s.supplies = 120; const a = { type: 'craft', card: 'inf-11', id: 'craft-1', at: 'now' }; const n = applyAction(s, a); assert.equal(n.supplies, 0); assert.ok(n.owned.includes('inf-11')); assert.deepEqual(applyAction(n, a), n); assert.throws(() => applyAction(n, { ...a, id: 'craft-2' }), /already/); assert.throws(() => applyAction(n, { ...a, card: 'inf-12', id: 'craft-3' }), /more supplies/); });
test('decks accept repeated support roles but reject duplicate identities, wrong ranks and unowned cards', () => { const ids = [...STARTER]; ids[14] = 'officer-2'; assert.deepEqual(validateDeck(ids), []); assert.ok(validateDeck(ids, STARTER).some(e => /collection/.test(e))); ids[14] = ids[12]; assert.ok(validateDeck(ids).some(e => /once/.test(e))); ids[0] = 'officer-2'; assert.ok(validateDeck(ids).some(e => /front/.test(e))); });
test('formation drafts save but cannot enter a battle incomplete', () => { const s = starter(); const n = applyAction(s, { type: 'deck', deck: { ...s.decks[1], cards: ['inf-1'] } }); const active = applyAction(n, { type: 'active-deck', id: 'line-2' }); assert.throws(() => applyAction(active, { type: 'battle', tactic: 'balanced', id: 'battle' }), /15 cards/); });
test('five approaches close only one step per exchange and charge is gated until the sixth order', () => { let b = startBattle(STARTER, 'balanced', 'approach'); for (let i = 0; i < 5; i++) { assert.throws(() => resolveExchange(b, { order: 'charge' }), /range/); b.aiDecision = { order: 'advance' }; b = resolveExchange(b, { order: 'advance' }); assert.equal(b.distance, 4 - i); } assert.doesNotThrow(() => resolveExchange(b, { order: 'charge' })); });
test('simultaneous fire allows both lines to break, without spill to protected specialists', () => { const b = startBattle(STARTER, 'balanced', 'simultaneous'); for (const army of [b.player, b.enemy]) army.units.slice(0, 10).forEach(u => { u.hp = 1; }); b.aiDecision = { order: 'volley' }; const n = resolveExchange(b, { order: 'volley' }); assert.equal(n.result.winner, 'draw'); assert.equal(alive(n.player, 'infantry').length, 0); assert.equal(alive(n.enemy, 'infantry').length, 0); for (let i = 10; i < 15; i++) assert.equal(n.enemy.units[i].hp, b.enemy.units[i].hp); assert.throws(() => resolveExchange(n, { order: 'volley' }), /ended/); });
test('Brace reduces incoming charge damage', () => { const b = startBattle(STARTER, 'balanced', 'brace'); b.distance = 0; b.aiDecision = { order: 'charge' }; const brace = resolveExchange(b, { order: 'brace' }); const volley = resolveExchange(b, { order: 'volley' }); assert.ok(brace.log[0].playerDamage < volley.log[0].playerDamage); });
test('command and drummer powers are once per army; rally is limited', () => { let b = startBattle(STARTER, 'defensive', 'command'); b = resolveExchange(b, { order: 'advance', command: true, drum: true, section: 2 }); assert.equal(b.player.commandUsed, true); assert.equal(b.player.drumUsed, true); assert.throws(() => resolveExchange(b, { order: 'volley', command: true }), /unavailable/); assert.throws(() => resolveExchange(b, { order: 'advance', drum: true }), /unavailable/); b.player.rallies = 2; assert.throws(() => resolveExchange(b, { order: 'rally' }), /used/); });
test('AI order was committed before player order; source battle is immutable', () => { const b = startBattle(STARTER, 'balanced', 'commit'); const copy = structuredClone(b); const a = resolveExchange(b, { order: 'volley' }); const c = resolveExchange(b, { order: 'brace' }); assert.equal(a.log[0].enemy, c.log[0].enemy); assert.deepEqual(b, copy); });
test('line break ends immediately, preserves collection and records exactly one report with no payout', () => { let s = starter(); const original = structuredClone(s); s = applyAction(s, { type: 'battle', tactic: 'balanced', id: 'match' }); for (let i = 0; i < 30 && !s.battle.result; i++) s = applyAction(s, { type: 'order', decision: { order: 'volley' } }); assert.ok(s.battle.result); assert.equal(s.history.length, 1); assert.equal(s.purse, original.purse); assert.deepEqual(s.owned, original.owned); assert.deepEqual(readSave(JSON.stringify(s)), s); assert.throws(() => applyAction(s, { type: 'order', decision: { order: 'volley' } }), /ended/); });
test('surviving colours are saved; exposed fallen colours can be captured', () => { for (const keep of [true, false]) { const b = startBattle(STARTER, 'balanced', 'colours'); b.enemy.units.slice(0, 10).forEach(u => { u.hp = 1; }); if (!keep) b.enemy.units.find(u => BY_ID[u.cardId].role === 'colours').hp = 0; const n = resolveExchange(b, { order: 'volley' }); assert.equal(n.result.winner, 'player'); assert.match(n.result.colours, keep ? /saved/ : /captured/); } });
test('rare and legendary infantry have stronger corresponding stat patterns', () => { assert.ok(BY_ID['inf-13'].health > BY_ID['inf-1'].health); assert.ok(BY_ID['inf-13'].musket > BY_ID['inf-1'].musket); assert.ok(BY_ID['inf-18'].health > BY_ID['inf-2'].health); });
test('malformed saves fail closed instead of silently spending from a replacement save', () => { for (const raw of ['{', '{}', JSON.stringify({ ...freshSave(), purse: -1 }), JSON.stringify({ ...freshSave(), owned: ['missing'] })]) assert.throws(() => readSave(raw)); });
test('higher composure raises army morale and battle captures the formation name', () => { const ids = [...STARTER]; ids[0] = 'inf-18'; const ordinary = startBattle(STARTER, 'balanced', 'a'); const elite = startBattle(ids, 'balanced', 'b', 'Test Company'); assert.ok(elite.player.maxMorale > ordinary.player.maxMorale); assert.equal(elite.player.morale, elite.player.maxMorale); assert.equal(elite.playerName, 'Test Company'); });
test('audio stays silent until unlocked, military cues schedule safely, and mute stops further output', async () => {
  let created = 0; let starts = 0; let instance;
  const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {}, start() { starts++; }, stop() {}, frequency: parameter(), gain: parameter(), Q: parameter() });
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = class { constructor() { created++; instance = this; } state = 'running'; sampleRate = 8000; currentTime = 0; destination = {}; resume() { this.state = 'running'; return Promise.resolve(); } suspend() { this.state = 'suspended'; return Promise.resolve(); } createOscillator() { return node(); } createGain() { return node(); } createBiquadFilter() { return node(); } createBufferSource() { return node(); } createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; } };
  try { const sound = await load('../src/regiment-wars/sound.ts'); sound.packSound('legendary'); assert.equal(created, 0); assert.equal(starts, 0); sound.unlockPackAudio(); for (const cue of ['seal', 'deal', 'common', 'rare', 'legendary']) sound.packSound(cue); assert.ok(starts > 0); const before = starts; sound.mutePackAudio(); assert.equal(instance.state, 'suspended'); sound.packSound('legendary'); assert.equal(starts, before); } finally { if (previous) globalThis.AudioContext = previous; else delete globalThis.AudioContext; }
});
test('all three opponents finish across varied legal strategies within the 30-exchange limit', () => { const reports = []; for (const tactic of ['balanced', 'aggressive', 'defensive']) for (const strategy of ['volley', 'advance', 'brace', 'charge']) { let b = startBattle(STARTER, tactic, tactic + strategy); while (!b.result) { const order = strategy === 'charge' && b.distance ? 'advance' : strategy; b = resolveExchange(b, { order }); } assert.ok(b.log.length <= 30); reports.push(`${tactic}/${strategy}: ${b.log.length} exchanges, ${b.result.winner}`); } console.log(reports.join('\n')); });

test('starter grants cards without overwriting drafts or the selected deck', () => {
  const s = freshSave(); s.owned = ['inf-1']; s.decks[1].cards = ['inf-1']; s.activeDeck = s.decks[1].id;
  const n = applyAction(s, buy('starter')); assert.deepEqual(n.decks, s.decks); assert.equal(n.activeDeck, s.activeDeck); assert.equal(n.owned.length, 15);
});
test('clearing a deck retains cards and other decks, persists 15 empty slots and supports restoration', () => {
  const s = starter(); const cards = s.decks[0].cards;
  const n = applyAction(s, { type: 'deck', deck: { ...s.decks[0], cards: deckSlots([]) } });
  assert.deepEqual(n.owned, s.owned); assert.deepEqual(n.decks.slice(1), s.decks.slice(1));
  assert.deepEqual(readSave(JSON.stringify(n)).decks[0].cards, Array(15).fill(''));
  assert.throws(() => applyAction(n, { type: 'battle', tactic: 'balanced', id: 'empty' }), /15 cards/);
  const restored = applyAction(n, { type: 'deck', deck: { ...n.decks[0], cards } }); assert.deepEqual(restored.decks, s.decks);
});
