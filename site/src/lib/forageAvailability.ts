type ForageAvailability = {
  frozen: boolean; busy: boolean; unknown: boolean; billet: boolean; billetWait: string; forageWait: string;
  protectionHours: number; hasPeers: boolean;
  target?: { displayName: string; purse: number };
  minimum: number;
};

export function forageBlockers(state: ForageAvailability): string[] {
  const reasons: string[] = [];
  if (state.frozen) reasons.push('Your account is frozen. Ask an admin or moderator for help.');
  if (state.unknown) reasons.push('Confirm your previous request with Retry same request before starting another action.');
  else if (state.busy) reasons.push('Wait for your current account action to finish.');
  if (state.billet) reasons.push(`Your Billet protection is on, so you cannot forage. Turn it off below; protection then lasts ${state.protectionHours} hours.`);
  else if (state.billetWait) reasons.push(`You can forage when your remaining Billet protection ends in ${state.billetWait}.`);
  if (state.forageWait) reasons.push(`Your next forage is available in ${state.forageWait}.`);
  if (!state.hasPeers) reasons.push('Other members appear here after opening their Pay Chest. Refresh balances to check again.');
  else if (!state.target) reasons.push('Choose a member to forage from.');
  if (state.target && state.target.purse < state.minimum) reasons.push(`${state.target.displayName} has ${state.target.purse.toLocaleString()} Shillings in their Wallet. A target needs at least ${state.minimum.toLocaleString()} Shillings. Pay Chest savings do not count.`);
  return reasons;
}
