import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
test('History retains 21stPA and removes the other community chapters', () => {
  const page=readFileSync(new URL('../src/views/Archive.tsx',import.meta.url),'utf8');
  assert.match(page,/21st Pennsylvania/);
  assert.doesNotMatch(page,/Midnight Mercenaries|Nox Viator|RoaR Gaming/);
});
test('2020 group roster evidence is classified as Holdfast',async()=>{
  const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/lib/data.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'});
  const {rosterEntries,people}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const rows=rosterEntries.filter(e=>e.year===2020&&e.source_detail.startsWith('On the rolls'));
  assert.ok(rows.length>0);
  for(const row of rows){assert.equal(row.game,'HOL');assert.ok(people.find(p=>p.key===row.person_key).games.includes('HOL'));}
});
