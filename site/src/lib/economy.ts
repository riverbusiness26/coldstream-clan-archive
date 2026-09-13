export type EconomySlot = 'frame' | 'badge' | 'backdrop';
export type EconomyActionKind = 'daily' | 'purchase';

export interface EconomyCatalogueItem {
  slug: string;
  display_name: string;
  description: string;
  slot: EconomySlot;
  price: number;
  art_key: string | null;
}

export interface EconomyInventoryItem {
  item_slug: string;
  display_name: string;
  description: string;
  slot: EconomySlot;
  art_key: string | null;
  acquired_at: string;
}

export interface EconomyEquippedItem {
  slot: EconomySlot;
  item_slug: string;
  equipped_at: string;
}

export interface EconomyLedgerEntry {
  id: number;
  delta: number;
  resulting_balance: number;
  action_kind: EconomyActionKind;
  source_ref: string;
  request_key: string;
  item_slug: string | null;
  period_start: string | null;
  created_at: string;
}

export interface EconomySnapshot {
  currency_display_name: string;
  shop_display_name: string;
  balance: number;
  catalogue: EconomyCatalogueItem[];
  inventory: EconomyInventoryItem[];
  equipped: EconomyEquippedItem[];
  ledger: EconomyLedgerEntry[];
}

export interface EconomyActionResult {
  request_key: string;
  action_kind: EconomyActionKind;
  balance: number;
  delta: number;
  ledger_id: number;
  item_slug: string | null;
  period_start: string | null;
  created_at: string;
  replayed: boolean;
}

export interface EconomyEquipResult {
  slot: EconomySlot;
  item_slug: string;
}

export interface EconomyRpcFailure {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface EconomyRpcClient {
  rpc(
    functionName: string,
    parameters?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: EconomyRpcFailure | null }>;
}

export class EconomyRpcError extends Error {
  readonly code: string | undefined;
  readonly details: string | undefined;

  constructor(failure: EconomyRpcFailure) {
    super(failure.message);
    this.name = 'EconomyRpcError';
    this.code = failure.code;
    this.details = failure.details;
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Invalid ${label} response`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`Invalid ${label} response`);
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return stringValue(value, label);
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new TypeError(`Invalid ${label} response`);
  }
  return value;
}

function slot(value: unknown): EconomySlot {
  if (value !== 'frame' && value !== 'badge' && value !== 'backdrop') {
    throw new TypeError('Invalid economy slot response');
  }
  return value;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`Invalid ${label} response`);
  return value;
}

async function call(client: EconomyRpcClient, name: string, parameters?: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, parameters);
  if (error) throw new EconomyRpcError(error);
  return data;
}

function catalogueItem(value: unknown): EconomyCatalogueItem {
  const item = record(value, 'economy catalogue');
  return {
    slug: stringValue(item.slug, 'economy catalogue slug'),
    display_name: stringValue(item.display_name, 'economy catalogue name'),
    description: stringValue(item.description, 'economy catalogue description'),
    slot: slot(item.slot),
    price: integer(item.price, 'economy catalogue price'),
    art_key: nullableString(item.art_key, 'economy catalogue art'),
  };
}

function inventoryItem(value: unknown): EconomyInventoryItem {
  const item = record(value, 'economy inventory');
  return {
    item_slug: stringValue(item.item_slug, 'economy inventory slug'),
    display_name: stringValue(item.display_name, 'economy inventory name'),
    description: stringValue(item.description, 'economy inventory description'),
    slot: slot(item.slot),
    art_key: nullableString(item.art_key, 'economy inventory art'),
    acquired_at: stringValue(item.acquired_at, 'economy acquisition time'),
  };
}

function equippedItem(value: unknown): EconomyEquippedItem {
  const item = record(value, 'economy equipped item');
  return {
    slot: slot(item.slot),
    item_slug: stringValue(item.item_slug, 'economy equipped slug'),
    equipped_at: stringValue(item.equipped_at, 'economy equipped time'),
  };
}

function actionKind(value: unknown): EconomyActionKind {
  if (value !== 'daily' && value !== 'purchase') {
    throw new TypeError('Invalid economy action response');
  }
  return value;
}

function ledgerEntry(value: unknown): EconomyLedgerEntry {
  const entry = record(value, 'economy ledger');
  return {
    id: integer(entry.id, 'economy ledger id'),
    delta: integer(entry.delta, 'economy ledger delta'),
    resulting_balance: integer(entry.resulting_balance, 'economy ledger balance'),
    action_kind: actionKind(entry.action_kind),
    source_ref: stringValue(entry.source_ref, 'economy ledger source'),
    request_key: stringValue(entry.request_key, 'economy ledger request key'),
    item_slug: nullableString(entry.item_slug, 'economy ledger item'),
    period_start: nullableString(entry.period_start, 'economy ledger period'),
    created_at: stringValue(entry.created_at, 'economy ledger time'),
  };
}

function actionResult(value: unknown): EconomyActionResult {
  const result = record(value, 'economy action');
  if (typeof result.replayed !== 'boolean') throw new TypeError('Invalid economy replay response');
  return {
    request_key: stringValue(result.request_key, 'economy action request key'),
    action_kind: actionKind(result.action_kind),
    balance: integer(result.balance, 'economy action balance'),
    delta: integer(result.delta, 'economy action delta'),
    ledger_id: integer(result.ledger_id, 'economy action ledger id'),
    item_slug: nullableString(result.item_slug, 'economy action item'),
    period_start: nullableString(result.period_start, 'economy action period'),
    created_at: stringValue(result.created_at, 'economy action time'),
    replayed: result.replayed,
  };
}

export function createEconomyRequestKey(action: EconomyActionKind): string {
  return `${action}:${crypto.randomUUID()}`;
}

export async function readEconomySelf(
  client: EconomyRpcClient,
  options: { ledgerLimit?: number; ledgerBefore?: number } = {},
): Promise<EconomySnapshot> {
  const value = record(await call(client, 'economy_read_self', {
    p_ledger_limit: options.ledgerLimit ?? 20,
    p_ledger_before: options.ledgerBefore ?? null,
  }), 'economy');

  return {
    currency_display_name: stringValue(value.currency_display_name, 'economy currency name'),
    shop_display_name: stringValue(value.shop_display_name, 'economy shop name'),
    balance: integer(value.balance, 'economy balance'),
    catalogue: array(value.catalogue, 'economy catalogue').map(catalogueItem),
    inventory: array(value.inventory, 'economy inventory').map(inventoryItem),
    equipped: array(value.equipped, 'economy equipped items').map(equippedItem),
    ledger: array(value.ledger, 'economy ledger').map(ledgerEntry),
  };
}

export async function claimEconomyDaily(
  client: EconomyRpcClient,
  requestKey: string,
): Promise<EconomyActionResult> {
  return actionResult(await call(client, 'economy_claim_daily_self', {
    p_request_key: requestKey,
  }));
}

export async function purchaseEconomyItem(
  client: EconomyRpcClient,
  itemSlug: string,
  requestKey: string,
): Promise<EconomyActionResult> {
  return actionResult(await call(client, 'economy_purchase_self', {
    p_item_slug: itemSlug,
    p_request_key: requestKey,
  }));
}

export async function equipEconomyItem(
  client: EconomyRpcClient,
  itemSlug: string,
  itemSlot: EconomySlot,
): Promise<EconomyEquipResult> {
  const result = record(await call(client, 'economy_equip_self', {
    p_item_slug: itemSlug,
    p_slot: itemSlot,
  }), 'economy equip');
  return {
    slot: slot(result.slot),
    item_slug: stringValue(result.item_slug, 'economy equipped slug'),
  };
}
