import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const migration = readFileSync(new URL('../db/0057_regiment_enlistment.sql', import.meta.url), 'utf8');
const databaseDir = await mkdtemp(join(tmpdir(), 'coldstream-enlistment-postgres-'));
let database;
let checks = 0;
const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  moderator: '00000000-0000-4000-8000-000000000002',
  member: '00000000-0000-4000-8000-000000000003',
  application: '00000000-0000-4000-8000-000000000010',
  denial: '00000000-0000-4000-8000-000000000011',
  forbidden: '00000000-0000-4000-8000-000000000012',
};

function pass(label) {
  checks += 1;
  console.log(`PASS ${label}`);
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function connectedClient() {
  const client = database.getPgClient();
  await client.connect();
  return client;
}

async function asRole(client, role, authUserId, text, values = []) {
  await client.query('begin');
  try {
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [authUserId ?? '']);
    await client.query(`set local role ${role}`);
    const result = await client.query(text, values);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

async function expectError(operation, pattern) {
  try {
    await operation;
    assert.fail('Expected PostgreSQL to reject the operation');
  } catch (error) {
    assert.match(String(error.message), pattern);
  }
}

function applicationRow(id, discordId) {
  return [id, null, 'Example Volunteer', 'Discord regiment application', JSON.stringify({
    age: 21,
    holdfast_name: 'Example Volunteer',
    region: 'NA',
    found_us: 'A friend',
    leadership_interest: 'Maybe later',
  }), 'pending', discordId, `example-${discordId}`, '669723836165521413'];
}

try {
  database = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'synthetic-enlistment-test-only',
    port: await availablePort(),
    persistent: false,
    onLog: () => {},
    onError: (message) => {
      if (!String(message).includes('database system is ready')) console.error(String(message));
    },
  });
  await database.initialise();
  await database.start();
  const admin = await connectedClient();
  await admin.query(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    grant usage on schema public, auth to anon, authenticated, service_role;
    create type application_status as enum ('pending', 'accepted', 'denied', 'withdrawn');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table member (
      id uuid primary key,
      auth_user_id uuid unique,
      role text not null
    );
    create function current_member_id() returns uuid language sql stable as $$
      select id from member where auth_user_id = auth.uid()
    $$;
    create function current_member_role() returns text language sql stable as $$
      select role from member where auth_user_id = auth.uid()
    $$;
    create table enlistment (
      id uuid primary key,
      member_id uuid references member(id),
      display_name text not null,
      body text not null,
      created_at timestamptz not null default now(),
      answers jsonb not null default '{}'::jsonb,
      status application_status not null default 'pending',
      reviewed_by uuid references member(id),
      review_note text,
      reviewed_at timestamptz
    );
    alter table enlistment enable row level security;
    create policy enlist_staff_read on enlistment for select
      using (member_id = current_member_id() or current_member_role() in ('moderator', 'admin'));
    create policy enlist_review on enlistment for update
      using (current_member_role() in ('moderator', 'admin'))
      with check (current_member_role() in ('moderator', 'admin'));
    grant select, update on enlistment to authenticated;
    grant all on enlistment to service_role;
    create table personnel_audit (
      id bigint generated always as identity primary key,
      actor_id uuid references member(id),
      action text not null,
      entity text not null,
      entity_id text,
      member_id uuid references member(id),
      detail jsonb not null default '{}'::jsonb
    );
    insert into member(id, auth_user_id, role) values
      ('${ids.admin}', '${ids.admin}', 'admin'),
      ('${ids.moderator}', '${ids.moderator}', 'moderator'),
      ('${ids.member}', '${ids.member}', 'member');
  `);

  await admin.query(migration);
  await admin.query(migration);
  pass('migration applies and re-applies cleanly');

  await admin.query(`
    insert into enlistment(id, member_id, display_name, body, answers, status, discord_id, discord_username, guild_id)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `, applicationRow(ids.application, 'discord-accepted'));
  const reviewed = await asRole(admin, 'authenticated', ids.admin,
    'select review_regiment_enlistment($1, $2, $3) as id', [ids.application, 'accepted', null]);
  assert.equal(reviewed.rows[0].id, ids.application);
  const accepted = (await admin.query('select status, reviewed_by, discord_status from enlistment where id = $1', [ids.application])).rows[0];
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.reviewed_by, ids.admin);
  assert.equal(accepted.discord_status, 'queued');
  const action = (await admin.query('select operation, discord_id, holdfast_name from discord_enlistment_action where application_id = $1', [ids.application])).rows[0];
  assert.deepEqual(action, { operation: 'accepted', discord_id: 'discord-accepted', holdfast_name: 'Example Volunteer' });
  assert.equal(Number((await admin.query('select count(*) from personnel_audit where entity_id = $1', [ids.application])).rows[0].count), 1);
  pass('acceptance, durable Discord work, and audit record commit together');

  await admin.query(`insert into enlistment(id, member_id, display_name, body, answers, status, discord_id, discord_username, guild_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, applicationRow(ids.denial, 'discord-denial'));
  await expectError(
    asRole(admin, 'authenticated', ids.moderator, 'select review_regiment_enlistment($1, $2, $3)', [ids.denial, 'denied', '   ']),
    /denial reason is required/,
  );
  assert.equal((await admin.query('select status from enlistment where id = $1', [ids.denial])).rows[0].status, 'pending');
  assert.equal(Number((await admin.query('select count(*) from discord_enlistment_action where application_id = $1', [ids.denial])).rows[0].count), 0);
  pass('blank denial reason rolls back without a decision or Discord action');

  await asRole(admin, 'authenticated', ids.moderator,
    'select review_regiment_enlistment($1, $2, $3)', [ids.denial, 'denied', 'Please spend more time with the community before reapplying.']);
  const denied = (await admin.query('select status, review_note, reviewed_by from enlistment where id = $1', [ids.denial])).rows[0];
  assert.deepEqual(denied, {
    status: 'denied',
    review_note: 'Please spend more time with the community before reapplying.',
    reviewed_by: ids.moderator,
  });
  assert.equal((await admin.query('select review_note from discord_enlistment_action where application_id = $1', [ids.denial])).rows[0].review_note, denied.review_note);
  pass('moderator denial carries the staff-written private reason into the Discord queue');

  await admin.query(`insert into enlistment(id, member_id, display_name, body, answers, status, discord_id, discord_username, guild_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, applicationRow(ids.forbidden, 'discord-forbidden'));
  await expectError(
    asRole(admin, 'authenticated', ids.member, 'select review_regiment_enlistment($1, $2, $3)', [ids.forbidden, 'accepted', null]),
    /staff role required/,
  );
  await expectError(
    asRole(admin, 'authenticated', ids.member, 'update enlistment set status = $1 where id = $2', ['accepted', ids.forbidden]),
    /permission denied/,
  );
  await expectError(
    asRole(admin, 'authenticated', ids.member, 'select * from discord_enlistment_action'),
    /permission denied/,
  );
  pass('members cannot review applications, update decisions, or read the private action queue');

  await expectError(
    admin.query(`insert into enlistment(id, member_id, display_name, body, answers, status, discord_id, discord_username, guild_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, applicationRow('00000000-0000-4000-8000-000000000013', 'discord-forbidden')),
    /duplicate key/,
  );
  pass('one pending application per Discord member is enforced by the database');

  await admin.end();
  console.log(`VERIFIED ${checks} isolated PostgreSQL enlistment checks.`);
} catch (error) {
  console.error('FAIL', error.code ?? '', error.message);
  process.exitCode = 1;
} finally {
  if (database) {
    try { await database.stop(); } catch {}
  }
  await rm(databaseDir, { recursive: true, force: true });
}
