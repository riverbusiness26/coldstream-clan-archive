import { BY_ID, CARDS, STARTER } from './catalogue';

export const deckSlots = (cards: string[]) => Array.from({ length: 15 }, (_, i) => cards[i] || '');
export const fitsSlot = (id: string, slot: number) => Number.isInteger(slot) && slot >= 0 && slot < 15 && !!BY_ID[id] && (BY_ID[id].role === 'infantry') === (slot < 10);
export const deckStamp = (cards: string[]) => JSON.stringify(deckSlots(cards));

export const TIPS_KEY = 'rw-deck-tips';
export const tipsEnabled = (value: string | null) => value !== 'off';

export function nextOpenSlot(cards: string[], id: string) {
  return deckSlots(cards).findIndex((card, slot) => !card && fitsSlot(id, slot));
}

export function supportTip(id: string) {
  const role = BY_ID[id]?.role;
  if (role === 'sergeant') return 'Place behind the infantry you want to protect. This Sergeant reduces incoming hits on the two cards in its section.';
  if (role === 'fifer') return 'Place behind your strongest shooters. This Fifer adds musket damage to the two infantry in its section during a steady volley.';
  if (role === 'officer') return 'An Officer unlocks one Coordinated volley per battle. You choose which section receives it when issuing the order.';
  if (role === 'drummer') return 'A Drummer unlocks Quick Step once per battle. It preserves Fifer bonuses while your line advances.';
  if (role === 'colours') return 'A Colour Sergeant protects the morale of your whole line while alive. Place behind a pair with enough health to protect the support card.';
  return 'Health keeps this soldier in the fight. Musket damage helps at range; bayonet damage helps up close. Morale contributes to your line’s starting resolve.';
}

/** Move an existing card (swapping an occupied target), or replace from the collection. */
export function placeCard(cards: string[], id: string, slot: number, owned: string[]) {
  if (!owned.includes(id) || !fitsSlot(id, slot)) throw new Error('Infantry belong in the front two rows; support belongs in the back row.');
  const next = deckSlots(cards);
  const previous = next.indexOf(id);
  if (previous >= 0 && previous !== slot) next[previous] = next[slot];
  next[slot] = id;
  return next;
}

export function removeCard(cards: string[], id: string) {
  return deckSlots(cards).map(card => card === id ? '' : card);
}

/** Fill only gaps, preserving every choice the player already made. */
export function fillEmptySlots(cards: string[], owned: string[]) {
  const next = deckSlots(cards);
  const candidates = [...STARTER.map(id => BY_ID[id]), ...CARDS.filter(c => !STARTER.includes(c.id))];
  for (let slot = 0; slot < next.length; slot++) {
    if (next[slot]) continue;
    next[slot] = candidates.find(c => owned.includes(c.id) && !next.includes(c.id) && fitsSlot(c.id, slot))?.id || '';
  }
  return next;
}
