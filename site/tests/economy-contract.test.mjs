import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/economy.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const economy = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

function clientReturning(data, calls = []) {
  return {
    rpc(name, parameters) {
      calls.push({ name, parameters });
      return Promise.resolve({ data, error: null });
    },
  };
}

test('purchase sends only the item slug and stable request key', async () => {
  const calls = [];
  const result = {
    request_key: 'purchase:test-request',
    action_kind: 'purchase',
    balance: 0,
    delta: -10,
    ledger_id: 2,
    item_slug: 'test-frame',
    period_start: null,
    created_at: '2026-09-13T00:00:00Z',
    replayed: false,
  };
  assert.deepEqual(await economy.purchaseEconomyItem(clientReturning(result, calls), 'test-frame', 'purchase:test-request'), result);
  assert.deepEqual(calls, [{
    name: 'economy_purchase_self',
    parameters: { p_item_slug: 'test-frame', p_request_key: 'purchase:test-request' },
  }]);
});

test('self read validates and returns the server-owned aggregate', async () => {
  const snapshot = {
    currency_display_name: 'Shillings',
    shop_display_name: "Quartermaster's Stores",
    balance: 10,
    catalogue: [],
    inventory: [],
    equipped: [],
    ledger: [],
  };
  assert.deepEqual(await economy.readEconomySelf(clientReturning(snapshot)), snapshot);
});

test('database errors retain their safe message and code', async () => {
  const client = {
    rpc() {
      return Promise.resolve({ data: null, error: { message: 'ECONOMY_INSUFFICIENT_FUNDS', code: 'P0001' } });
    },
  };
  await assert.rejects(
    economy.claimEconomyDaily(client, 'daily:test-request'),
    error => error.name === 'EconomyRpcError'
      && error.message === 'ECONOMY_INSUFFICIENT_FUNDS'
      && error.code === 'P0001',
  );
});

test('malformed success payloads fail closed', async () => {
  await assert.rejects(
    economy.readEconomySelf(clientReturning({ balance: '10' })),
    /Invalid economy currency name response/,
  );
});
