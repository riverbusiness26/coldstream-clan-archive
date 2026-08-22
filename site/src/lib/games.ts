// Game labels and the year helper, deliberately in their own file.
//
// These used to live in lib/data.ts alongside the seed imports, so any page
// that wanted to print "Napoleonic Wars" pulled 272 KB of roster JSON into
// the initial bundle with it. Keeping them separate is what lets the archive
// data load only for the pages that actually show it.
export const THIS_YEAR = new Date().getFullYear();

export const yearsWithUs = (firstYear: number | null) =>
  firstYear ? THIS_YEAR - firstYear : null;

export const GAME_NAMES: Record<string, string> = {
  BG2: 'Battlegrounds 2', NW: 'Mount & Blade: Warband', MC: 'Minecraft',
  CSS: 'Counter-Strike: Source', CS16: 'Counter-Strike 1.6', CSGO: 'CS:GO',
  GMOD: "Garry's Mod", ARMA: 'ArmA 2', NS: 'North & South', RUST: 'Rust',
  HOL: 'Holdfast: Nations At War', VAL: 'Valheim', GEN: 'Community',
};
