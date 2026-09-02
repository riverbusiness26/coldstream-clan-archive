import assert from 'node:assert/strict';
import { parseCsv, normalizeScoreboard } from './lib/holdfast-scoreboard.mjs';

assert.deepEqual(parseCsv('Name,Note\r\n"RiveR, CSG","said ""hello"""\r\n'), [
  ['Name', 'Note'],
  ['RiveR, CSG', 'said "hello"'],
]);

const players = normalizeScoreboard([
  'Steam ID64,Player Name,Regiment Tag,Kills,Deaths,Assists,Team Kills,Score,Shots Fired,Shots Hit,Seconds Played',
  '76561198044997257,RiveR,2ndCS,18,7,4,1,280,34,19,3600',
  'bot-1,Carbon Player,,9,2,0,0,90,,,',
].join('\n'));

assert.equal(players.length, 1);
assert.deepEqual(players[0], {
  steam_id64: '76561198044997257',
  player_name: 'RiveR',
  regiment: '2ndCS',
  kills: 18,
  deaths: 7,
  assists: 4,
  team_kills: 1,
  score: 280,
  shots_fired: 34,
  shots_hit: 19,
  seconds_played: 3600,
  raw_record: {
    'Steam ID64': '76561198044997257',
    'Player Name': 'RiveR',
    'Regiment Tag': '2ndCS',
    Kills: '18',
    Deaths: '7',
    Assists: '4',
    'Team Kills': '1',
    Score: '280',
    'Shots Fired': '34',
    'Shots Hit': '19',
    'Seconds Played': '3600',
  },
});

assert.throws(() => normalizeScoreboard('Name,Kills\nRiveR,3'), /No Steam ID64 column/);
console.log('Holdfast scoreboard parser: 3 checks passed');
