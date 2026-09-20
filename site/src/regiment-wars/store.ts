import { BY_ID, CARDS, PACKS, STARTER, CRAFT_COST, DUPLICATE_SUPPLIES, type PackId, type Rarity } from './catalogue';
import { startBattle, resolveExchange, validateDeck, type Battle, type Decision, type Tactic } from './engine';
export const SAVE_KEY = 'coldstream-regiment-wars-preview-v1';
export type Deck = { id: string; name: string; cards: string[] };
export type Receipt = { id: string; name: string; amount: number; cards: { id: string; duplicate: boolean; supplies: number }[]; at: string };
export type Save = { version: 1; revision: number; purse: number; supplies: number; starterClaimed: boolean; owned: string[]; decks: Deck[]; activeDeck: string; battle: Battle | null; history: Battle[]; receipts: Receipt[]; pendingPack: Receipt | null };
export function freshSave(): Save { return { version: 1, revision: 0, purse: 600, supplies: 0, starterClaimed: false, owned: [], decks: [{ id: 'line-1', name: 'First Company', cards: [] }, { id: 'line-2', name: 'Second Company', cards: [] }, { id: 'line-3', name: 'Reserve Company', cards: [] }], activeDeck: 'line-1', battle: null, history: [], receipts: [], pendingPack: null }; }
const integer = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
export function readSave(raw: string | null): Save {
  if (!raw) return freshSave();
  const s = JSON.parse(raw) as Save;
  if (s.version !== 1 || !integer(s.revision) || !integer(s.purse) || !integer(s.supplies) || typeof s.starterClaimed !== 'boolean' || !Array.isArray(s.owned) || s.owned.some(id => !BY_ID[id]) || new Set(s.owned).size !== s.owned.length || !Array.isArray(s.decks) || s.decks.length !== 3 || !s.decks.some(d => d.id === s.activeDeck)) throw new Error('The local save could not be read.');
  for (const deck of s.decks) if (typeof deck.name !== 'string' || deck.name.length > 40 || !Array.isArray(deck.cards) || deck.cards.some(id => id !== '' && !s.owned.includes(id)) || deck.cards.length > 15) throw new Error('The saved formation could not be read.');
  const validReceipt = (r: Receipt) => r && typeof r.id === 'string' && typeof r.name === 'string' && typeof r.at === 'string' && integer(r.amount) && Array.isArray(r.cards) && r.cards.every(c => BY_ID[c.id] && typeof c.duplicate === 'boolean' && integer(c.supplies));
  if (!Array.isArray(s.receipts) || !s.receipts.every(validReceipt) || s.pendingPack !== null && !validReceipt(s.pendingPack) || !Array.isArray(s.history) || s.history.length > 20) throw new Error('The local journal could not be read.');
  for (const battle of [...s.history, ...(s.battle ? [s.battle] : [])]) {
    if (typeof battle.id !== 'string' || typeof battle.playerName !== 'string' || !integer(battle.round) || battle.round < 1 || battle.round > 31 || !integer(battle.distance) || battle.distance > 5 || !Array.isArray(battle.log) || !['balanced', 'aggressive', 'defensive'].includes(battle.tactic) || !battle.aiDecision) throw new Error('The saved battle could not be read.');
    for (const army of [battle.player, battle.enemy]) if (!army || !integer(army.morale) || army.morale > army.maxMorale || !integer(army.maxMorale) || army.maxMorale < 21 || army.maxMorale > 30 || !integer(army.rallies) || army.rallies > 2 || typeof army.commandUsed !== 'boolean' || typeof army.drumUsed !== 'boolean' || !Array.isArray(army.units) || army.units.length !== 15 || army.units.some((u, i) => u.slot !== i || !BY_ID[u.cardId] || !integer(u.hp) || u.hp > BY_ID[u.cardId].health)) throw new Error('The saved line could not be read.');
  }
  return s;
}
export type Action = { type: 'pack'; pack: PackId; id: string; at: string } | { type: 'dismiss-pack' } | { type: 'craft'; card: string; id: string; at: string } | { type: 'deck'; deck: Deck } | { type: 'active-deck'; id: string } | { type: 'battle'; tactic: Tactic; id: string } | { type: 'order'; decision: Decision } | { type: 'retire' };
function pickCard(rarity: Rarity, random: () => number) { const pool = CARDS.filter(c => c.rarity === rarity); return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))].id; }
export function applyAction(save: Save, action: Action, random: () => number = Math.random): Save {
  const next = structuredClone(save);
  if (action.type === 'pack') {
    if (next.receipts.some(r => r.id === action.id)) return save;
    if (next.pendingPack) throw new Error('Reveal your unopened pack first.');
    const pack = PACKS.find(p => p.id === action.pack); if (!pack) throw new Error('Unknown pack.');
    if (pack.id === 'starter' && next.starterClaimed) throw new Error('Your starter pack has already been issued.');
    if (next.purse < pack.price) throw new Error('You need more preview Shillings for this pack.');
    const cards = pack.id === 'starter' ? [...STARTER] : Array.from({ length: pack.count }, (_, index) => {
      const roll = random() * 100;
      let rarity: Rarity = roll < pack.odds[0] ? 'common' : roll < pack.odds[0] + pack.odds[1] ? 'rare' : 'legendary';
      // The final slot upgrades to the minimum rarity without a second charge or roll.
      if (index === pack.count - 1 && pack.guarantee === 'legendary') rarity = 'legendary';
      else if (index === pack.count - 1 && pack.guarantee === 'rare' && rarity === 'common') rarity = 'rare';
      return pickCard(rarity, random);
    });
    const received = cards.map(id => { const duplicate = next.owned.includes(id); const supplies = duplicate ? DUPLICATE_SUPPLIES[BY_ID[id].rarity] : 0; if (!duplicate) next.owned.push(id); next.supplies += supplies; return { id, duplicate, supplies }; });
    const receipt: Receipt = { id: action.id, name: pack.name, amount: pack.price, cards: received, at: action.at };
    next.purse -= pack.price; next.receipts.unshift(receipt); next.pendingPack = receipt;
    if (pack.id === 'starter') { next.starterClaimed = true; }
  } else if (action.type === 'dismiss-pack') next.pendingPack = null;
  else if (action.type === 'craft') {
    if (next.receipts.some(r => r.id === action.id)) return save;
    const card = BY_ID[action.card]; if (!card) throw new Error('Unknown card.');
    if (next.owned.includes(card.id)) throw new Error('This card is already in your collection.');
    if (next.supplies < CRAFT_COST[card.rarity]) throw new Error('You need more supplies to commission this card.');
    next.supplies -= CRAFT_COST[card.rarity]; next.owned.push(card.id);
    next.receipts.unshift({ id: action.id, name: `Commissioned ${card.name}`, amount: 0, cards: [{ id: card.id, duplicate: false, supplies: 0 }], at: action.at });
  } else if (action.type === 'active-deck') { if (!next.decks.some(d => d.id === action.id)) throw new Error('Unknown formation.'); next.activeDeck = action.id; }
  else if (action.type === 'deck') {
    if (!next.decks.some(d => d.id === action.deck.id)) throw new Error('Unknown formation.');
    if (!action.deck.name.trim() || action.deck.name.length > 40 || action.deck.cards.length > 15 || action.deck.cards.some(id => id !== '' && !next.owned.includes(id))) throw new Error('This formation cannot be saved.');
    const ids = action.deck.cards.filter(Boolean); if (new Set(ids).size !== ids.length) throw new Error('Each card can appear only once.');
    action.deck.cards.forEach((id, i) => { if (id && (BY_ID[id].role === 'infantry') !== (i < 10)) throw new Error('That card does not fit this rank.'); });
    next.decks = next.decks.map(d => d.id === action.deck.id ? structuredClone(action.deck) : d);
  } else if (action.type === 'battle') {
    if (next.battle && !next.battle.result) throw new Error('Finish or retire from your current battle first.');
    const deck = next.decks.find(d => d.id === next.activeDeck)!; const errors = validateDeck(deck.cards, next.owned); if (errors.length) throw new Error(errors[0]);
    next.battle = startBattle(deck.cards, action.tactic, action.id, deck.name);
  } else if (action.type === 'order') {
    if (!next.battle) throw new Error('Muster your line first.');
    next.battle = resolveExchange(next.battle, action.decision);
    if (next.battle.result) next.history = [next.battle, ...next.history.filter(b => b.id !== next.battle!.id)].slice(0, 20);
  } else if (action.type === 'retire') {
    if (!next.battle || next.battle.result) throw new Error('There is no active battle to retire from.');
    next.battle.result = { winner: 'enemy', reason: 'You ordered a withdrawal.', playerWithdrawal: 'Voluntary withdrawal', enemyWithdrawal: 'Line held', colours: 'Your colours and collection are safe.' };
    next.history = [next.battle, ...next.history].slice(0, 20);
  }
  next.revision++; return next;
}
