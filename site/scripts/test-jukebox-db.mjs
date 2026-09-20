import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const dir = await mkdtemp(join(tmpdir(), 'coldstream-jukebox-test-'));
const server = createServer();
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
await new Promise(r => server.close(r));
const db = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'isolated-jukebox-test', port, persistent: false, onLog() {}, onError() {} });
const adminId = '00000000-0000-4000-8000-000000000001';
const memberId = '00000000-0000-4000-8000-000000000002';
const modId = '00000000-0000-4000-8000-000000000003';
const outsiderId = '00000000-0000-4000-8000-000000000004';
const trackId = '00000000-0000-4000-8000-000000000011';
const file = `${trackId}.mp3`;
let client;
let count = 0;
function pass(name) { console.log(`PASS ${name}`); count++; }
async function as(id, query, values = [], role = 'authenticated') {
  await client.query('begin');
  try {
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [id ?? '']);
    await client.query(`set local role ${role}`);
    const result = await client.query(query, values);
    await client.query('commit'); return result;
  } catch (error) { await client.query('rollback'); throw error; }
}
const save = (id, published = false, title = 'Test march') => as(id, 'select save_jukebox_track($1,$2,$3,$4,$5,$6)', [trackId,file,title,'Test musician',published,1]);
try {
  await db.initialise(); await db.start(); client = db.getPgClient(); await client.connect();
  await client.query(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth; create schema storage;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table member(id uuid primary key, role text);
    insert into member values ('${adminId}','admin'),('${memberId}','member'),('${modId}','moderator');
    grant select on member to authenticated,anon;
    create function current_member_id() returns uuid language sql stable as $$ select id from member where id=auth.uid() $$;
    create function current_member_role() returns text language sql stable as $$ select role from member where id=auth.uid() $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated,anon;
    -- Deliberately unsafe legacy policy: the new restrictive guards must still win.
    create policy legacy_wide_access on storage.objects for all to anon,authenticated using(true) with check(true);
    create table personnel_audit(id bigint generated always as identity primary key,actor_id uuid,action text,entity text,entity_id text,detail jsonb);
  `);
  const migration = await readFile(new URL('../db/0060_admin_jukebox.sql', import.meta.url),'utf8');
  await client.query(migration); await client.query(migration);
  pass('migration applies and reapplies');
  const bucket=(await client.query("select * from storage.buckets where id='jukebox-music'")).rows[0];
  assert.equal(bucket.public,false); assert.equal(Number(bucket.file_size_limit),26214400); assert.equal(bucket.allowed_mime_types.length,5);
  pass('private audio-only bucket with a 25 MB limit');
  for (const id of [memberId,modId,outsiderId,null]) {
    await assert.rejects(as(id,"insert into storage.objects(bucket_id,name,metadata) values('jukebox-music',$1,$2)",[file,{size:1024,mimetype:'audio/mpeg'}]), /row-level security/);
    await assert.rejects(save(id), /Admin access required/);
  }
  pass('members, moderators, unknown accounts and missing identities cannot upload or publish');
  await assert.rejects(as(null,"insert into storage.objects(bucket_id,name) values('jukebox-music',$1)",[file],'anon'),/row-level security/);
  await assert.rejects(as(null,'select save_jukebox_track($1,$2,$3)',[trackId,file,'Test'],'anon'),/permission denied/);
  pass('anonymous requests cannot upload or call the management function');
  await assert.rejects(save(adminId),/Upload a supported/);
  pass('metadata cannot be published without a stored audio object');
  await as(adminId,"insert into storage.objects(bucket_id,name,metadata) values('jukebox-music',$1,$2)",[file,{size:1024,mimetype:'audio/mpeg'}]);
  await save(adminId);
  assert.equal((await as(adminId,'select * from jukebox_track')).rows.length,1);
  assert.equal((await as(memberId,'select * from jukebox_track')).rows.length,0);
  assert.equal((await as(memberId,"select * from storage.objects where bucket_id='jukebox-music'")).rows.length,0);
  pass('admin draft is stored but hidden from member metadata and file reads');
  await save(adminId,true);
  assert.equal((await as(memberId,'select * from jukebox_track')).rows.length,1);
  assert.equal((await as(memberId,"select * from storage.objects where bucket_id='jukebox-music'")).rows.length,1);
  assert.equal((await as(outsiderId,'select * from jukebox_track')).rows.length,0);
  pass('publishing exposes the playlist and object only to known members');
  await assert.rejects(as(memberId,"update jukebox_track set published=false"),/permission denied/);
  assert.equal((await as(memberId,"delete from storage.objects where bucket_id='jukebox-music'")).rowCount,0);
  assert.equal((await as(adminId,"update storage.objects set metadata='{}' where bucket_id='jukebox-music'")).rowCount,0);
  assert.equal((await as(adminId,"delete from storage.objects where bucket_id='jukebox-music'")).rowCount,0);
  pass('direct metadata mutation, member deletion, overwrite and deleting linked audio are blocked');
  await save(adminId,false,'Renamed march');
  assert.equal((await as(memberId,'select * from jukebox_track')).rows.length,0);
  assert.equal((await as(memberId,"select * from storage.objects where bucket_id='jukebox-music'")).rows.length,0);
  const audit=(await client.query('select * from personnel_audit order by id')).rows;
  assert.equal(audit.length,3); assert.equal(audit[0].action,'jukebox.upload');
  assert.equal(audit[2].detail.before.published,true); assert.equal(audit[2].detail.after.published,false); assert.equal(audit[2].actor_id,adminId);
  pass('unpublish removes member access and every save records actor and before/after audit');
  await assert.rejects(save(adminId,false,''),/check constraint/);
  await client.query("update storage.objects set metadata=$1 where name=$2",[{size:26214401,mimetype:'audio/mpeg'},file]);
  await assert.rejects(save(adminId,true),/Upload a supported/);
  await client.query("update storage.objects set metadata=$1 where name=$2",[{size:1024,mimetype:'text/html'},file]);
  await assert.rejects(save(adminId,true),/Upload a supported/);
  pass('blank titles, oversized audio and non-audio metadata are rejected server-side');
  const orphan='00000000-0000-4000-8000-000000000099.mp3';
  await as(adminId,"insert into storage.objects(bucket_id,name,metadata) values('jukebox-music',$1,$2)",[orphan,{size:1024,mimetype:'audio/mpeg'}]);
  assert.equal((await as(adminId,"delete from storage.objects where name=$1",[orphan])).rowCount,1);
  await as(memberId,"insert into storage.objects(bucket_id,name) values('other-bucket','unrelated')");
  assert.equal((await as(memberId,"select * from storage.objects where bucket_id='other-bucket'")).rows.length,1);
  pass('admin can clean failed uploads and unrelated buckets keep their existing rules');
  console.log(`VERIFIED ${count} isolated PostgreSQL jukebox checks.`);
} finally {
  if(client)await client.end();
  try{await db.stop();}catch{}
  const target=resolve(dir), allowed=resolve(tmpdir());
  if(!target.startsWith(allowed+'\\') || !target.split('\\').at(-1).startsWith('coldstream-jukebox-test-')) throw new Error('Unsafe test cleanup path');
  await rm(target,{recursive:true,force:true});
}
