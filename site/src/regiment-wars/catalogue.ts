export type Rarity = 'common' | 'rare' | 'legendary';
export type Role = 'infantry' | 'officer' | 'sergeant' | 'colours' | 'fifer' | 'drummer';
export type Card = { id: string; name: string; role: Role; rarity: Rarity; company: string; health: number; musket: number; bayonet: number; morale: number; trait: string; description: string; quote: string };
export const ROLE_NAMES: Record<Role, string> = { infantry: 'Line infantry', officer: 'Officer', sergeant: 'Sergeant', colours: 'Colour Sergeant', fifer: 'Fifer', drummer: 'Drummer' };
export const SUPPORT_ROLES: Role[] = ['sergeant', 'drummer', 'officer', 'fifer', 'colours'];
const infantryNames = ['Muster Recruit', 'Centre Company', 'Steady Hand', 'Old Reliable', 'Front Rank', 'Rear Rank', 'Flank Guard', 'Marching Man', 'Resolute Guard', 'Young Blood', 'Crack Shot', 'Bayonet Veteran', 'Rifle Volunteer', 'Grenadier', 'Campaign Regular', 'Light Company', 'Storming Party', 'Last of the Line', 'Chosen Marksman', 'Old Coldstream'];
export const CARDS: Card[] = infantryNames.map((name, i) => {
  const build = i % 4;
  const stats = [[20, 2, 3, 3], [18, 3, 2, 3], [22, 1, 3, 4], [18, 2, 4, 3]][build];
  return { id: `inf-${i + 1}`, name, role: 'infantry', rarity: i < 10 ? 'common' : i < 17 ? 'rare' : 'legendary', company: i === 12 || i === 18 ? 'Rifle Company' : i === 13 || i === 16 ? 'Grenadier Company' : 'Centre Company', health: stats[0], musket: stats[1], bayonet: stats[2], morale: stats[3], trait: ['Steadfast', 'Measured shot', 'Hold the line', 'Cold steel'][build], description: ['An even balance of endurance, musket fire and bayonet strength.', 'Trades endurance and melee strength for a stronger volley.', 'A tough infantry screen with lighter musket fire.', 'Trades endurance for a stronger bayonet attack.'][build], quote: ['Dress the line.', 'Wait for the word.', 'Still standing.', 'One more pace.'][build] };
});
const specialistNames: Record<Exclude<Role, 'infantry'>, string[]> = { officer: ['Company Captain', 'The Field Commander'], sergeant: ['Veteran Serjeant', 'The Rearguard'], colours: ['Keeper of the Colours', 'The Unbroken Standard'], fifer: ['Company Fifer', 'The Old Tune'], drummer: ['Company Drummer', 'The Long March'] };
const effects: Record<Exclude<Role, 'infantry'>, [string, string]> = {
  officer: ['Coordinated volley', 'Once per battle, add 1 musket damage to both infantry in your chosen section. Also helps the withdrawal.'],
  sergeant: ['Close order', 'Reduce each incoming hit on the infantry in this section by 1, to a minimum of 1. Helps the rearguard.'],
  colours: ['Stand by the colours', 'While alive at the start of an exchange, casualties cost 1 morale instead of 2. Surviving colours are saved on withdrawal.'],
  fifer: ['Steady rhythm', 'The two infantry in this section gain 1 musket damage during a steady volley.'],
  drummer: ['Quick step', 'Once per battle, an advancing volley keeps the fifer bonus. Helps sound the retreat.'],
};
for (const role of SUPPORT_ROLES as Exclude<Role, 'infantry'>[]) for (let edition = 0; edition < 2; edition++) {
  CARDS.push({ id: `${role}-${edition + 1}`, name: specialistNames[role][edition], role, rarity: edition === 0 ? 'common' : role === 'officer' || role === 'colours' ? 'legendary' : 'rare', company: 'Centre Company', health: edition ? 13 : 14, musket: 0, bayonet: role === 'sergeant' || role === 'officer' ? edition ? 3 : 2 : 0, morale: edition ? 5 : 4, trait: effects[role][0], description: effects[role][1], quote: role === 'colours' ? 'The colours stay with us.' : 'Keep your place.' });
}
for (const card of CARDS) {
  const bonus = card.rarity === 'legendary' ? 2 : card.rarity === 'rare' ? 1 : 0;
  card.health += bonus * 3;
  if (card.role === 'infantry') { card.musket += bonus; card.bayonet += bonus; }
  else if (card.bayonet) card.bayonet += bonus;
  card.morale += bonus;
}
export const BY_ID = Object.fromEntries(CARDS.map(card => [card.id, card])) as Record<string, Card>;
export const STARTER = [...CARDS.filter(c => c.role === 'infantry').slice(0, 10).map(c => c.id), ...SUPPORT_ROLES.map(role => `${role}-1`)];
export type PackId = 'starter' | 'common' | 'rare' | 'legendary';
export type Pack = { id: PackId; name: string; price: number; count: number; label: string; guarantee: Rarity | null; odds: [number, number, number]; description: string };
export const PACKS: Pack[] = [
  { id: 'starter', name: 'First Muster', price: 0, count: 15, label: 'Starter pack', guarantee: null, odds: [100, 0, 0], description: 'A complete fighting line. Ten infantry and all five support roles. Yours once, free.' },
  { id: 'common', name: 'Campaign Issue', price: 30, count: 4, label: 'Common pack', guarantee: 'common', odds: [85, 14, 1], description: 'Four reinforcements for your collection. A modest issue from the stores.' },
  { id: 'rare', name: 'Veteran Reserve', price: 90, count: 5, label: 'Rare pack', guarantee: 'rare', odds: [65, 30, 5], description: 'Five cards, including one guaranteed Rare or better.' },
  { id: 'legendary', name: 'Second to None', price: 240, count: 6, label: 'Legendary pack', guarantee: 'legendary', odds: [50, 40, 10], description: 'Six cards, including one guaranteed Legendary.' },
];
export const DUPLICATE_SUPPLIES: Record<Rarity, number> = { common: 5, rare: 20, legendary: 60 };
export const CRAFT_COST: Record<Rarity, number> = { common: 30, rare: 120, legendary: 360 };
export const SECTIONS = ['Left flank', 'Left centre', 'Centre', 'Right centre', 'Right flank'];
