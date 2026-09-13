import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const migration = readFileSync(new URL('../db/0053_economy.sql', import.meta.url), 'utf8');
const identityFix = readFileSync(new URL('../db/0054_economy_self_identity.sql', import.meta.url), 'utf8');
const databaseDir = await mkdtemp(join(tmpdir(), 'coldstream-economy-postgres-'));
let database;
let checks = 0;
const ids = {
  claim: '00000000-0000-4000-8000-000000000001',
  purchase: '00000000-0000-4000-8000-000000000002',
  unavailable: '00000000-0000-4000-8000-000000000003',
  rollback: '00000000-0000-4000-8000-000000000004',
  other: '00000000-0000-4000-8000-000000000005',
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
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function expectDatabaseError(operation, pattern) {
  try {
    await operation;
    assert.fail('Expected PostgreSQL to reject the operation');
  } catch (error) {
    assert.match(String(error.message), pattern);
  }
}

async function asRole(client, role, authUserId, text, values = []) {
  assert.ok(['anon', 'authenticated', 'service_role'].includes(role));
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

async function connectedClient() {
  const client = database.getPgClient();
  await client.connect();
  return client;
}

try {
  const port = await availablePort();
  database = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'synthetic-economy-test-only',
    port,
    persistent: false,
    onLog: () => {},
    onError: message => {
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
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.member (
      id uuid primary key,
      auth_user_id uuid unique,
      discord_id text unique
    );
    create function public.current_member_id() returns uuid
    language sql stable as $$
      select id from member where auth_user_id = auth.uid()
    $$;
  `);
  for (const [index, memberId] of Object.values(ids).entries()) {
    await admin.query(
      'insert into public.member(id, auth_user_id, discord_id) values ($1, $1, $2)',
      [memberId, `synthetic-discord-${index + 1}`],
    );
  }

  await admin.query(migration);
  await admin.query(migration);
  await admin.query(identityFix);
  await admin.query(identityFix);
  assert.equal((await admin.query("select value #>> '{}' as value from public.economy_config where key = 'daily_reward'")).rows[0].value, '10');
  assert.equal((await admin.query("select price from public.economy_catalog_item where slug = 'engraved-frame'")).rows[0].price, 40);
  pass('actual 0053 and 0054 migrations apply and re-apply with approved configuration');

  const boundary = await admin.query(`
    select
      public.economy_reward_period('2026-03-08 05:59:59+00') as before_midnight,
      public.economy_reward_period('2026-03-08 06:00:00+00') as at_midnight
  `);
  assert.equal(boundary.rows[0].before_midnight.toISOString(), '2026-03-07T06:00:00.000Z');
  assert.equal(boundary.rows[0].at_midnight.toISOString(), '2026-03-08T06:00:00.000Z');
  pass('America/Chicago server period crosses exactly at local midnight');

  const claimOne = await connectedClient();
  const claimTwo = await connectedClient();
  const claims = await Promise.allSettled([
    asRole(claimOne, 'authenticated', ids.claim, 'select public.economy_claim_daily_self($1) as value', ['daily:concurrent-one']),
    asRole(claimTwo, 'authenticated', ids.claim, 'select public.economy_claim_daily_self($1) as value', ['daily:concurrent-two']),
  ]);
  assert.equal(claims.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(claims.filter(result => result.status === 'rejected').length, 1);
  assert.match(String(claims.find(result => result.status === 'rejected').reason.message), /ECONOMY_DAILY_ALREADY_CLAIMED/);
  const successfulClaim = claims.find(result => result.status === 'fulfilled').value.rows[0].value;
  assert.equal(successfulClaim.balance, 10);
  assert.equal((await admin.query('select balance from public.economy_wallet where member_id = $1', [ids.claim])).rows[0].balance, 10);
  assert.equal(Number((await admin.query('select count(*) from public.economy_claim where member_id = $1', [ids.claim])).rows[0].count), 1);
  assert.equal(Number((await admin.query('select count(*) from public.economy_ledger where member_id = $1', [ids.claim])).rows[0].count), 1);
  pass('two concurrent daily claims produce exactly one locked credit and claim');

  const replay = await asRole(claimOne, 'authenticated', ids.claim, 'select public.economy_claim_daily_self($1) as value', [successfulClaim.request_key]);
  assert.equal(replay.rows[0].value.replayed, true);
  assert.equal(replay.rows[0].value.ledger_id, successfulClaim.ledger_id);
  assert.equal(Number((await admin.query('select count(*) from public.economy_ledger where member_id = $1', [ids.claim])).rows[0].count), 1);
  pass('replayed daily request returns its original result without a second ledger row');

  for (const table of ['economy_wallet', 'economy_ledger', 'economy_claim', 'economy_inventory']) {
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
      const result = await admin.query('select has_table_privilege($1, $2, $3) as allowed', ['authenticated', `public.${table}`, privilege]);
      assert.equal(result.rows[0].allowed, false);
    }
  }
  await expectDatabaseError(
    asRole(claimOne, 'authenticated', ids.other, 'update public.economy_wallet set balance = 999 where member_id = $1', [ids.claim]),
    /permission denied/,
  );
  await expectDatabaseError(
    asRole(claimOne, 'authenticated', ids.other, 'select public.economy_claim_daily_self($1, $2)', ['daily:foreign', ids.claim]),
    /does not exist/,
  );
  pass('browser roles cannot mutate tables or submit another member identity');

  await expectDatabaseError(
    asRole(claimOne, 'authenticated', ids.claim, 'select public.economy_claim_daily_for_discord($1, $2)', ['synthetic-discord-1', 'daily:browser-service']),
    /permission denied/,
  );
  const walletsBeforeUnlinked = Number((await admin.query('select count(*) from public.economy_wallet')).rows[0].count);
  await expectDatabaseError(
    asRole(claimOne, 'service_role', null, 'select public.economy_claim_daily_for_discord($1, $2)', ['synthetic-unlinked', 'daily:unlinked-user']),
    /ECONOMY_DISCORD_NOT_LINKED/,
  );
  assert.equal(Number((await admin.query('select count(*) from public.economy_wallet')).rows[0].count), walletsBeforeUnlinked);
  pass('service wrappers reject browser callers and unlinked Discord identities without writes');

  await admin.query(`
    insert into public.economy_catalog_item(slug, display_name, slot, price) values
      ('test-frame', 'Test Frame', 'frame', 10),
      ('test-badge', 'Test Badge', 'badge', 10),
      ('inactive-frame', 'Inactive Frame', 'frame', 10),
      ('rollback-frame', 'Rollback Frame', 'frame', 10);
    update public.economy_catalog_item set active = false where slug = 'inactive-frame';
  `);
  await asRole(claimOne, 'authenticated', ids.purchase, 'select public.economy_claim_daily_self($1)', ['daily:purchase-funds']);
  const purchaseOne = await connectedClient();
  const purchaseTwo = await connectedClient();
  const purchases = await Promise.allSettled([
    asRole(purchaseOne, 'authenticated', ids.purchase, 'select public.economy_purchase_self($1, $2) as value', ['test-frame', 'purchase:concurrent-frame']),
    asRole(purchaseTwo, 'authenticated', ids.purchase, 'select public.economy_purchase_self($1, $2) as value', ['test-badge', 'purchase:concurrent-badge']),
  ]);
  assert.equal(purchases.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(purchases.filter(result => result.status === 'rejected').length, 1);
  assert.match(String(purchases.find(result => result.status === 'rejected').reason.message), /ECONOMY_INSUFFICIENT_FUNDS/);
  const successfulPurchase = purchases.find(result => result.status === 'fulfilled').value.rows[0].value;
  assert.equal(successfulPurchase.balance, 0);
  assert.equal((await admin.query('select balance from public.economy_wallet where member_id = $1', [ids.purchase])).rows[0].balance, 0);
  assert.equal(Number((await admin.query('select count(*) from public.economy_inventory where member_id = $1', [ids.purchase])).rows[0].count), 1);
  pass('two concurrent purchases with funds for one produce one debit and no negative balance');

  const purchaseReplay = await asRole(purchaseOne, 'authenticated', ids.purchase, 'select public.economy_purchase_self($1, $2) as value', [successfulPurchase.item_slug, successfulPurchase.request_key]);
  assert.equal(purchaseReplay.rows[0].value.replayed, true);
  assert.equal(purchaseReplay.rows[0].value.ledger_id, successfulPurchase.ledger_id);
  await expectDatabaseError(
    asRole(purchaseOne, 'authenticated', ids.purchase, 'select public.economy_purchase_self($1, $2)', [successfulPurchase.item_slug, 'purchase:already-owned']),
    /ECONOMY_ITEM_ALREADY_OWNED/,
  );
  assert.equal(Number((await admin.query('select count(*) from public.economy_inventory where member_id = $1 and item_slug = $2', [ids.purchase, successfulPurchase.item_slug])).rows[0].count), 1);
  pass('purchase replay is stable and a new request cannot duplicate owned inventory');

  await asRole(claimOne, 'authenticated', ids.unavailable, 'select public.economy_claim_daily_self($1)', ['daily:unavailable-funds']);
  const unavailableBefore = (await admin.query('select balance from public.economy_wallet where member_id = $1', [ids.unavailable])).rows[0].balance;
  for (const itemSlug of ['inactive-frame', 'missing-frame']) {
    await expectDatabaseError(
      asRole(claimOne, 'authenticated', ids.unavailable, 'select public.economy_purchase_self($1, $2)', [itemSlug, `purchase:${itemSlug}`]),
      /ECONOMY_ITEM_UNAVAILABLE/,
    );
  }
  assert.equal((await admin.query('select balance from public.economy_wallet where member_id = $1', [ids.unavailable])).rows[0].balance, unavailableBefore);
  assert.equal(Number((await admin.query('select count(*) from public.economy_inventory where member_id = $1', [ids.unavailable])).rows[0].count), 0);
  pass('inactive and missing catalogue items create no debit or inventory');

  await expectDatabaseError(
    asRole(claimOne, 'authenticated', ids.unavailable, 'select public.economy_purchase_self($1, $2, $3)', ['test-frame', 'purchase:lower-price', 1]),
    /does not exist/,
  );
  assert.equal((await admin.query("select price from public.economy_catalog_item where slug = 'test-frame'")).rows[0].price, 10);
  pass('purchase RPC has no client price parameter and retains the stored price');

  await asRole(claimOne, 'authenticated', ids.rollback, 'select public.economy_claim_daily_self($1)', ['daily:rollback-funds']);
  await admin.query(`
    create function public.reject_economy_inventory_test() returns trigger
    language plpgsql as $$ begin raise exception 'synthetic inventory failure'; end $$;
    create trigger reject_economy_inventory_test
      before insert on public.economy_inventory
      for each row execute function public.reject_economy_inventory_test();
  `);
  const rollbackLedgerBefore = Number((await admin.query('select count(*) from public.economy_ledger where member_id = $1', [ids.rollback])).rows[0].count);
  await expectDatabaseError(
    asRole(claimOne, 'authenticated', ids.rollback, 'select public.economy_purchase_self($1, $2)', ['rollback-frame', 'purchase:rollback-test']),
    /synthetic inventory failure/,
  );
  assert.equal((await admin.query('select balance from public.economy_wallet where member_id = $1', [ids.rollback])).rows[0].balance, 10);
  assert.equal(Number((await admin.query('select count(*) from public.economy_ledger where member_id = $1', [ids.rollback])).rows[0].count), rollbackLedgerBefore);
  assert.equal(Number((await admin.query("select count(*) from public.economy_inventory where member_id = $1 and item_slug = 'rollback-frame'", [ids.rollback])).rows[0].count), 0);
  await admin.query('drop trigger reject_economy_inventory_test on public.economy_inventory');
  await admin.query('drop function public.reject_economy_inventory_test()');
  pass('inventory failure after wallet and ledger writes rolls the whole purchase back');

  const ownedItem = successfulPurchase.item_slug;
  const ownedSlot = (await admin.query('select slot from public.economy_catalog_item where slug = $1', [ownedItem])).rows[0].slot;
  const equipped = await asRole(claimOne, 'authenticated', ids.purchase, 'select public.economy_equip_self($1, $2) as value', [ownedItem, ownedSlot]);
  assert.equal(equipped.rows[0].value.item_slug, ownedItem);
  await expectDatabaseError(
    asRole(claimOne, 'authenticated', ids.purchase, 'select public.economy_equip_self($1, $2)', [ownedItem, ownedSlot === 'frame' ? 'badge' : 'frame']),
    /ECONOMY_SLOT_MISMATCH/,
  );
  pass('equip requires ownership and the catalogue-defined profile slot');

  const snapshot = await asRole(claimOne, 'authenticated', ids.purchase, 'select public.economy_read_self($1, $2) as value', [100, null]);
  assert.equal(snapshot.rows[0].value.balance, 0);
  assert.equal(snapshot.rows[0].value.inventory.length, 1);
  assert.equal(snapshot.rows[0].value.equipped.length, 1);
  assert.equal(snapshot.rows[0].value.ledger.length, 2);
  await expectDatabaseError(asRole(claimOne, 'authenticated', ids.other, 'select * from public.economy_wallet'), /permission denied/);
  pass('self read returns the private aggregate while direct balance reads are denied');

  await expectDatabaseError(admin.query('update public.economy_ledger set delta = delta where id = $1', [successfulClaim.ledger_id]), /append-only/);
  const reconciliation = await admin.query(`
    select count(*)::int as broken
    from public.economy_wallet as wallet
    where wallet.balance <> coalesce((
      select sum(ledger.delta)::int
      from public.economy_ledger as ledger
      where ledger.member_id = wallet.member_id
    ), 0)
  `);
  assert.equal(reconciliation.rows[0].broken, 0);
  pass('ledger rejects edits and every wallet reconciles to its complete ledger sum');

  await Promise.all([claimOne.end(), claimTwo.end(), purchaseOne.end(), purchaseTwo.end()]);
  await admin.end();
  console.log(`VERIFIED ${checks} isolated PostgreSQL economy checks with separate concurrent connections.`);
} catch (error) {
  console.error('FAIL', error.code ?? '', error.message);
  process.exitCode = 1;
} finally {
  if (database) {
    try { await database.stop(); } catch {}
  }
  await rm(databaseDir, { recursive: true, force: true });
}
