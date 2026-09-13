export type EnlistmentDecision = 'accepted' | 'denied';

interface ReviewDatabase {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export function enlistmentDecisionError(decision: EnlistmentDecision, reason: string): string | null {
  if (!['accepted', 'denied'].includes(decision)) return 'Choose a valid application decision.';
  if (decision === 'denied' && !reason.trim()) return 'Write the reason that will be sent to the applicant.';
  if (reason.trim().length > 1000) return 'Keep the staff reason to 1,000 characters or fewer.';
  return null;
}

export async function reviewRegimentEnlistment(
  db: ReviewDatabase,
  applicationId: string,
  decision: EnlistmentDecision,
  reason: string,
) {
  const validation = enlistmentDecisionError(decision, reason);
  if (validation) throw new Error(validation);
  const result = await db.rpc('review_regiment_enlistment', {
    target_application: applicationId,
    decision,
    staff_reason: reason.trim() || null,
  });
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error('The application changed before this decision was saved. Refresh the inbox.');
  return result.data;
}
