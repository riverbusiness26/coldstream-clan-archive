import type { SupabaseClient } from '@supabase/supabase-js';
import { combatPeriodRange, type CombatPeriod, type CombatPeriodRange } from './combatPeriod';

export type { CombatPeriod } from './combatPeriod';

export interface CombatStats {
  eventsAttended: number | null;
  kills: number | null;
  deaths: number | null;
  mvps: number | null;
  top5: number | null;
  kdr: number | null;
  attendancePercent: number | null;
  attendanceHours: number | null;
  weeklyFeatures?: number | null;
  weeklySubmissions?: number | null;
  galleryUploads?: number | null;
}

export const EMPTY_COMBAT_STATS: CombatStats = {
  eventsAttended: null,
  kills: null,
  deaths: null,
  mvps: null,
  top5: null,
  kdr: null,
  attendancePercent: null,
  attendanceHours: null,
};

type TotalsRow = { kills?: unknown; deaths?: unknown; mvps?: unknown; top5?: unknown };
type SubmissionRow = {
  id: string;
  stat_round?: Array<{ kills?: unknown; deaths?: unknown; is_mvp?: unknown; is_top5?: unknown }>;
};
const SUBMISSION_PAGE_SIZE = 250;

function numberOrNull(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && value.trim() === '')) return null;
  if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function countTotal(rows: TotalsRow[], field: keyof TotalsRow): number | null {
  let total = 0;
  for (const row of rows) {
    const value = numberOrNull(row[field]);
    if (value === null || !Number.isSafeInteger(value)) return null;
    total += value;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

async function periodRows(db: SupabaseClient, memberId: string, range: CombatPeriodRange): Promise<TotalsRow[] | null> {
  const rows: TotalsRow[] = [];
  let afterId: string | null = null;
  // The nullable event link is the only occurrence timestamp in this schema.
  // Undated legacy submissions remain in all-time totals, not guessed into a
  // day or week using the time somebody uploaded their proof.
  while (true) {
    let query = db.from('stat_submission')
      .select('id,event!inner(starts_at),stat_round(kills,deaths,is_mvp,is_top5)')
      .eq('submitter_id', memberId)
      .eq('status', 'approved')
      .gte('event.starts_at', range.start)
      .lt('event.starts_at', range.end)
      .order('id', { ascending: true })
      .limit(SUBMISSION_PAGE_SIZE);
    if (afterId) query = query.gt('id', afterId);
    const result = await query;
    if (result.error || !Array.isArray(result.data)) return null;
    const submissions = result.data as unknown as SubmissionRow[];
    for (const submission of submissions) {
      if (!submission || typeof submission.id !== 'string' || !Array.isArray(submission.stat_round)) return null;
      for (const round of submission.stat_round) {
        if (!round || typeof round !== 'object') return null;
        rows.push({
          kills: round.kills,
          deaths: round.deaths,
          mvps: round.is_mvp === true ? 1 : round.is_mvp === false ? 0 : null,
          top5: round.is_top5 === true ? 1 : round.is_top5 === false ? 0 : null,
        });
      }
    }
    if (submissions.length < SUBMISSION_PAGE_SIZE) return rows;
    const lastId = submissions[submissions.length - 1]?.id;
    if (!lastId || (afterId && lastId <= afterId)) return null;
    afterId = lastId;
  }
}

async function statRows(db: SupabaseClient, memberId: string, range: CombatPeriodRange | null): Promise<TotalsRow[] | null> {
  if (range) return periodRows(db, memberId, range);
  const result = await db.from('stat_leaderboard').select('kills,deaths,mvps,top5').eq('member_id', memberId);
  if (result.error || !Array.isArray(result.data)) return null;
  if (result.data.some((row) => row === null || typeof row !== 'object')) return null;
  return result.data as TotalsRow[];
}

async function sampledAllTimeHours(db: SupabaseClient, memberId: string): Promise<number | null> {
  const result = await db.rpc('member_attendance_hours', { target_member: memberId });
  return result.error ? null : numberOrNull(result.data);
}

export async function loadCombatStats(db: SupabaseClient, memberId: string, period: CombatPeriod = 'All time'): Promise<CombatStats> {
  if (!memberId.trim()) return { ...EMPTY_COMBAT_STATS };
  const range = combatPeriodRange(period);
  const [rows, attendanceHours, activity] = await Promise.all([
    statRows(db, memberId, range).catch(() => null),
    // The existing RPC has no date arguments. Reusing its all-time result for
    // a filtered card would mix periods. Raw samples remain staff-only.
    range ? Promise.resolve(null) : sampledAllTimeHours(db, memberId).catch(() => null),
    range ? Promise.resolve(null) : Promise.resolve().then(() => db.rpc('member_profile_activity', { target_member: memberId })).then((result) => result.error ? null : result.data).catch(() => null),
  ]);
  const hasRows = rows !== null && rows.length > 0;
  const kills = hasRows ? countTotal(rows, 'kills') : null;
  const deaths = hasRows ? countTotal(rows, 'deaths') : null;
  return {
    kills,
    deaths,
    mvps: hasRows ? countTotal(rows, 'mvps') : null,
    top5: hasRows ? countTotal(rows, 'top5') : null,
    // Preserve the established zero-deaths rule used by stat_leaderboard.
    kdr: kills === null || deaths === null ? null : deaths > 0 ? kills / deaths : kills,
    attendanceHours: activity ? numberOrNull(activity.attendance_hours) : attendanceHours,
    // RSVP intent and a staff attendance mark do not prove sampled voice
    // attendance. No member-safe period/event-count aggregate exists yet.
    eventsAttended: activity ? numberOrNull(activity.events_attended) : null,
    ...(activity ? { weeklyFeatures: numberOrNull(activity.weekly_features), weeklySubmissions: numberOrNull(activity.weekly_submissions), galleryUploads: numberOrNull(activity.gallery_uploads) } : {}),
    attendancePercent: null,
  };
}

export function displayStat(value: number | null, suffix = '') {
  if (value === null || !Number.isFinite(value)) return 'Not recorded';
  return `${value}${suffix}`;
}
