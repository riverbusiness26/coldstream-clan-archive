import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const built = await build({ entryPoints:[fileURLToPath(new URL('../src/lib/forageAvailability.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false });
const {forageBlockers}=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const ready={frozen:false,busy:false,unknown:false,billet:false,billetWait:'',forageWait:'',protectionHours:6,hasPeers:true,target:{displayName:'Target',purse:15},minimum:15};
test('explains both observed Starz blockers without changing the rules',()=>{
  const reasons=forageBlockers({...ready,billet:true,target:{displayName:'River',purse:14}});
  assert.equal(reasons.length,2); assert.match(reasons[0],/protection is on.*6 hours/); assert.match(reasons[1],/14 Shillings.*at least 15/);
});
test('target becomes eligible exactly at the minimum Wallet balance',()=>{
  assert.deepEqual(forageBlockers(ready),[]);
  assert.equal(forageBlockers({...ready,target:{displayName:'Target',purse:14}}).length,1);
});
test('leaving billet and the forage cooldown each explain their timer',()=>{
  const reasons=forageBlockers({...ready,billetWait:'5h 2m',forageWait:'11h 4m'});
  assert.match(reasons[0],/5h 2m/); assert.match(reasons[1],/11h 4m/);
});
test('missing selection, empty member list and uncertain requests give actionable reasons',()=>{
  assert.match(forageBlockers({...ready,target:undefined})[0],/Choose a member/);
  assert.match(forageBlockers({...ready,target:undefined,hasPeers:false})[0],/Refresh balances/);
  assert.match(forageBlockers({...ready,unknown:true})[0],/Retry same request/);
});
