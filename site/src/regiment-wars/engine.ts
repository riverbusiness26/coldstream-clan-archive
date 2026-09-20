import { BY_ID, CARDS, STARTER, SUPPORT_ROLES, type Role } from './catalogue';
export type Order = 'volley' | 'advance' | 'brace' | 'charge' | 'rally';
export const ORDERS: { id: Order; name: string; description: string }[] = [
  { id: 'volley', name: 'Steady volley', description: 'Fire and reload. Fifer adds +1 in their section.' },
  { id: 'advance', name: 'Advancing volley', description: 'Fire and close one step. No fifer bonus without Quick Step.' },
  { id: 'brace', name: 'Brace', description: 'Weaker fire. Reduce incoming bayonet hits by 2.' },
  { id: 'charge', name: 'Charge', description: 'Attack with bayonets. Available only at distance 0.' },
  { id: 'rally', name: 'Rally', description: 'Recover 4 morale, but do not attack. Twice per battle.' },
];
export type Unit = { cardId: string; hp: number; slot: number };
export type Army = { units: Unit[]; morale: number; maxMorale: number; commandUsed: boolean; drumUsed: boolean; rallies: number };
export type Tactic = 'balanced' | 'aggressive' | 'defensive';
export type Decision = { order: Order; command?: boolean; drum?: boolean; section?: number };
export type BattleResult = { winner: 'player' | 'enemy' | 'draw'; reason: string; playerWithdrawal: string; enemyWithdrawal: string; colours: string };
export type Exchange = { round: number; player: Order; enemy: Order; text: string[]; playerDamage: number; enemyDamage: number };
export type Battle = { id: string; playerName: string; tactic: Tactic; round: number; distance: number; player: Army; enemy: Army; aiDecision: Decision; log: Exchange[]; result: BattleResult | null };
export function validateDeck(ids: string[], owned?: string[]): string[] {
  const errors: string[] = [];
  const placed = ids.filter(Boolean);
  if (ids.length !== 15 || placed.length !== 15) errors.push(`Your formation needs 15 cards. ${15 - placed.length} positions still need a card.`);
  if (new Set(placed).size !== placed.length) errors.push('Each card can appear only once.');
  if (placed.some(id => !BY_ID[id])) errors.push('This formation contains an unknown card.');
  if (owned && placed.some(id => !owned.includes(id))) errors.push('Use cards from your collection.');
  if (ids.slice(0, 10).length !== 10 || ids.slice(0, 10).some(id => BY_ID[id]?.role !== 'infantry')) errors.push('Fill the ten front slots with infantry.');
  const roles = ids.slice(10).map(id => BY_ID[id]?.role);
  if (roles.length !== 5 || roles.some(role => !SUPPORT_ROLES.includes(role))) errors.push('Fill the rear rank with any five support cards. Roles may repeat.');
  return errors;
}
export const alive = (army: Army, role?: Role) => army.units.filter(u => u.hp > 0 && (!role || BY_ID[u.cardId].role === role));
const has = (army: Army, role: Role) => alive(army, role).length > 0;
function makeArmy(ids: string[]): Army { const maxMorale = Math.min(30, 21 + Math.round(ids.reduce((sum, id) => sum + BY_ID[id].morale, 0) / ids.length)); return { maxMorale, units: ids.map((cardId, slot) => ({ cardId, slot, hp: BY_ID[cardId].health })), morale: maxMorale, commandUsed: false, drumUsed: false, rallies: 0 }; }
export function chooseAI(battle: Pick<Battle, 'round' | 'distance' | 'enemy' | 'tactic'>): Decision {
  const { enemy, distance, round, tactic } = battle;
  let order: Order = 'volley';
  if (enemy.morale <= 10 && enemy.rallies < 2) order = 'rally';
  else if (distance === 0) order = round % 3 === 0 ? 'brace' : round % 3 === 1 ? 'charge' : 'volley';
  else if (tactic === 'aggressive' || tactic === 'balanced' && round % 3 !== 0 || round > 7) order = 'advance';
  return { order, command: !enemy.commandUsed && has(enemy, 'officer') && round >= 3 && (order === 'volley' || order === 'advance'), drum: order === 'advance' && !enemy.drumUsed && has(enemy, 'drummer') && round >= 2, section: enemy.units.slice(0, 10).reduce((best, u) => u.hp > enemy.units[best * 2].hp ? Math.floor(u.slot / 2) : best, 0) };
}
export function startBattle(ids: string[], tactic: Tactic, id: string, playerName = 'First Company'): Battle {
  const errors = validateDeck(ids); if (errors.length) throw new Error(errors[0]);
  const enemyIds = [...STARTER];
  const alternatives = CARDS.filter(c => c.role === 'infantry');
  if (tactic !== 'balanced') for (let i = 0; i < 10; i++) enemyIds[i] = alternatives[(i + (tactic === 'aggressive' ? 6 : 3)) % alternatives.length].id;
  const base = { id, playerName, tactic, round: 1, distance: 5, player: makeArmy(ids), enemy: makeArmy(enemyIds), log: [], result: null };
  return { ...base, aiDecision: chooseAI(base) };
}
function validateDecision(army: Army, decision: Decision, distance: number) {
  if (!ORDERS.some(o => o.id === decision.order)) throw new Error('Unknown order.');
  if (decision.order === 'charge' && distance > 0) throw new Error('The enemy is out of bayonet range.');
  if (decision.order === 'rally' && army.rallies >= 2) throw new Error('Both rallies have been used.');
  if (decision.command && (army.commandUsed || !has(army, 'officer') || !['volley', 'advance'].includes(decision.order))) throw new Error('Coordinated volley is unavailable.');
  if (decision.drum && (army.drumUsed || !has(army, 'drummer') || decision.order !== 'advance')) throw new Error('Quick Step is unavailable.');
  if (!Number.isInteger(decision.section ?? 2) || (decision.section ?? 2) < 0 || (decision.section ?? 2) > 4) throw new Error('Choose a valid section.');
}
function attacks(attacker: Army, defender: Army, order: Decision, defence: Decision): number[] {
  const damage = Array<number>(15).fill(0);
  if (order.order === 'rally') return damage;
  for (const unit of alive(attacker)) {
    const card = BY_ID[unit.cardId]; const section = unit.slot < 10 ? Math.floor(unit.slot / 2) : unit.slot - 10;
    if (unit.slot >= 10 && order.order !== 'charge') continue;
    // Target the screen at exchange start; a new gap never takes spill damage.
    const front = defender.units.slice(section * 2, section * 2 + 2).filter(u => u.hp > 0);
    let target = front.find(u => u.slot % 2 === unit.slot % 2) || front[0];
    if (!target && defender.units[10 + section].hp > 0) target = defender.units[10 + section];
    if (!target) target = alive(defender, 'infantry')[unit.slot % Math.max(1, alive(defender, 'infantry').length)];
    if (!target) continue;
    let hit = order.order === 'charge' ? card.bayonet : card.musket;
    if (!hit) continue;
    const support = attacker.units[10 + section];
    if (order.order === 'volley' || order.order === 'advance') {
      if (support.hp > 0 && BY_ID[support.cardId].role === 'fifer' && (order.order === 'volley' || order.drum)) hit++;
      if (order.command && section === (order.section ?? 2)) hit++;
    }
    if (order.order === 'brace') hit = Math.max(1, hit - 1);
    if (order.order === 'charge' && defence.order === 'brace') hit = Math.max(1, hit - 2);
    const targetSection = target.slot < 10 ? Math.floor(target.slot / 2) : target.slot - 10;
    const guard = defender.units[10 + targetSection];
    if (target.slot < 10 && guard.hp > 0 && BY_ID[guard.cardId].role === 'sergeant') hit = Math.max(1, hit - 1);
    damage[target.slot] += hit;
  }
  return damage;
}
function applyHits(army: Army, damage: number[], decision: Decision): Army {
  const units = army.units.map(u => ({ ...u, hp: Math.max(0, u.hp - damage[u.slot]) }));
  const casualties = units.filter((u, i) => u.hp === 0 && army.units[i].hp > 0);
  const loss = casualties.length * (has(army, 'colours') ? 1 : 2) + casualties.filter(u => BY_ID[u.cardId].role === 'officer').length * 2;
  const morale = Math.max(0, Math.min(army.maxMorale, army.morale + (decision.order === 'rally' ? 4 : 0)) - loss);
  return { units, morale, maxMorale: army.maxMorale, commandUsed: army.commandUsed || !!decision.command, drumUsed: army.drumUsed || !!decision.drum, rallies: army.rallies + (decision.order === 'rally' ? 1 : 0) };
}
function withdrawal(army: Army): string {
  if (army.morale === 0) return 'Rout';
  const support = alive(army).filter(u => u.slot >= 10);
  if (!support.length) return 'Command lost';
  return has(army, 'officer') || has(army, 'sergeant') || support.length >= 2 ? 'Orderly withdrawal' : 'Scattered withdrawal';
}
export function resolveExchange(current: Battle, decision: Decision): Battle {
  if (current.result) throw new Error('This battle has ended.');
  validateDecision(current.player, decision, current.distance);
  const enemyDecision = current.aiDecision;
  validateDecision(current.enemy, enemyDecision, current.distance);
  const enemyDamage = attacks(current.player, current.enemy, decision, enemyDecision);
  const playerDamage = attacks(current.enemy, current.player, enemyDecision, decision);
  const player = applyHits(current.player, playerDamage, decision); const enemy = applyHits(current.enemy, enemyDamage, enemyDecision);
  const playerBroken = alive(player, 'infantry').length === 0 || player.morale === 0;
  const enemyBroken = alive(enemy, 'infantry').length === 0 || enemy.morale === 0;
  const text: string[] = [];
  if (decision.command) text.push('Your coordinated volley strengthens section ' + ((decision.section ?? 2) + 1) + '.');
  if (decision.drum) text.push('Your drummer sounds Quick Step.');
  for (const [label, before, after] of [['Your', current.player, player], ['Enemy', current.enemy, enemy]] as const) {
    const fallen = after.units.filter((u, i) => !u.hp && before.units[i].hp).map(u => BY_ID[u.cardId].name);
    if (fallen.length) text.push(`${label} casualties: ${fallen.join(', ')}.`);
  }
  let result: BattleResult | null = null;
  if (playerBroken || enemyBroken || current.round >= 30) {
    const winner = playerBroken && enemyBroken || !playerBroken && !enemyBroken ? 'draw' : enemyBroken ? 'player' : 'enemy';
    const loser = winner === 'player' ? enemy : player;
    const colours = winner === 'draw' ? 'No colours captured.' : has(loser, 'colours') ? 'The losing line saved its colours.' : 'The winning line captured the colours. Collections are unchanged.';
    result = { winner, reason: !playerBroken && !enemyBroken ? 'Nightfall: neither line broke after 30 exchanges.' : playerBroken && enemyBroken ? 'Both lines broke in the same exchange.' : loser.morale === 0 ? 'Morale collapsed.' : 'Line broken. Withdrawal resolved.', playerWithdrawal: playerBroken ? withdrawal(player) : 'Line held', enemyWithdrawal: enemyBroken ? withdrawal(enemy) : 'Line held', colours };
    text.push(result.reason, colours);
  }
  const next = { ...current, round: current.round + 1, distance: Math.max(0, current.distance - (decision.order === 'advance' || enemyDecision.order === 'advance' ? 1 : 0)), player, enemy, result,
    log: [...current.log, { round: current.round, player: decision.order, enemy: enemyDecision.order, text, playerDamage: playerDamage.reduce((a, b) => a + b, 0), enemyDamage: enemyDamage.reduce((a, b) => a + b, 0) }] };
  return { ...next, aiDecision: chooseAI(next) };
}
