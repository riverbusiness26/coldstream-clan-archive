import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

function compile(path, replacements = {}) {
  const url = new URL(path, import.meta.url), require = createRequire(url), exports = {};
  const code = ts.transpileModule(readFileSync(url,'utf8'), { compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true} }).outputText;
  new Function('exports','require',code)(exports,id => replacements[id] ?? (id.endsWith('.css') ? {} : require(id)));
  return exports;
}
function fixture(options={}) {
  const calls=[];
  const storage={upload:async(...args)=>{calls.push(['upload',...args]);return {error:options.uploadError};},remove:async args=>{calls.push(['remove',args]);return {error:null};},createSignedUrl:async(...args)=>{calls.push(['sign',...args]);return {data:{signedUrl:'https://example.test/audio'},error:null};}};
  const query={select(...args){calls.push(['select',...args]);return this;},order(...args){calls.push(['order',...args]);return this;},eq(...args){calls.push(['eq',...args]);return this;},maybeSingle:async()=>({data:options.existing??null,error:options.lookupError}),then(resolve){resolve({data:options.rows??[],error:options.loadError});}};
  const supa={storage:{from:bucket=>{calls.push(['bucket',bucket]);return storage;}},from:table=>{calls.push(['table',table]);return query;},rpc:async(...args)=>{calls.push(['rpc',...args]);return {error:options.saveError};}};
  return {calls,api:compile('../src/lib/jukebox.ts',{'./supa':{supa}})};
}

test('only supported nonempty audio files of at most 25 MB pass client validation',()=>{
  const {api}=fixture();
  for(const type of Object.keys(api.MUSIC_TYPES))assert.doesNotThrow(()=>api.validateMusic({type,size:26214400}));
  for(const f of [{type:'text/html',size:5},{type:'audio/mpeg',size:0},{type:'audio/mpeg',size:26214401}])assert.throws(()=>api.validateMusic(f));
});
test('upload saves an unpublished track under a unique generated key, never a user filename',async()=>{
  const {api,calls}=fixture();await api.uploadMusic({type:'audio/mpeg',size:512,name:'../../bad.mp3'},' March ',' Musician ');
  const upload=calls.find(c=>c[0]==='upload'),rpc=calls.find(c=>c[0]==='rpc');
  assert.match(upload[1],/^[0-9a-f-]{36}\.mp3$/);assert.equal(upload[3].upsert,false);
  assert.equal(rpc[2].track_published,false);assert.equal(rpc[2].track_title,'March');assert.equal(rpc[2].track_artist,'Musician');
  assert.equal(rpc[2].track_storage_key,upload[1]);assert.equal(calls.some(c=>c[0]==='remove'),false);
});
test('unsupported audio and missing title are rejected before storage calls',async()=>{
  const {api,calls}=fixture();await assert.rejects(api.uploadMusic({type:'text/html',size:1},'test',''));await assert.rejects(api.uploadMusic({type:'audio/mpeg',size:1},' ',''));assert.equal(calls.length,0);
});
test('confirmed registration failure cleans its orphan, ambiguous failure preserves the audio',async()=>{
  for(const options of [{},{existing:{id:'saved'}},{lookupError:{message:'offline'}}]){
    const {api,calls}=fixture({...options,saveError:{message:'network failure'}});
    const operation=api.uploadMusic({type:'audio/mpeg',size:1},'March','');
    if(options.existing)await operation;else await assert.rejects(operation);
    assert.equal(calls.some(c=>c[0]==='remove'),!options.existing&&!options.lookupError);
  }
});
test('member playlist requests only published rows; admin listing remains subject to RLS',async()=>{
  const member=fixture();await member.api.loadJukebox();assert.ok(member.calls.some(c=>c[0]==='eq'&&c[1]==='published'&&c[2]===true));
  const admin=fixture();await admin.api.loadJukebox(true);assert.equal(admin.calls.some(c=>c[0]==='eq'),false);
  const failed=fixture({loadError:{message:'offline'}});await assert.rejects(failed.api.loadJukebox(),/could not load/);
});
test('audio uses private expiring URLs',async()=>{
  const {api,calls}=fixture();assert.equal(await api.musicUrl({storage_key:'test.mp3'}),'https://example.test/audio');assert.ok(calls.some(c=>c[0]==='sign'&&c[1]==='test.mp3'&&c[2]===3600));
});
test('member jukebox has no file picker, object URLs or unmanaged static playlist',()=>{
  const Component=compile('../src/components/QuartermasterJukebox.tsx',{'../lib/jukebox':{loadJukebox:async()=>[],musicUrl:async()=>''}}).default;
  const html=renderToStaticMarkup(React.createElement(Component));
  assert.doesNotMatch(html,/type="file"|Try local songs/);assert.match(html,/Admin-curated music/);
  const source=readFileSync(new URL('../src/components/QuartermasterJukebox.tsx',import.meta.url),'utf8');assert.doesNotMatch(source,/createObjectURL|music\.json|type="file"/);
});
test('upload UI is admin only and demo explicitly disables writing',()=>{
  const Component=compile('../src/components/JukeboxAdmin.tsx',{'../lib/supa':{DEMO:true},'../lib/jukebox':{}}).default;
  for(const role of ['member','moderator',undefined]){const html=renderToStaticMarkup(React.createElement(Component,{role}));assert.match(html,/Admin access required/);assert.doesNotMatch(html,/type="file"/);}
  const html=renderToStaticMarkup(React.createElement(Component,{role:'admin'}));assert.match(html,/type="file"/);assert.match(html,/disabled=""/);assert.match(html,/Upload as draft/);
});
