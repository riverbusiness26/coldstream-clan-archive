// Disposable PostgreSQL execution, never a connection to the hosted database.
// Pass a separately installed @electric-sql/pglite/dist/index.js as argv[2].
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

if (!process.argv[2]) throw new Error('Pass the installed PGlite module path. No database URL is accepted.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const read = name => readFileSync(new URL(`../db/${name}`, import.meta.url), 'utf8');
const migration = read('0048_medal_profile_visibility.sql');
const catalogue = read('0024_discord_personnel.sql');
const audit = read('0026_personnel_audit_delete.sql');
const retention = read('0048_audit_retention_prerequisite.sql');
let checks = 0;
const pass = label => { checks++; console.log(`PASS ${label}`); };
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0];
const count = () => scalar('select count(*)::int from personnel_audit');
const ids = { owner:randomUUID(), other:randomUUID(), admin:randomUUID(), moderator:randomUUID(), medal:randomUUID(), rank:randomUUID(), award:randomUUID(), rankAward:randomUUID(), removed:randomUUID() };
async function call(actor, visible, award = ids.award, role = 'authenticated') {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor ?? '']);
    await db.exec(`set local role ${role}`);
    const value = (await db.query('select public.set_personnel_medal_visibility($1,$2) as value', [award,visible])).rows[0].value;
    await db.exec('commit');
    return value;
  } catch (error) { await db.exec('rollback'); throw error; }
}
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    grant usage on schema public,auth to anon,authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create type member_role as enum ('member','moderator','admin');
    create type member_status as enum ('applicant','active','reserve','discharged','banned');
    create table member(id uuid primary key,auth_user_id uuid unique,role member_role,status member_status);
    grant select on member to authenticated;
    create function current_member_id() returns uuid language sql stable as $$ select id from member where auth_user_id=auth.uid() $$;
    create function current_member_role() returns member_role language sql stable as $$ select role from member where auth_user_id=auth.uid() $$;
  `);
  // Use the actual catalogue, assignment and audit table definitions, not a
  // synthetic replacement for their constraints or foreign keys.
  await db.exec(catalogue.slice(catalogue.indexOf('create type personnel_item_kind'),catalogue.indexOf('create type evidence_submission_kind')));
  await db.exec('alter table personnel_audit add column entity text; alter table personnel_audit add column entity_id text;');
  await db.exec(audit.slice(audit.indexOf('create or replace function'),audit.indexOf('-- Clears the test row')));
  await db.exec(catalogue.slice(catalogue.indexOf('create trigger personnel_item_audit'),catalogue.indexOf('-- Artwork is public')));
  await assert.rejects(db.exec(migration),/retention trigger|trim_personnel_audit/);
  await db.exec('rollback');
  assert.equal(await scalar("select count(*)::int from information_schema.columns where table_name='personnel_assignment' and column_name='display_on_profile'"),0);
  pass('missing retention aborts the migration without leaving the column installed');
  await assert.rejects(db.exec(retention),/backup fingerprint/);
  await db.exec('rollback');
  pass('retention installation refuses an absent backup fingerprint');
  const digest = await scalar("select md5(coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb)::text) from personnel_audit a");
  await db.query("select set_config('app.audit_backup_digest',$1,false)",[digest]);
  await db.exec(retention);
  assert.equal(await scalar("select has_table_privilege('authenticated','personnel_audit_retention_guard','UPDATE')"),false);
  pass('focused retention installs with guard row inaccessible to members');
  await db.exec(migration);
  await db.exec(migration);
  pass('actual migration applies and re-applies');
  for (const [name,role] of [['owner','member'],['other','member'],['admin','admin'],['moderator','moderator']]) {
    await db.query("insert into member values($1,$1,$2,'active')",[ids[name],role]);
  }
  for (const kind of ['medal','rank']) await db.query("insert into personnel_item(id,kind,name,storage_key,image_mime,created_by) values($1,$2::text::personnel_item_kind,$2::text,$2::text,'image/png',$3)",[ids[kind],kind,ids.admin]);
  for (const [award,kind,removed] of [['award','medal',false],['rankAward','rank',false],['removed','medal',true]]) {
    await db.query('insert into personnel_assignment(id,member_id,item_id,item_kind,assigned_by,removed_at) values($1,$2,$3,$4,$5,case when $6 then now() end)',[ids[award],ids.owner,ids[kind],kind,ids.admin,removed]);
  }
  const before = await count();
  assert.equal(await call(ids.owner,false),false);
  assert.equal(await count(),before+1);
  const entry = (await db.query("select action,actor_id,detail from personnel_audit order by id desc limit 1")).rows[0];
  assert.equal(entry.action,'personnel.medal_visibility');
  assert.equal(entry.actor_id,ids.owner);
  assert.deepEqual(entry.detail.before,{display_on_profile:true});
  assert.deepEqual(entry.detail.after,{display_on_profile:false});
  pass('owner hide returns false and writes exactly one detailed audit');
  assert.equal(await call(ids.owner,false),false);
  assert.equal(await count(),before+1);
  pass('repeated hide is a no-op with no new audit');
  await db.exec(migration);
  assert.equal(await scalar('select display_on_profile from personnel_assignment where id=' + "'"+ids.award+"'"),false);
  pass('re-applying preserves saved preferences');
  assert.equal(await call(ids.moderator,true),true);
  assert.equal(await call(ids.admin,false),false);
  pass('moderator and admin can manage another member medal');
  for (const status of ['applicant','reserve']) {
    await db.query('update member set status=$1 where id=$2',[status,ids.owner]);
    assert.equal(await call(ids.owner,true),true);
  }
  pass('applicant and reserve owners are allowed');
  for (const status of ['banned','discharged']) {
    await db.query('update member set status=$1 where id=$2',[status,ids.owner]);
    await assert.rejects(call(ids.owner,false),/current member access required/);
  }
  await db.query("update member set status='active' where id=$1",[ids.owner]);
  pass('banned and discharged owners are denied');
  const deniedBefore = await count();
  await assert.rejects(call(ids.other,false),/only the member or staff/);
  await assert.rejects(call(null,false),/signed-in member required/);
  await assert.rejects(call(randomUUID(),false),/signed-in member required/);
  await assert.rejects(call(null,false,ids.award,'anon'),/permission denied/);
  assert.equal(await count(),deniedBefore);
  pass('other member, guest, unlinked identity and anon denied without audit changes');
  for (const target of [ids.rankAward,ids.removed,randomUUID()]) await assert.rejects(call(ids.owner,false,target),/active medal award not found/);
  await assert.rejects(call(ids.owner,null),/required/);
  await assert.rejects(call(ids.owner,false,null),/required/);
  pass('rank, removed, missing and null inputs rejected');
  await db.query('update personnel_item set active=false where id=$1',[ids.medal]);
  assert.equal(await call(ids.owner,false),false);
  pass('archived catalogue artwork does not revoke the earned award');
  await db.exec("create function reject_test_audit() returns trigger language plpgsql as $$ begin raise exception 'test audit failure'; end; $$; create trigger reject_test_audit before insert on personnel_audit for each row execute function reject_test_audit();");
  await assert.rejects(call(ids.owner,true),/test audit failure/);
  assert.equal(await scalar(`select display_on_profile from personnel_assignment where id='${ids.award}'`),false);
  await db.exec('drop trigger reject_test_audit on personnel_audit');
  pass('audit failure rolls back visibility update');
  for(let i=0;i<90;i++) await call(ids.owner,i%2===0);
  assert.equal(await count(),75);
  assert.equal(await scalar(`select count(*)::int from personnel_assignment where member_id='${ids.owner}'`),3);
  pass('sequential audit retention keeps 75 and all award records remain');
  console.log(`VERIFIED ${checks} PostgreSQL execution checks. In-memory fixture only; no live data, concurrency or full Supabase RLS claim.`);
} catch (error) { console.error('FAIL',error.code ?? '',error.message); process.exitCode = 1; }
finally { await db.close(); }
