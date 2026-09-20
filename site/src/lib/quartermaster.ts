import { supa } from './supa';
import economyConfig from '../quartermaster-data/economy.json';
import seed from '../quartermaster-data/seed.json';
import type { ActivityLevel } from './activityLevels';

// Production rebuilds must retain the public API address when no override is set.
export const QUARTERMASTER_API_URL = (import.meta.env.VITE_QUARTERMASTER_API_URL as string | undefined)?.trim().replace(/\/$/, '') || 'https://panel.coldstreamgaming.com/quartermaster-api';
export type QuartermasterConfig = typeof economyConfig;
export type Honour = string | { id: string; name: string };
export type CatalogueItem = { slug: string; name: string; category: string; price: number; effect: string; max_stack: number; charges?: number; description?: string; title_id?: string; slot?: string };
export type KitItem = { slug: string; name: string; qty: number; effect: string };
export type Profile = { activityLevels?: ActivityLevel[]; equipment?: Record<string, string>; gameRecord?: Record<string, {wins: number; played: number}>; discordId: string; displayName: string; purse: number; chest: number; net: number; lifetimeEarned: number; streak: number; dutiesWeek: number; title: string; billet: boolean; billetUntil: string | null; frozen: boolean; lanternCharges: number; caltropCharges: number; warrantCharges: number; dutyBoost: boolean; streakSaver: boolean; medals: Honour[]; titles: Honour[] };
export type LedgerEntry = { id: number | string; type: string; purseDelta: number; chestDelta: number; balanceAfter: number; createdAt: string; description: string; gamblingNet?: number; gameId?: string };
export type ForageAlert = { id: number | string; createdAt: string; description: string; attackerName: string; outcome: 'taken' | 'failed' | 'blocked'; taken: number; recovered: number };
export type BoardMember = Pick<Profile, 'discordId' | 'displayName' | 'purse' | 'chest' | 'net' | 'streak' | 'dutiesWeek' | 'title'> & { forageWins: number };
export type VingtGame = { playerCards?: {rank: string; suit: string | null}[]; dealerCards?: ({rank: string; suit: string | null} | null)[]; id: string; player: number[]; dealer: number[]; playerTotal: number; dealerTotal: number; stake: number; status: string; expiresAt: string; canDouble: boolean; net?: number; payout?: number };
export type SocialGame = { rewardPot?: number; id: string; status: string; challengerId: string; challengerName: string; targetId: string; targetName: string; stake: number; createdAt: string; expiresAt: string; winnerId?: string; winnerName?: string; targetChoice?: 'split' | 'steal'; result?: string };
export type Heist = { version?: number; result?: string; payoutEach?: number; rules?: QuartermasterConfig['heist']; id: string; status: string; creatorId: string; creatorName: string; participants: { discordId: string; displayName: string }[]; pot: number; createdAt: string; expiresAt: string; winners?: { discordId: string; displayName: string }[] };
export type Lottery = { entrants?: number; totalTickets?: number; rolloverReason?: string | null; drawId: string; pot: number; drawsAt: string; ownTickets: number; lastResult: { drawId: string; winnerId: string | null; winnerName: string | null; pot: number; resolvedAt: string } | null };
export type SocialSnapshot = { splitFreeAvailable?: boolean; counterAvailable: { noticeId: string; attackerName: string; taken: number; createdAt: string } | null; duels: SocialGame[]; splitGames: SocialGame[]; heist: Heist | null; lottery: Lottery | null };
export type QuartermasterSnapshot = { profile: Profile; cooldowns: Partial<Record<'work' | 'daily' | 'steal' | 'crime' | 'withdraw' | 'gamble' | 'heist', string | null>>; catalogue: CatalogueItem[]; inventory: KitItem[]; ledger: LedgerEntry[]; forageAlerts?: ForageAlert[]; leaderboard: BoardMember[]; game: VingtGame | null; social: SocialSnapshot; config: QuartermasterConfig; serverTime: string; preview: boolean };
export type ActionKey = 'duty' | 'ration' | 'deposit' | 'withdraw' | 'transfer' | 'forage' | 'countersteal' | 'crime' | 'duel' | 'splitsteal' | 'heist' | 'lottery' | 'mostwanted' | 'billet' | 'anchor' | 'vingt' | 'buy' | 'use' | 'equip' | 'title';
export type ActionArgs = Record<string, string | number | boolean>;
export type QuartermasterResult = { message: string; snapshot: QuartermasterSnapshot; game?: Record<string, unknown> | VingtGame | null; replayed?: boolean };

export class QuartermasterError extends Error {
  constructor(message: string, public retryable = false, public code = 'UNAVAILABLE') { super(message); }
}

export function localPreviewAllowed(demo: boolean) {
  if (!demo || !QUARTERMASTER_API_URL) return false;
  try {
    const hostname = new URL(QUARTERMASTER_API_URL).hostname;
    return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  } catch { return false; }
}

async function request(path: string, demo: boolean, body?: unknown) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (localPreviewAllowed(demo)) headers['X-Quartermaster-Preview'] = 'local-only';
  else {
    const session = supa ? (await supa.auth.getSession()).data.session : null;
    if (!session) throw new QuartermasterError('Sign in with Discord to open your Pay Chest.', false, 'SIGN_IN_REQUIRED');
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  if (body) headers['Content-Type'] = 'application/json';
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${QUARTERMASTER_API_URL}${path}`, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal, credentials: 'omit' });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new QuartermasterError(result.message || 'The Quartermaster could not complete that request.', Boolean(result.retryable) || response.status >= 500, result.code);
    if (!result.data) throw new QuartermasterError('The Quartermaster returned an incomplete account record.', true);
    return result.data;
  } catch (error) {
    if (error instanceof QuartermasterError) throw error;
    throw new QuartermasterError(body ? 'The receipt has not arrived. Your action may have completed. Retry the same request to check it safely.' : 'The Quartermaster is not answering. Please try opening the account again.', true);
  } finally { window.clearTimeout(timeout); }
}

export async function readQuartermaster(demo: boolean, updates = false): Promise<QuartermasterSnapshot> { return request(updates ? '/updates' : '/me', demo); }
export async function actQuartermaster(action: ActionKey, args: ActionArgs, requestId: string, demo: boolean): Promise<QuartermasterResult> { return request('/action', demo, { action, args, requestId }); }
export const newRequestId = () => crypto.randomUUID();
export const isVingtActive = (game: VingtGame | null) => Boolean(game && ['active', 'playing', 'player_turn', 'pending'].includes(game.status));
export const titleName = (title: string) => seed.titles.find((entry) => entry.id === title)?.name ?? title;
export const honourId = (honour: Honour) => typeof honour === 'string' ? honour : honour.id;
export const honourName = (honour: Honour) => typeof honour === 'string' ? seed.medals.find((entry) => entry.id === honour)?.name ?? titleName(honour) : honour.name;
export const shillings = (value: number) => `${value.toLocaleString()} ${Math.abs(value) === 1 ? 'Shilling' : 'Shillings'}`;
export function pounds(value: number, size = economyConfig.currency.pound_size) { return value >= size ? `£${Math.floor(value / size).toLocaleString()}${value % size ? ` ${shillings(value % size)}` : ''}` : shillings(value); }
export const itemDescription = (item: CatalogueItem | KitItem) => ('description' in item && item.description) || ({
  lantern: 'Protects your Wallet from two forage attempts. Active as soon as you buy it.',
  caltrops: 'May fine a member who tries to forage from you. Active as soon as you buy it.',
  warrant: 'A written authority to pass one sentry lantern. Armed when bought.',
  duty_boost: 'Boosts the Shillings earned from your next duty. Use it from your inventory.',
  streak_saver: 'Protects your daily streak if you miss one Daily Ration. Use it from your inventory.',
  flavour: 'A small comfort for the mess. Kept in your collection.',
  title_unlock: 'A name worth putting on the record. Unlocks a profile title.',
  cosmetic: 'A permanent profile decoration. Equip it from Your Profile.',
  collectible: 'A permanent keepsake for one of your six profile display positions.',
  rename: 'Have a title of your own engraved, up to 32 characters. Changes your Pay Chest title.',
} as Record<string, string>)[item.effect] || 'Issued by the Quartermaster.';

// The fallback is a disposable demonstration. Connected accounts always use the server ledger.
export function makePreviewSnapshot(): QuartermasterSnapshot {
  const profile: Profile = { discordId: 'preview-member', displayName: 'Preview member', purse: 168, chest: 320, net: 488, lifetimeEarned: 612, streak: 6, dutiesWeek: 4, title: 'private', billet: false, billetUntil: null, frozen: false, lanternCharges: 2, caltropCharges: 0, warrantCharges: 0, dutyBoost: false, streakSaver: false, medals: [], titles: ['recruit', 'private', 'upper_crust'] };
  return { profile, cooldowns: {}, catalogue: seed.items, inventory: [{ slug: 'grog', name: 'Extra-duty grog', qty: 1, effect: 'duty_boost' }, { slug: 'pack_cards', name: 'Pack of cards', qty: 1, effect: 'flavour' }], ledger: [{ id: 2, type: 'deposit', purseDelta: -40, chestDelta: 40, balanceAfter: 488, createdAt: new Date(Date.now() - 3600000).toISOString(), description: 'Shillings deposited in the Pay Chest.' }, { id: 1, type: 'duty', purseDelta: 14, chestDelta: 0, balanceAfter: 488, createdAt: new Date(Date.now() - 7200000).toISOString(), description: 'Sentry duty completed.' }], leaderboard: [{ ...profile, forageWins: 2 }, { discordId: 'preview-sentry', displayName: 'Preview sentry', purse: 210, chest: 410, net: 620, streak: 8, dutiesWeek: 6, title: 'private', forageWins: 5 }, { discordId: 'preview-drummer', displayName: 'Preview drummer', purse: 95, chest: 180, net: 275, streak: 3, dutiesWeek: 2, title: 'recruit', forageWins: 1 }], game: null, social: { counterAvailable: null, duels: [], splitGames: [], heist: null, lottery: null }, config: economyConfig, serverTime: new Date().toISOString(), preview: true };
}

function total(cards: number[]) { let sum = cards.reduce((value, card) => value + (card === 1 ? 11 : card), 0); let aces = cards.filter((card) => card === 1).length; while (sum > 21 && aces-- > 0) sum -= 10; return sum; }
const card = () => Math.min(10, 1 + Math.floor(Math.random() * 13));

export function actPreview(current: QuartermasterSnapshot, action: ActionKey, args: ActionArgs): QuartermasterResult {
  const snapshot: QuartermasterSnapshot = structuredClone(current);
  const p = snapshot.profile; const c = snapshot.config; const before = { purse: p.purse, chest: p.chest }; const now = Date.now();
  let message = ''; let resultGame: Record<string, unknown> | VingtGame | undefined;
  const reject = (text: string): never => { throw new QuartermasterError(text); };
  const ready = (key: keyof QuartermasterSnapshot['cooldowns']) => { if (new Date(snapshot.cooldowns[key] || 0).getTime() > now) reject('The paymaster has already entered that. Wait for the next issue.'); };
  const cooldown = (key: keyof QuartermasterSnapshot['cooldowns'], seconds: number) => { snapshot.cooldowns[key] = new Date(now + seconds * 1000).toISOString(); };
  const amount = (balance = p.purse) => { const value = args.amount === 'all' ? balance : Number(args.amount); if (!Number.isSafeInteger(value) || value <= 0 || value > balance) return reject('Enter a whole number of shillings within your available balance.'); return value; };
  const stake = (kind: 'anchor' | 'vingt') => { const value = Number(args.stake); if (!Number.isSafeInteger(value) || value < c[kind].min_stake || value > c[kind].max_stake || value > p.purse) return reject(`Choose a stake from ${shillings(c[kind].min_stake)} to ${shillings(Math.min(c[kind].max_stake, p.purse))}.`); return value; };
  if (p.frozen) reject('Your account is frozen. Ask an admin or moderator in Discord.');
  if (action === 'duty') { ready('work'); const base = Math.floor((c.duty.payout_min + c.duty.payout_max) / 2); const reward = p.dutyBoost ? Math.min(c.duty.boost_cap, Math.floor(base * c.duty.boost_multiplier)) : base; p.purse += reward; p.lifetimeEarned += reward; p.dutiesWeek++; p.dutyBoost = false; cooldown('work', c.duty.cooldown_seconds); message = `${seed.jobs[p.dutiesWeek % seed.jobs.length].line} ${shillings(reward)} added to your Wallet.`; }
  else if (action === 'ration') { ready('daily'); const reward = c.ration.base + Math.min(p.streak * c.ration.streak_bonus_per_day, c.ration.streak_bonus_cap); p.streak++; p.purse += reward; p.lifetimeEarned += reward; cooldown('daily', c.ration.cooldown_seconds); if (p.streak === 7 && !p.medals.includes(c.ration.bonus_day_7_medal)) p.medals.push(c.ration.bonus_day_7_medal); message = `Daily Ration collected: ${shillings(reward)}. ${p.streak} days in your daily streak.`; }
  else if (action === 'deposit') { const value = amount(); p.purse -= value; p.chest += value; message = `${shillings(value)} deposited in your Pay Chest.`; }
  else if (action === 'withdraw') { ready('withdraw'); const value = amount(p.chest); p.chest -= value; p.purse += value; cooldown('withdraw', c.withdraw.cooldown_seconds); message = `${shillings(value)} returned to your Wallet.`; }
  else if (action === 'transfer' || action === 'forage') {
    const target = snapshot.leaderboard.find((entry) => entry.discordId === args.targetDiscordId && entry.discordId !== p.discordId);
    if (!target) reject('Select another member first.');
    if (action === 'transfer') { const value = amount(); p.purse -= value; target!.purse += value; target!.net += value; message = `${shillings(value)} sent to ${target!.displayName}.`; }
    else { ready('steal'); if (p.billet) reject('You cannot forage while billet protection is active.'); if (target!.purse < c.forage.min_target_purse) reject('That member does not have enough Shillings in their Wallet for forage.'); const take = Math.min(c.forage.take_cap, Math.floor(target!.purse * c.forage.take_min_pct)); target!.purse -= take; target!.net -= take; p.purse += take; cooldown('steal', c.forage.cooldown_seconds); message = `Preview forage succeeded. ${shillings(take)} taken from ${target!.displayName}'s Wallet.`; }
  } else if (action === 'billet') { p.billet = Boolean(args.enabled); p.billetUntil = null; message = p.billet ? 'You are in billet. Your purse is protected from forage.' : 'Billet protection is off immediately. Your Wallet is now open to forage.'; }
  else if (action === 'buy') {
    const item = snapshot.catalogue.find((entry) => entry.slug === args.itemSlug); if (!item) reject('That item is not on the stores list.');
    const qty = Number(args.qty || 1); if (!Number.isSafeInteger(qty) || qty < 1 || qty > item!.max_stack) reject('Choose a quantity within the stack limit.');
    const owned = snapshot.inventory.find((entry) => entry.slug === item!.slug); const chargesKey = ({ lantern: 'lanternCharges', caltrops: 'caltropCharges', warrant: 'warrantCharges' } as const)[item!.effect as 'lantern'];
    const held = chargesKey ? p[chargesKey] / (item!.charges || 1) : owned?.qty || 0;
    if (held + qty > item!.max_stack) reject('Your kit is already at its limit for that item.'); if (item!.price * qty > p.purse) reject('Not enough shillings in your Wallet.');
    p.purse -= item!.price * qty;
    if (chargesKey) p[chargesKey] += (item!.charges || 1) * qty;
    else if (item!.effect === 'title_unlock') { const title = item!.title_id || item!.slug; if (p.titles.map(honourId).includes(title)) reject('That title is already on your record.'); p.titles.push(title); }
    else if (owned) owned.qty += qty; else snapshot.inventory.push({ slug: item!.slug, name: item!.name, effect: item!.effect, qty });
    message = `${qty} × ${item!.name} issued. ${shillings(item!.price * qty)} spent on this purchase.`;
  } else if (action === 'use') {
    const item = snapshot.inventory.find((entry) => entry.slug === args.itemSlug && entry.qty > 0); if (!item) reject('That item is not in your inventory.');
    if (item!.effect === 'duty_boost') { if (p.dutyBoost) reject('Your next duty already has an active reward boost.'); p.dutyBoost = true; }
    else if (item!.effect === 'streak_saver') { if (p.streakSaver) reject('Hard tack is already set aside.'); p.streakSaver = true; }
    else if (item!.effect === 'rename') { const title = String(args.title || '').trim(); if (!title || title.length > 32) reject('Your title must be between 1 and 32 characters.'); p.title = title; }
    else reject('This is a collectible, kept in your inventory.'); item!.qty--; snapshot.inventory = snapshot.inventory.filter((entry) => entry.qty > 0); message = `${item!.name} used. Your service record is updated.`;
  } else if (action === 'title') { const title = String(args.titleId); if (!p.titles.map(honourId).includes(title)) reject('That title has not been unlocked.'); p.title = title; message = `${titleName(title)} entered on your record.`; }
  else if (action === 'anchor') { ready('gamble'); const value = stake('anchor'); if (!seed.anchor_symbols.includes(String(args.symbol))) reject('Choose a symbol on the cloth.'); const rolls = Array.from({ length: 3 }, () => seed.anchor_symbols[Math.floor(Math.random() * seed.anchor_symbols.length)]); const matches = rolls.filter((symbol) => symbol === args.symbol).length; const payout = matches ? value * c.anchor.payouts[String(matches) as '1' | '2' | '3'] : 0; p.purse += payout - value; cooldown('gamble', c.vingt.command_cooldown_seconds); resultGame = { rolls, matches, payout, stake: value }; message = `You rolled ${rolls.join(' · ')}. ${matches ? `${shillings(payout)} returned, including your stake.` : 'The dealer takes the stake.'}`; }
  else if (action === 'vingt') {
    if (!args.move) {
      if (isVingtActive(snapshot.game)) reject('Finish your current hand first.'); ready('gamble'); const value = stake('vingt'); p.purse -= value;
      const player = [card(), card()]; const dealer = [card()]; snapshot.game = { id: newRequestId(), player, dealer, playerTotal: total(player), dealerTotal: total(dealer), stake: value, status: 'active', expiresAt: new Date(now + c.vingt.turn_timeout_seconds * 1000).toISOString(), canDouble: p.purse >= value };
      message = 'The dealer deals. Draw, stand, or double.';
      if (snapshot.game.playerTotal === 21) { p.purse += Math.floor(value * c.vingt.natural_multiplier); snapshot.game.status = 'natural'; snapshot.game.payout = Math.floor(value * c.vingt.natural_multiplier); snapshot.game.net = snapshot.game.payout - value; message = 'Twenty-one! Your winnings have been added to your Wallet.'; cooldown('gamble', c.vingt.command_cooldown_seconds); }
    } else {
      const game = snapshot.game; if (!game || !isVingtActive(game) || game.id !== args.gameId) reject('There is no open hand to play.');
      if (new Date(game!.expiresAt).getTime() <= now) reject('The hand has expired. Refresh your account.');
      if (args.move === 'double') { if (!game!.canDouble || p.purse < game!.stake) reject('This hand cannot be doubled.'); p.purse -= game!.stake; game!.stake *= 2; }
      if (args.move === 'hit' || args.move === 'draw' || args.move === 'double') { game!.player.push(card()); game!.playerTotal = total(game!.player); game!.canDouble = false; }
      if (game!.playerTotal > 21 || args.move === 'stand' || args.move === 'double' || game!.playerTotal === 21) {
        while (total(game!.dealer) < c.vingt.dealer_stand) game!.dealer.push(card()); game!.dealerTotal = total(game!.dealer);
        const won = game!.playerTotal <= 21 && (game!.dealerTotal > 21 || game!.playerTotal > game!.dealerTotal); const push = game!.playerTotal <= 21 && game!.playerTotal === game!.dealerTotal;
        game!.status = won ? 'won' : push ? 'push' : 'lost'; game!.payout = won ? game!.stake * c.vingt.win_multiplier : push ? game!.stake : 0; game!.net = game!.payout - game!.stake; p.purse += game!.payout; cooldown('gamble', c.vingt.command_cooldown_seconds); message = won ? 'You won. Your winnings have been added to your Wallet.' : push ? 'An even hand. Your stake is returned.' : 'You lost this hand. Your bet has been spent.';
      } else message = 'A fresh card. Draw again or stand.';
    }
    resultGame = snapshot.game!;
  } else reject('This action needs the connected local game server. This disconnected preview cannot save or settle it.');
  p.net = p.purse + p.chest; snapshot.leaderboard = snapshot.leaderboard.map((entry) => entry.discordId === p.discordId ? { ...p, forageWins: entry.forageWins } : entry);
  const settled = action === 'vingt' && snapshot.game && !isVingtActive(snapshot.game);
  const entryType = action === 'anchor' ? 'anchor_settle' : action === 'forage' ? 'forage_win' : settled ? 'vingt_settle' : action;
  const gamblingNet = action === 'anchor' ? p.purse - before.purse : settled ? snapshot.game!.net : undefined;
  snapshot.ledger.unshift({ id: newRequestId(), type: entryType, ...(gamblingNet === undefined ? {} : { gamblingNet }), purseDelta: p.purse - before.purse, chestDelta: p.chest - before.chest, balanceAfter: p.net, createdAt: new Date(now).toISOString(), description: message });
  snapshot.serverTime = new Date(now).toISOString();
  return { snapshot, message: `${message} (Test data.)`, game: resultGame };
}


export const diceSymbols = ['crown', 'anchor', 'heart', 'club', 'diamond', 'spade'] as const;
export const diceSymbolMarks: Record<typeof diceSymbols[number], string> = { crown: '♛', anchor: '⚓︎', heart: '♥', club: '♣', diamond: '♦', spade: '♠' };
