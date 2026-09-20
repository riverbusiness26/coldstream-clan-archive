import { supa } from './supa';
import { QUARTERMASTER_API_URL, localPreviewAllowed } from './quartermaster';

export const CAMPAIGN_ENABLED = import.meta.env.VITE_LIVING_CAMPAIGN_ENABLED === 'true';
export type CampaignCommand = { action: 'join' | 'leave' | 'order' | 'contribute' | 'cancel' | 'close' | 'vote_route' | 'vote_project' | 'vote_encounter'; args: Record<string, string>; requestId: string };
export type CampaignQuote = { id: string; kind: 'order' | 'materials' | 'supplies'; targetName: string; units: number; cost: number; resource?: string; job?: string; balanceAfter?: number; remainingNeed?: number; remainingPaidCapacity?: number; remainingDailyAllowance?: number; expiresAt: string };
type Receipt = { id: string; targetId: string; targetName: string; amount: number; units: number; resource?: string; cycle: string; status: 'committed' | 'consumed' | 'refunded'; ledgerId: string; refundLedgerId?: string; at: string };
export type CampaignActivity = { id: string; kind: string; nodeId: string; at: string; label: string };
export type CampaignOperation = { id: string; nodeId: string; name: string; plan: string; phase: number; phaseName: string; status: string; requirements: { recon: number; supplies: number; readiness: number }; recon: number; supplies: number; readiness: number; paidSupplies: number; paidCap: number; participants: number; participantGate: number; activatedCycle: string; completedAt?: string };
export type CampaignEncounter = { id: string; title: string; description: string; status: 'open' | 'resolved'; options: { id: string; label: string; description: string; votes: number }[]; ownVote: string | null; chosen?: string; roll?: number; outcome?: string };
export type CampaignExpedition = {
  version: string; currentNode: string; owned: string[]; operation: CampaignOperation | null;
  completedOperations: number; totalLocations: number; victory: boolean; population: number; phaseNames: string[];
  routeBallot: { options: { nodeId: string; plan: string; name: string; votes: number }[]; own: { nodeId: string; plan: string } | null };
  projectBallot: { options: { blueprint: string; name: string; votes: number }[]; own: string | null };
  facilities: { blueprint: string; name: string; benefitActive: boolean }[];
  encounter: CampaignEncounter | null; activity: CampaignActivity[];
};
export type CampaignSnapshot = {
  preview: boolean; serverTime: string;
  expedition?: CampaignExpedition;
  campaign: { id: string; title: string; status: string; rulesVersion: string; revision: number; cycle: string; nextAt: string; timezone: string; cutoff: string };
  project: { id: string; name: string; status: 'active' | 'completed' | 'cancelled'; population: number; requirements: { materials: number; work: number }; materials: number; paidMaterials: number; paidCap: number; work: number; benefitActive: boolean; benefitFromCycle?: string };
  member: { joined: boolean; orders: number; frozen: boolean; availableBalance: number; acceptedToday: number; dailyCap: number; canModerate: boolean; campaignOrders: number; receipts: Receipt[]; ordersHistory: { id: string; job: string; units: number; resource: string; at: string }[] };
  activity: { id: string; targetId: string; text: string; at: string }[];
};
export class CampaignRequestError extends Error {
  constructor(message: string, public pending: boolean, public code = 'UNAVAILABLE') { super(message); }
}
export async function campaignRequest<T>(path: string, demo: boolean, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (localPreviewAllowed(demo)) headers['X-Quartermaster-Preview'] = 'local-only';
  else {
    const session = supa ? (await supa.auth.getSession()).data.session : null;
    if (!session) throw new CampaignRequestError('Sign in to open the shared campaign.', false, 'SIGN_IN_REQUIRED');
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  if (body) headers['Content-Type'] = 'application/json';
  const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${QUARTERMASTER_API_URL}/campaign${path}`, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, credentials: 'omit', signal: controller.signal });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new CampaignRequestError(result.message || 'The campaign could not confirm this request.', Boolean(result.retryable) || response.status >= 500, result.code);
    if (!result.data) throw new CampaignRequestError('The campaign receipt is incomplete.', true);
    return result.data as T;
  } catch (error) {
    if (error instanceof CampaignRequestError) throw error;
    throw new CampaignRequestError('Confirmation has not arrived. Reconcile this same request before making another action.', true);
  } finally { window.clearTimeout(timeout); }
}
export const campaignRead = (demo: boolean) => campaignRequest<CampaignSnapshot>('', demo);
export const campaignQuote = (demo: boolean, intent: object) => campaignRequest<CampaignQuote>('/quote', demo, intent);
export const campaignAct = (demo: boolean, command: CampaignCommand) => campaignRequest<{ message: string; snapshot: CampaignSnapshot; replayed: boolean }>('/action', demo, command);
