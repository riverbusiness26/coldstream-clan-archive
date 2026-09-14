import type { ActionKey, LedgerEntry, QuartermasterResult } from './quartermaster';

export type RewardLocation = 'duty' | 'ration' | 'forage' | 'countersteal' | 'crime' | 'duel' | 'splitsteal' | 'heist' | 'lottery' | 'anchor' | 'vingt' | 'account' | 'defence';
export type Reward = { id: string; location: RewardLocation; title: string; net: number; earned: number };

export function rewardEvents(previous: LedgerEntry[], ledger: LedgerEntry[]): Reward[] {
  const known = new Set(previous.map(entry => String(entry.id)));
  const groups = new Map<RewardLocation, { ids: string[]; net: number }>();
  for (const entry of ledger) {
    if (known.has(String(entry.id))) continue;
    let location: RewardLocation | undefined, net = entry.purseDelta + entry.chestDelta;
    if (['anchor_settle', 'vingt_settle'].includes(entry.type) && Number.isSafeInteger(entry.gamblingNet)) {
      location = entry.type === 'anchor_settle' ? 'anchor' : 'vingt'; net = entry.gamblingNet!;
    } else if (entry.type === 'duty' || entry.type === 'ration') location = entry.type;
    else if (['forage_win', 'forage_lose', 'forage_blocked', 'forage_fine'].includes(entry.type)) location = 'forage';
    else if (['forage_taken', 'forage_trap'].includes(entry.type)) location = 'defence';
    else if (['counter_win', 'counter_lose'].includes(entry.type)) location = 'countersteal';
    else if (['counter_taken'].includes(entry.type)) location = 'defence';
    else if (['crime_win', 'crime_lose'].includes(entry.type)) location = 'crime';
    else if (entry.type === 'duel_win' && Number.isSafeInteger(entry.gamblingNet)) { location = 'duel'; net = entry.gamblingNet!; }
    else if (entry.type === 'split_win' && Number.isSafeInteger(entry.gamblingNet)) { location = 'splitsteal'; net = entry.gamblingNet!; }
    else if (entry.type === 'heist_win' && Number.isSafeInteger(entry.gamblingNet)) { location = 'heist'; net = entry.gamblingNet!; }
    else if (entry.type === 'lottery_win' && Number.isSafeInteger(entry.gamblingNet)) { location = 'lottery'; net = entry.gamblingNet!; }
    else if (['transfer', 'grant', 'parade', 'payparade'].includes(entry.type) && net > 0) location = 'account';
    if (!location) continue;
    const group = groups.get(location) ?? { ids: [], net: 0 };
    group.ids.push(String(entry.id)); group.net += net; groups.set(location, group);
  }
  return [...groups].map(([location, { ids, net }]) => {
    const titles = { duty: 'Duty complete', ration: 'Daily Ration collected', forage: net > 0 ? 'Forage profit' : net < 0 ? 'Forage loss' : 'No Shillings gained', countersteal: net > 0 ? 'Shillings recovered' : 'Nothing recovered', crime: net > 0 ? 'The errand paid' : 'The provost caught you', duel: net > 0 ? 'Duel won' : 'Duel lost', splitsteal: net > 0 ? 'Pot taken' : 'No profit', heist: net > 0 ? 'Heist share paid' : 'Heist settled', lottery: net > 0 ? 'Winning ticket' : 'Draw settled', anchor: net > 0 ? 'You won!' : net < 0 ? 'You lost this roll' : 'Your bet was returned', vingt: net > 0 ? 'You won!' : net < 0 ? 'You lost this hand' : 'Your bet was returned', account: 'Shillings received', defence: net >= 0 ? 'Shillings recovered' : 'Shillings taken' };
    return { id: ids.sort().join(':'), location, title: titles[location], net, earned: Math.max(0, net) };
  });
}

export function actionFeedback(action: ActionKey, previous: LedgerEntry[], result: QuartermasterResult) {
  if (result.replayed) return null;
  return rewardEvents(previous, result.snapshot.ledger).find(event => event.location === action) ?? null;
}
