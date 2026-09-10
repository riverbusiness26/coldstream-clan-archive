import type { SupabaseClient } from '@supabase/supabase-js';

export interface CombatStats {
  eventsAttended: number | null;
  kills: number | null;
  deaths: number | null;
  mvps: number | null;
  top5: number | null;
  kdr: number | null;
  attendancePercent: number | null;
  attendanceHours: number | null;
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

function numberOrNull(value: unknown) {
  return value === null || value === undefined ? null : Number(value) || 0;
}

export type CombatPeriod = 'Day' | 'Week' | 'Month' | 'All time';

function periodStart(period: CombatPeriod): Date | null {
  if (period === 'All time') return null;
  const now = new Date();
  if (period === 'Day') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'Week') {
    const mondayOffset = (now.getDay() + 6) % 7;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function loadCombatStats(db: SupabaseClient, memberId: string, period: CombatPeriod = 'All time'): Promise<CombatStats> {
  const start = periodStart(period);
  const statsQuery = start
    ? db.from('stat_submission').select('id,created_at,stat_round(kills,deaths,is_mvp,is_top5)').eq('submitter_id', memberId).eq('status', 'approved').gte('created_at', start.toISOString())
    : db.from('stat_leaderboard').select('kills,deaths,mvps,top5').eq('member_id', memberId);
  const [statsResult, attendanceResult, hoursResult] = await Promise.all([
    statsQuery,
    db.from('event_rsvp').select('attendance,status').eq('member_id', memberId),
    db.rpc('member_attendance_hours', { target_member: memberId }),
  ]);

  const rows = start
    ? ((statsResult.data ?? []) as Array<{ stat_round?: Array<{ kills?: number; deaths?: number; is_mvp?: boolean; is_top5?: boolean }> }>).flatMap((submission) => submission.stat_round ?? []).map((round) => ({ kills: round.kills, deaths: round.deaths, mvps: round.is_mvp ? 1 : 0, top5: round.is_top5 ? 1 : 0 }))
    : (statsResult.data ?? []) as Array<{ kills?: number; deaths?: number; mvps?: number; top5?: number }>;
  const totals = rows.reduce<{ kills: number; deaths: number; mvps: number; top5: number }>((sum, row) => ({
    kills: sum.kills + (numberOrNull(row.kills) ?? 0),
    deaths: sum.deaths + (numberOrNull(row.deaths) ?? 0),
    mvps: sum.mvps + (numberOrNull(row.mvps) ?? 0),
    top5: sum.top5 + (numberOrNull(row.top5) ?? 0),
  }), { kills: 0, deaths: 0, mvps: 0, top5: 0 });

  const attendanceRows = (attendanceResult.data ?? []) as Array<{ attendance?: string | null; status?: string | null }>;
  const attended = attendanceRows.filter((row) => row.attendance === 'attended').length;
  const attendancePercent = attendanceRows.length > 0 ? Math.round((attended / attendanceRows.length) * 100) : null;
  const hasStats = rows.length > 0;
  const hasAttendance = attendanceRows.length > 0;
  const attendanceHours = hoursResult.error || hoursResult.data === null || hoursResult.data === undefined
    ? null
    : Number(hoursResult.data);

  return {
    eventsAttended: hasAttendance ? attended : null,
    kills: hasStats ? totals.kills : null,
    deaths: hasStats ? totals.deaths : null,
    mvps: hasStats ? totals.mvps : null,
    top5: hasStats ? totals.top5 : null,
    kdr: hasStats ? (totals.deaths > 0 ? totals.kills / totals.deaths : totals.kills) : null,
    attendancePercent,
    attendanceHours,
  };
}

export function displayStat(value: number | null, suffix = '') {
  if (value === null) return 'Not recorded';
  return `${value}${suffix}`;
}
