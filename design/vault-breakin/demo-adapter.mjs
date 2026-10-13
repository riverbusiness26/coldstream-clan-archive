// In-memory fixtures ONLY. No storage, HTTP, authentication or real Discord IDs.
import { TOOLS, count, eligibility, estimate } from './model.mjs';
export const TIERS = [
  ['Wooden strongbox', 0, .09, .25], ['Padlocked chest', 150, .075, .22],
  ['Iron-bound chest', 350, .062, .20], ['Double-lock safe', 700, .05, .18],
  ['Quartermaster safe', 1200, .04, .16], ['Bank vault', 2000, .031, .14],
  ['Fortified vault', 3200, .023, .12], ['Tower strongroom', 5000, .016, .10],
  ['Crown treasury', 8000, .01, .08],
].map(([name, cost, chance, takeMax]) => ({ name, cost, chance, takeMax }));
export function fixture(now = Date.now()) {
  return { profile: { discordId: 'demo-you', displayName: 'You', purse: 240, chest: 860 },
    inventory: [...TOOLS.map(t => ({ slug: t.slug, name: t.name, qty: 2 })), { slug: 'spyglass', qty: 3 }],
    cooldowns: { vault: null }, serverTime: new Date(now).toISOString(),
    armory: { tiers: structuredClone(TIERS), rules: { entry: 20, minChest: 50, cooldownSeconds: 10800 },
      card: { vault: { level: 2, name: 'Iron-bound chest' }, renown: { level: 8 } },
      nextVault: { level: 3, name: 'Double-lock safe', cost: 700 }, jailUntil: null,
      defences: { guardDogs: 1, tripwires: 0 }, vaultAlerts: [], feed: [] },
    leaderboard: [
      { discordId: 'demo-you', displayName: 'You', chest: 860, vaultLevel: 2, renownLevel: 8 },
      { discordId: 'demo-ash', displayName: 'Ash · Sample member', chest: 1400, vaultLevel: 3, renownLevel: 12 },
      { discordId: 'demo-flint', displayName: 'Flint · Sample member', chest: 620, vaultLevel: 1, renownLevel: 4 },
      { discordId: 'demo-reed', displayName: 'Reed · Sample member', chest: 3200, vaultLevel: 6, renownLevel: 25 },
      { discordId: 'demo-wren', displayName: 'Wren · Sample member', chest: 25, vaultLevel: 0, renownLevel: 1 },
    ] };
}
export function createDemoAdapter({ latency = 350, now = () => Date.now() } = {}) {
  let wallet = fixture(now()), scenario = 'success';
  const read = () => structuredClone(wallet);
  const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
  return { previewOnly: true, async read() { return read(); }, reset(next = 'success') { scenario = next; wallet = fixture(now()); },
    async action(name, args = {}) {
      await new Promise(resolve => setTimeout(resolve, latency));
      if (scenario === 'network') fail('network', 'Simulated connection failure');
      if (name === 'vault_upgrade') {
        const next = wallet.armory.nextVault;
        if (!next) fail('vault_max', 'Maximum tier');
        if (wallet.profile.purse + wallet.profile.chest < next.cost) fail('insufficient_funds');
        const chest = Math.min(wallet.profile.chest, next.cost);
        wallet.profile.chest -= chest; wallet.profile.purse -= next.cost - chest;
        wallet.armory.card.vault = { level: next.level, name: next.name };
        wallet.armory.nextVault = TIERS[next.level + 1] ? { ...TIERS[next.level + 1], level: next.level + 1 } : null;
        return { snapshot: read(), message: 'Preview vault upgraded.', game: { vaultLevel: next.level, name: next.name } };
      }
      const target = wallet.leaderboard.find(t => t.discordId === args.targetDiscordId);
      if (!target || target.discordId === wallet.profile.discordId) fail('self_target');
      const intel = { targetDiscordId: target.discordId, name: target.displayName, vaultLevel: target.vaultLevel,
        vaultName: TIERS[target.vaultLevel].name, chestBand: 'Sample balance', guardDogs: target.discordId === 'demo-ash' ? 1 : 0,
        tripwire: scenario === 'tripwire', renownLevel: target.renownLevel, resealedUntil: null };
      const consume = slug => { if (!count(wallet, slug)) fail('not_owned'); wallet.inventory.find(i => i.slug === slug).qty--; };
      if (name === 'vault_scout') { consume('spyglass'); return { snapshot: read(), game: { intel }, message: 'Preview scout report ready.' }; }
      if (name !== 'vault_crack') fail('unknown_action');
      const reason = eligibility(wallet, target, intel, now());
      if (reason) fail('cooldown', reason);
      const loadout = [...new Set(args.tools ?? [])];
      if (loadout.length > 4 || loadout.some(t => !TOOLS.some(x => x.slug === t))) fail('invalid_tools');
      if (loadout.some(t => count(wallet, t) < 1)) fail('not_owned');
      loadout.forEach(consume);
      wallet.profile.purse -= wallet.armory.rules.entry;
      const odds = estimate(wallet, target, loadout, intel);
      const success = ['success', 'motherlode'].includes(scenario);
      const game = { success, chance: odds.chance, dog: intel.guardDogs > 0, alarm: intel.tripwire, loadout, target: target.displayName };
      if (success) {
        game.motherlode = scenario === 'motherlode'; game.amount = game.motherlode ? odds.motherlode : odds.high;
        wallet.profile.purse += game.amount; target.chest -= game.amount;
      } else {
        game.smoke = loadout.includes('smoke_bomb') && !game.alarm;
        game.fine = game.smoke ? 0 : Math.min(wallet.profile.purse, 60, Math.max(5, Math.floor(wallet.profile.purse * .12)));
        game.jailUntil = game.smoke ? null : new Date(now() + (game.alarm ? 24 : 8) * 3600000).toISOString();
        wallet.profile.purse -= game.fine; wallet.armory.jailUntil = game.jailUntil;
      }
      wallet.cooldowns.vault = new Date(now() + 10800000).toISOString();
      wallet.armory.feed.unshift({ kind: success ? 'heist' : 'caught', actorId: 'demo-you', actorName: 'You', targetId: target.discordId,
        text: success ? `Preview: you cracked ${target.displayName}'s vault.` : 'Preview: the lock held.' });
      return { snapshot: read(), game, message: success ? 'The last tumbler falls.' : game.smoke ? 'You escape in smoke.' : 'The sentry heard you.' };
    },
  };
}
