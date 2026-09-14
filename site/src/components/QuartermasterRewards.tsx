import type { Reward } from '../lib/quartermasterMotion';
import { shillings } from '../lib/quartermaster';

export function CoinReward({ reward }: { reward?: Reward }) {
  if (!reward) return null;
  return <div className={`qm-outcome ${reward.net > 0 ? 'won' : reward.net < 0 ? 'lost' : 'even'}`} role="status" key={reward.id}>
    <strong>{reward.title}</strong><span>{reward.net > 0 ? '+' : ''}{shillings(reward.net)}{['anchor', 'vingt'].includes(reward.location) ? ' net result' : ''}</span>
    {reward.earned > 0 && <div className="qm-coin-rise" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}quartermaster/shilling-refined-heritage-v3.webp`} alt="" width="64" height="64" /><b>+{reward.earned.toLocaleString()}</b></div>}
  </div>;
}
