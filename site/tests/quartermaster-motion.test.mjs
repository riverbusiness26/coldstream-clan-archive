import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const built = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/quartermasterMotion.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false });
const { actionFeedback, rewardEvents } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const entry = (id,type,purseDelta,extra={}) => ({id,type,purseDelta,chestDelta:0,...extra});
const previous = [entry(1,'duty',14)];
const result = { snapshot: { ledger: [entry(3,'transfer',70),entry(2,'duty',12), ...previous] } };
test('duty feedback uses only new duty ledger rewards, not unrelated balance changes', () => {
  assert.equal(actionFeedback('duty', previous, result).earned,12);
});
test('replayed receipts never celebrate a second payout', () => {
  assert.equal(actionFeedback('duty', previous, { ...result, replayed: true }), null);
});
test('purchases and game actions do not invent earned Shillings', () => {
  for (const action of ['buy', 'anchor', 'vingt', 'forage']) assert.equal(actionFeedback(action, previous, result), null);
});

test('settled games animate net profit only, including doubled blackjack, losses and pushes',()=>{
  for(const net of [20,-20,0]) {
    const rewards=rewardEvents([], [entry(1,'vingt_double',-10),entry(2,'vingt_settle',net+20,{gamblingNet:net,gameId:'hand'})]);
    assert.equal(rewards.length,1);assert.equal(rewards[0].net,net);assert.equal(rewards[0].earned,Math.max(0,net));
  }
  assert.equal(rewardEvents([], [entry(1,'anchor_stake',-10),entry(2,'anchor_settle',40,{gamblingNet:30})])[0].earned,30);
});

test('forage winnings include caltrop costs and incoming savings movements never count as income',()=>{
  const rewards=rewardEvents([], [entry(1,'forage_win',24),entry(2,'forage_fine',10*-1),entry(3,'withdraw',100,{chestDelta:-100})]);
  assert.equal(rewards.length,1);assert.equal(rewards[0].earned,14);
  assert.equal(rewardEvents([], [entry(1,'forage_win',12),entry(2,'forage_fine',-25)])[0].earned,0);
});

test('all incoming reward sources are placed in their owning activity and unchanged polls are silent',()=>{
  const ledger=[entry(1,'ration',12),entry(2,'parade',15),entry(3,'grant',20),entry(4,'transfer',5),entry(5,'forage_trap',10)];
  const events=rewardEvents([],ledger);
  assert.equal(events.find(e=>e.location==='account').earned,40);
  assert.equal(events.find(e=>e.location==='defence').earned,10);
  assert.equal(events.find(e=>e.location==='ration').earned,12);
  assert.deepEqual(rewardEvents(ledger,ledger),[]);
  assert.deepEqual(rewardEvents([entry('1','ration',12)],[entry(1,'ration',12)]),[]);
});

test('coin sound stays silent until unlocked and schedules a short quiet metallic clink',async()=>{
  const builtSound=await build({entryPoints:[fileURLToPath(new URL('../src/lib/quartermasterSound.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
  const calls=[];const original=globalThis.AudioContext;
  globalThis.AudioContext=class {
    state='running';currentTime=0;destination={};
    createOscillator(){return {frequency:{setValueAtTime:()=>{}},connect:()=>{},disconnect:()=>{},start:t=>calls.push(['start',t]),stop:t=>calls.push(['stop',t])};}
    createGain(){return {gain:{setValueAtTime:()=>{},exponentialRampToValueAtTime:v=>calls.push(['gain',v])},connect:()=>{},disconnect:()=>{}};}
  };
  try {
    const sound=await import(`data:text/javascript;base64,${Buffer.from(builtSound.outputFiles[0].text).toString('base64')}`);
    sound.playCoinSound();assert.equal(calls.length,0);
    sound.unlockCoinSound();sound.playCoinSound();
    assert.equal(calls.filter(c=>c[0]==='start').length,3);
    assert(calls.filter(c=>c[0]==='stop').every(c=>c[1]<.4));
    assert(calls.filter(c=>c[0]==='gain').every(c=>c[1]<=.05));
  } finally { if(original)globalThis.AudioContext=original;else delete globalThis.AudioContext; }
});
