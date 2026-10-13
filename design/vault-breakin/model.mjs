// Presentation calculations only. The server remains the authority for every outcome.
export const TOOLS = Object.freeze([
  { slug: 'lockpick', name: 'Lockpick', icon: 'key', description: '+2.5 percentage points before other modifiers.' },
  { slug: 'skeleton_key', name: 'Skeleton key', icon: 'key', description: 'Treat the vault as three tiers lower.' },
  { slug: 'powder_keg', name: 'Powder keg', icon: 'powder', description: 'Multiply odds and maximum haul by 1.5 and 1.4.' },
  { slug: 'smoke_bomb', name: 'Smoke bomb', icon: 'smoke', description: 'Escape ordinary fines and jail. Tripwires still catch you.' },
]);
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const count = (wallet, slug) => Math.max(0, wallet?.inventory?.find(item => item.slug === slug)?.qty ?? 0);
export const activeUntil = (until, now = Date.now()) => Number.isFinite(Date.parse(until)) && Date.parse(until) > now;
export function eligibility(wallet, target, intel, now = Date.now()) {
  if (!wallet?.armory?.tiers?.length || !wallet?.armory?.rules) return 'Vault data is unavailable. Refresh before continuing.';
  if (!target) return 'Choose a member first.';
  if (target.discordId === wallet.profile.discordId) return 'This is your own Pay Chest.';
  if (activeUntil(wallet.armory.jailUntil, now)) return 'You are in the guardhouse. Come back after your release.';
  if (activeUntil(wallet.cooldowns?.vault, now)) return 'Your next attempt is not ready yet.';
  if (activeUntil(intel?.resealedUntil, now)) return 'This vault is resealed after a recent break-in.';
  if (target.chest < wallet.armory.rules.minChest) return 'This Pay Chest is below the minimum balance.';
  if (wallet.profile.purse < wallet.armory.rules.entry) return 'Not enough Shillings in your wallet for the entry fee.';
  return null;
}
export function estimate(wallet, target, loadout = [], intel = null) {
  if (!target || !wallet?.armory?.tiers?.length) return null;
  const tiers = wallet.armory.tiers;
  const level = Math.max(0, Math.min(tiers.length - 1, (intel?.vaultLevel ?? target.vaultLevel ?? 0) - (loadout.includes('skeleton_key') ? 3 : 0)));
  const tier = tiers[level];
  const renown = Math.max(1, intel?.renownLevel ?? target.renownLevel ?? 1);
  let chance = tier.chance + (loadout.includes('lockpick') ? 0.025 : 0);
  if (loadout.includes('powder_keg')) chance *= 1.5;
  chance *= 1 - Math.min(.3, (renown - 1) * .012);
  chance = Math.max(.005, Math.min(.3, chance));
  // Actual engine applies dog AFTER its clamp. Do not clamp a second time.
  if (intel?.guardDogs > 0) chance *= .6;
  if (intel?.tripwire) chance = 0;
  const take = tier.takeMax * (loadout.includes('powder_keg') ? 1.4 : 1);
  const haul = fraction => Math.max(1, Math.min(2500, Math.floor(target.chest * Math.min(.5, fraction))));
  return { chance, level, low: haul(take * .45), high: haul(take), motherlode: haul(take * 2), scouted: Boolean(intel) };
}
export const ERRORS = Object.freeze({
  cooldown: 'Your next attempt is not ready. Refresh your Pay Chest.',
  jailed: 'You are still in the guardhouse.', resealed: 'That vault has been resealed. Choose another member.',
  target_poor: 'That Pay Chest is now below the minimum balance.', insufficient_funds: 'Your wallet no longer covers the cost.',
  protected_member: 'That member is protected from break-ins.', self_target: 'You cannot target your own Pay Chest.',
  not_owned: 'A selected tool is no longer in your kit.', invalid_tools: 'Choose only the four listed break-in tools.',
});
export function errorText(error) {
  return ERRORS[error?.code] ?? 'We could not confirm the result. Refresh to check your wallet before trying again. Do not repeat the attempt yet.';
}
// Never automatically retry a spending action. Unknown response means unknown outcome.
export function createActionGate(adapter) {
  let busy = false;
  return { get busy() { return busy; }, async run(name, args) {
    if (busy) throw Object.assign(new Error('Action already pending'), { code: 'pending' });
    busy = true;
    try { return await adapter.action(name, args); } finally { busy = false; }
  } };
}
