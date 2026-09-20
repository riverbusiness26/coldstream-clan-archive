import { FiCheck, FiChevronDown, FiCoffee, FiFlag, FiLayers, FiShield, FiTarget } from 'react-icons/fi';
import type { ActivityLevel } from '../lib/activityLevels';
import '../quartermaster-activity.css';

const icons = { dice: FiTarget, blackjack: FiLayers, heists: FiShield, duty: FiFlag, ration: FiCoffee };
const count = (value: number) => value.toLocaleString();
type Props = { levels?: ActivityLevel[]; title?: string; locked?: boolean; chooseTitle?: (id: string) => void };

export default function QuartermasterActivityLevels({ levels, title, locked, chooseTitle }: Props) {
  return <section className="qm-activity" aria-labelledby="qm-activity-heading">
    <div className="qm-activity-heading"><div><p className="qm-eyebrow">At the tables. Out with the crew.</p><h3 id="qm-activity-heading">Activity levels</h3></div><span>Permanent progress</span></div>
    <p className="qm-activity-intro">Five paths, earned by taking part. Your levels stay with you when you take a break. These are Shillings levels, not regiment ranks.</p>
    {!levels?.length ? <p className="qm-activity-unavailable" role="status">Activity levels are not available from this game service yet. No progress is being estimated.</p> : <div className="qm-activity-list">{levels.map(track => {
      const Icon = icons[track.key];
      const earned = track.xp - track.levelStartXp, needed = track.nextLevelXp - track.levelStartXp;
      const nextReward = track.rewards.find(reward => !reward.earned);
      const percent = Math.max(0, Math.min(100, earned / needed * 100));
      return <details className={`qm-activity-track qm-activity-${track.key}`} key={track.key}>
        <summary>
          <span className="qm-activity-emblem" aria-hidden="true"><Icon /></span>
          <span className="qm-activity-name"><strong>{track.label}</strong><small>{count(track.activeDays)} active {track.activeDays === 1 ? 'day' : 'days'}</small></span>
          <span className="qm-activity-meter"><span><b>Level {count(track.level)}</b><small>{count(earned)} / {count(needed)} XP</small></span><span className="qm-activity-bar" role="progressbar" aria-label={`${track.label}: progress to level ${track.level + 1}`} aria-valuemin={0} aria-valuemax={needed} aria-valuenow={earned}><i style={{ width: `${percent}%` }} /></span></span>
          <FiChevronDown className="qm-activity-chevron" aria-hidden="true" />
        </summary>
        <div className="qm-activity-detail">
          <dl className="qm-activity-stats"><div><dt>Completed</dt><dd>{count(track.completed)}</dd></div>{['dice', 'blackjack', 'heists'].includes(track.key) && <div><dt>Wins</dt><dd>{count(track.wins)}</dd></div>}<div><dt>Current day run</dt><dd>{count(track.currentRun)}</dd></div><div><dt>Best day run</dt><dd>{count(track.bestRun)}</dd></div><div><dt>Lifetime XP</dt><dd>{count(track.xp)}</dd></div></dl>
          <p>{track.xpPerAction} XP per completed {track.key === 'blackjack' ? 'hand' : track.key === 'heists' ? 'crew heist' : track.key === 'ration' ? 'claim' : track.key === 'duty' ? 'duty' : 'round'}, plus {track.firstDayBonus} XP on the first completion of each Chicago day. XP counts for up to {track.dailyLimit} per day. Bigger wagers earn no extra XP.</p>
          <p className="qm-activity-limit">{Math.max(0, track.dailyLimit - track.todayCompleted)} XP-earning completions left today. {track.key === 'blackjack' ? 'Timed-out hands do not earn XP.' : track.key === 'heists' ? 'Completed wins and losses count. Cancelled heists do not.' : 'Completed activity stays on your record after the XP limit.'}</p>
          <h4>Days taking part</h4><div className="qm-activity-milestones">{track.milestones.map(milestone => <span key={milestone.days} className={milestone.earned ? 'earned' : ''}>{milestone.earned && <FiCheck aria-hidden="true" />}{milestone.days} days<span className="sr-only">{milestone.earned ? ', earned' : ', not yet earned'}</span></span>)}</div>
          <h4>Earned titles</h4><p>{nextReward ? `Next: ${nextReward.name} at level ${nextReward.level}.` : 'All titles earned. Your level keeps growing.'}</p>
          <div className="qm-activity-rewards">{track.rewards.map(reward => {
            const equipped = title === reward.name || title === reward.titleId;
            return <div key={reward.titleId} className={reward.earned ? 'earned' : ''}><small>Level {reward.level}</small><strong>{reward.name}</strong>{reward.earned ? chooseTitle ? <button className="qm-text-button" disabled={locked || equipped} onClick={() => chooseTitle(reward.titleId)}>{equipped ? 'Equipped' : 'Use title'}</button> : <span>Earned</span> : <span>Locked</span>}</div>;
          })}</div>
        </div>
      </details>;
    })}</div>}
    <p className="qm-activity-footnote">Based on recorded, dated outcomes. Active days use Chicago time. Old balances alone do not count as activity.</p>
  </section>;
}
