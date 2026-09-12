import type { SupabaseClient } from '@supabase/supabase-js';

export type PersonnelDisplayRow = {
  id: string;
  member_id: string;
  item_id: string;
  item_kind: 'rank' | 'medal';
  assigned_at: string;
  removed_at: string | null;
  note: string | null;
  display_on_profile: boolean | null;
};

export type PersonnelDisplayResult = {
  rows: PersonnelDisplayRow[];
  visibilityAvailable: boolean;
  visibilityStatus: 'available' | 'unavailable' | 'error';
  visibilityError: string | null;
};

const PAGE_SIZE = 250;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE_FIELDS = 'id,member_id,item_id,item_kind,assigned_at,removed_at,note';
const UNAVAILABLE = 'Medal display preferences are not available yet. Your awards remain in your record.';
const READ_FAILED = 'Medal display preferences could not be loaded. Your awards remain in your record. Try again before changing the display.';
const SAVE_FAILED = 'The medal display preference could not be confirmed. Reload the record before trying again.';

type DataRow = Record<string, unknown>;
type ReadFailure = { unavailable: boolean };

function isRecord(value: unknown): value is DataRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorCode(error: unknown): string {
  return isRecord(error) && typeof error.code === 'string' ? error.code : '';
}

function isVisibilityColumnMissing(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const code = errorCode(error);
  const description = [error.message, error.details, error.hint].filter(value => typeof value === 'string').join(' ');
  return (code === '42703' || code === 'PGRST204') && description.includes('display_on_profile');
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

// Keyset paging cannot silently stop at the API's default row cap or skip rows
// when another award is removed while this member's record is loading.
async function readPersonnelPages(db: SupabaseClient, memberId: string, preferences: boolean): Promise<DataRow[]> {
  const rows: DataRow[] = [];
  let after = '';
  for (;;) {
    let query = db.from('personnel_assignment')
      .select(preferences ? 'id,display_on_profile' : BASE_FIELDS)
      .eq('member_id', memberId)
      .order('id', { ascending: true })
      .limit(PAGE_SIZE);
    if (preferences) query = query.eq('item_kind', 'medal');
    if (after) query = query.gt('id', after);
    const result = await query;
    if (result.error) throw { unavailable: preferences && isVisibilityColumnMissing(result.error) } satisfies ReadFailure;
    if (!Array.isArray(result.data) || result.data.length > PAGE_SIZE) throw new Error('Incomplete personnel response');
    for (const value of result.data as unknown[]) {
      if (!isRecord(value) || typeof value.id !== 'string' || !UUID.test(value.id) || value.id <= after) {
        throw new Error('Invalid personnel page');
      }
      after = value.id;
      rows.push(value);
    }
    if (result.data.length < PAGE_SIZE) return rows;
  }
}

function baseRows(values: DataRow[], memberId: string): PersonnelDisplayRow[] {
  return values.map<PersonnelDisplayRow>(row => {
    if (typeof row.member_id !== 'string' || row.member_id.toLowerCase() !== memberId.toLowerCase()
      || typeof row.item_id !== 'string' || !UUID.test(row.item_id)
      || (row.item_kind !== 'rank' && row.item_kind !== 'medal')
      || !validDate(row.assigned_at) || (row.removed_at !== null && !validDate(row.removed_at))
      || (row.note !== null && typeof row.note !== 'string')) {
      throw new Error('Invalid personnel record');
    }
    return {
      id: row.id as string, member_id: row.member_id, item_id: row.item_id,
      item_kind: row.item_kind, assigned_at: row.assigned_at,
      removed_at: row.removed_at, note: row.note,
      // A failed preference read must never turn an intentionally hidden award on.
      display_on_profile: row.item_kind === 'rank' ? true : null,
    };
  }).sort((a, b) => Date.parse(b.assigned_at) - Date.parse(a.assigned_at) || b.id.localeCompare(a.id));
}

export async function loadPersonnelDisplayRows(db: SupabaseClient, memberId: string): Promise<PersonnelDisplayResult> {
  if (!UUID.test(memberId)) throw new Error('A valid member record is required.');

  // Read the original fields separately: an unapplied migration must not take
  // ranks or the full award history away with the optional display controls.
  const [base, preferences] = await Promise.allSettled([
    readPersonnelPages(db, memberId, false),
    readPersonnelPages(db, memberId, true),
  ]);
  if (base.status === 'rejected') throw new Error('The member record could not be loaded. Please try again.');
  let rows: PersonnelDisplayRow[];
  try {
    rows = baseRows(base.value, memberId);
  } catch {
    throw new Error('The member record could not be loaded. Please try again.');
  }

  if (preferences.status === 'fulfilled') {
    const flags = new Map<string, boolean>();
    for (const row of preferences.value) {
      if (typeof row.display_on_profile !== 'boolean') {
        return { rows, visibilityAvailable: false, visibilityStatus: 'error', visibilityError: READ_FAILED };
      }
      flags.set(row.id as string, row.display_on_profile);
    }
    // A missing row can mean a concurrent removal or an incomplete response.
    // Keep the entire medal display closed rather than publish a partial guess.
    if (rows.some(row => row.item_kind === 'medal' && !flags.has(row.id))) {
      return { rows, visibilityAvailable: false, visibilityStatus: 'error', visibilityError: READ_FAILED };
    }
    return {
      rows: rows.map(row => row.item_kind === 'medal' ? { ...row, display_on_profile: flags.get(row.id)! } : row),
      visibilityAvailable: true, visibilityStatus: 'available', visibilityError: null,
    };
  }

  const unavailable = isRecord(preferences.reason) && preferences.reason.unavailable === true;
  return {
    rows, visibilityAvailable: false,
    visibilityStatus: unavailable ? 'unavailable' : 'error',
    visibilityError: unavailable ? UNAVAILABLE : READ_FAILED,
  };
}

type MedalDisplayState = Pick<PersonnelDisplayRow, 'item_kind' | 'removed_at' | 'display_on_profile'>;

export function partitionMedals<T extends MedalDisplayState>(rows: readonly T[], limit = 10): {
  visible: T[]; overflow: T[]; hidden: T[]; unknown: T[]; historical: T[];
} {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('The medal display limit must be a positive whole number.');
  const shown: T[] = [];
  const hidden: T[] = [];
  const unknown: T[] = [];
  const historical: T[] = [];
  for (const row of rows) {
    if (row.item_kind !== 'medal') continue;
    if (row.removed_at !== null) historical.push(row);
    else if (row.display_on_profile === true) shown.push(row);
    else if (row.display_on_profile === false) hidden.push(row);
    else unknown.push(row);
  }
  return { visible: shown.slice(0, limit), overflow: shown.slice(limit), hidden, unknown, historical };
}

export async function saveMedalVisibility(db: SupabaseClient, assignmentId: string, visible: boolean): Promise<boolean> {
  if (!UUID.test(assignmentId)) throw new Error('Choose a valid medal record.');
  if (typeof visible !== 'boolean') throw new Error('Choose whether to show or hide the medal.');
  let result;
  try {
    result = await db.rpc('set_personnel_medal_visibility', {
      target_assignment: assignmentId,
      visible_on_profile: visible,
    });
  } catch {
    throw new Error(SAVE_FAILED);
  }
  if (result.error) {
    const code = errorCode(result.error);
    if (code === 'PGRST202' || code === '42883' || isVisibilityColumnMissing(result.error)) throw new Error(UNAVAILABLE);
    if (code === '42501') throw new Error('You cannot change this medal display preference. Ask a staff member for help.');
    if (code === 'P0002') throw new Error('This medal is no longer an active award. Reload the member record.');
    throw new Error(SAVE_FAILED);
  }
  // `false` is a successful hide. A missing or mismatched value is not proof
  // that the requested preference was saved, even when the HTTP request worked.
  if (typeof result.data !== 'boolean' || result.data !== visible) throw new Error(SAVE_FAILED);
  return result.data;
}
