import type { ActionKey, LedgerEntry, QuartermasterResult } from './quartermaster';

export function actionFeedback(action: ActionKey, previous: LedgerEntry[], result: QuartermasterResult) {
  // A replay confirms an old receipt, so it must not look like a second reward.
  if (result.replayed) return null;
  const titles: Record<ActionKey, string> = { duty: 'Duty complete', ration: 'Daily Ration collected', buy: 'Added to your kit', deposit: 'Savings secured', withdraw: 'Wallet ready', transfer: 'Shillings sent', forage: 'Forage complete', billet: 'Protection updated', anchor: 'Dice settled', vingt: 'Hand updated', use: 'Item used', title: 'Title updated' };
  const known = new Set(previous.map(entry => entry.id));
  const earned = action === 'duty' || action === 'ration'
    ? result.snapshot.ledger.filter(entry => entry.type === action && !known.has(entry.id)).reduce((sum, entry) => sum + Math.max(0, entry.purseDelta), 0)
    : 0;
  return { title: titles[action], earned };
}
