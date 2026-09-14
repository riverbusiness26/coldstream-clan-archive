import type { SupabaseClient } from '@supabase/supabase-js';

export async function reviewWeeklyContent(db: SupabaseClient, id: string, status: 'approved' | 'rejected' | 'archived' | 'pending', reviewer: string) {
  // A second reviewer must not silently overwrite an earlier decision.
  const expected = status === 'archived' ? 'approved' : status === 'pending' ? 'archived' : 'pending';
  const query = status === 'rejected'
    ? db.from('weekly_content_submission').delete()
    : db.from('weekly_content_submission').update({ status, reviewed_by: reviewer, reviewed_at: new Date().toISOString() });
  const result = await query.eq('id', id).eq('status', expected).select('id').single();
  if (result.error || !result.data) throw new Error(result.error?.message || 'This submission changed or is no longer available. Refresh records before reviewing it again.');
  if (status !== 'approved') return { publicationError: null };
  try {
    const publication = await db.rpc('deploy_weekly_content');
    return { publicationError: publication.error?.message ?? null };
  } catch {
    return { publicationError: 'Publication could not be confirmed.' };
  }
}

export async function deleteArchivedWeeklyContent(db: SupabaseClient, id: string) {
  const result = await db.from('weekly_content_submission').delete().eq('id', id).eq('status', 'archived').select('id').single();
  if (result.error || !result.data) throw new Error(result.error?.message || 'This archived submission changed or is no longer available. Refresh records before deleting it again.');
  return result.data.id;
}
