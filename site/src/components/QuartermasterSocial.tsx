import { useState, type FormEvent, type ReactNode } from 'react';
import { FiArrowRight, FiClock, FiCrosshair, FiFlag, FiShield, FiUsers } from 'react-icons/fi';
import { CoinReward } from './QuartermasterRewards';
import { shillings, type ActionArgs, type ActionKey, type QuartermasterSnapshot } from '../lib/quartermaster';
import type { Reward, RewardLocation } from '../lib/quartermasterMotion';

function left(value: string | null | undefined, now: number) {
  const seconds = Math.max(0, Math.ceil((new Date(value || 0).getTime() - now) / 1000));
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60);
  return hours ? `${hours}h ${minutes}m` : minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

export default function QuartermasterSocial({ snapshot, locked, now, rewards, run, status }: {
  snapshot: QuartermasterSnapshot;
  locked: boolean;
  now: number;
  rewards: Partial<Record<RewardLocation, Reward>>;
  run: (action: ActionKey, args?: ActionArgs) => Promise<boolean>;
  status: (action: ActionKey) => ReactNode;
}) {
  const { profile: me, social, config } = snapshot;
  const peers = snapshot.leaderboard.filter(member => member.discordId !== me.discordId);
  const [duelTarget, setDuelTarget] = useState('');
  const [duelStake, setDuelStake] = useState('10');
  const [splitTarget, setSplitTarget] = useState('');
  const [splitStake, setSplitStake] = useState('10');
  const [splitChoice, setSplitChoice] = useState<'split' | 'steal'>('split');
  const [tickets, setTickets] = useState('1');
  const crimeWait = left(snapshot.cooldowns.crime, now);
  const forageWait = left(snapshot.cooldowns.steal, now);
  const openDuel = social.duels.find(game => game.status === 'open');
  const incomingDuel = openDuel?.targetId === me.discordId ? openDuel : null;
  const openSplit = social.splitGames.find(game => game.status === 'open');
  const incomingSplit = openSplit?.targetId === me.discordId ? openSplit : null;
  const recentDuel = social.duels.find(game => game.status !== 'open');
  const recentSplit = social.splitGames.find(game => game.status !== 'open');
  const heist = social.heist;
  const inHeist = heist?.participants.some(member => member.discordId === me.discordId);
  const heistWait = left(heist?.expiresAt, now);
  const stakeValid = (value: string, key: 'duel' | 'splitsteal') => Number.isInteger(Number(value)) && Number(value) >= config[key].min_stake && Number(value) <= config[key].max_stake && Number(value) <= me.purse;
  const ticketValid = Number.isInteger(Number(tickets)) && Number(tickets) > 0 && Number(tickets) + (social.lottery?.ownTickets ?? 0) <= config.lottery.max_tickets_per_member && Number(tickets) * config.lottery.ticket_price <= me.purse;
  const mostWanted = [...snapshot.leaderboard].sort((a, b) => b.forageWins - a.forageWins || a.displayName.localeCompare(b.displayName)).slice(0, 10);
  const submit = (event: FormEvent, action: ActionKey, args: ActionArgs) => { event.preventDefault(); void run(action, args); };

  return <>
    <div className="qm-section-heading"><div><p className="qm-eyebrow">Schemes, wagers and friendly trouble</p><h2>Field Games.</h2><p>Challenge the company, risk your Wallet and watch each result settle live.</p></div><span className="qm-social-wallet">Wallet <strong>{shillings(me.purse)}</strong></span></div>
    <div className="qm-social-grid">
      <section className="qm-panel qm-social-card crime"><span className="qm-social-icon"><FiCrosshair /></span><p className="qm-eyebrow">One risky errand</p><h3>Crime</h3><p>A 55% chance to earn 8–30 Shillings. If the provost catches you, the fine is 4–15 Shillings.</p><button className="qm-button gold" disabled={locked || Boolean(crimeWait)} onClick={() => void run('crime')}>{crimeWait ? `Ready in ${crimeWait}` : 'Try the errand'}<FiArrowRight /></button><CoinReward reward={rewards.crime} />{status('crime')}</section>
      <section className="qm-panel qm-social-card counter"><span className="qm-social-icon"><FiShield /></span><p className="qm-eyebrow">Answer a recent theft</p><h3>Counter-steal</h3>{social.counterAvailable ? <><p><strong>{social.counterAvailable.attackerName}</strong> took {shillings(social.counterAvailable.taken)}. Try to recover half before the trail goes cold.</p><button className="qm-button gold" disabled={locked || Boolean(forageWait)} onClick={() => void run('countersteal')}>{forageWait ? `Forage timer: ${forageWait}` : 'Attempt counter-steal'}<FiArrowRight /></button></> : <p>No successful forage against you is ready to counter. A fresh opportunity lasts 30 minutes.</p>}<CoinReward reward={rewards.countersteal} />{status('countersteal')}</section>

      <section className="qm-panel qm-social-card wide"><span className="qm-social-icon"><FiCrosshair /></span><p className="qm-eyebrow">Equal stakes. Fair odds.</p><h3>Duel</h3>{incomingDuel ? <div className="qm-social-callout"><strong>{incomingDuel.challengerName} challenges you for {shillings(incomingDuel.stake)}.</strong><span>Answer before {left(incomingDuel.expiresAt, now) || 'the challenge expires'}.</span><div><button className="qm-button gold" disabled={locked || me.purse < incomingDuel.stake} onClick={() => void run('duel', { action: 'accept', gameId: incomingDuel.id })}>Accept duel</button><button className="qm-button" disabled={locked} onClick={() => void run('duel', { action: 'decline', gameId: incomingDuel.id })}>Decline</button></div></div> : openDuel ? <div className="qm-social-callout"><strong>Waiting for {openDuel.targetName}</strong><span>{shillings(openDuel.stake)} staked · expires in {left(openDuel.expiresAt, now)}</span></div> : <form className="qm-social-form" onSubmit={(e) => submit(e, 'duel', { action: 'challenge', targetDiscordId: duelTarget, stake: Number(duelStake) })}><label className="qm-field">Challenge<select value={duelTarget} onChange={e => setDuelTarget(e.target.value)}><option value="">Select a member</option>{peers.map(member => <option key={member.discordId} value={member.discordId}>{member.displayName}</option>)}</select></label><label className="qm-field">Each member stakes<input type="number" min={config.duel.min_stake} max={config.duel.max_stake} value={duelStake} onChange={e => setDuelStake(e.target.value)} /></label><button className="qm-button gold" disabled={locked || !duelTarget || !stakeValid(duelStake, 'duel')}>Issue challenge<FiArrowRight /></button></form>}{recentDuel && <p className="qm-social-result">Last duel: {recentDuel.status === 'finished' ? `${recentDuel.winnerName} won ${shillings(recentDuel.stake * 2)}.` : `Challenge ${recentDuel.status}.`}</p>}<CoinReward reward={rewards.duel} />{status('duel')}</section>

      <section className="qm-panel qm-social-card wide"><span className="qm-social-icon"><FiUsers /></span><p className="qm-eyebrow">Trust them, or take it all</p><h3>Split or Steal</h3>{incomingSplit ? <div className="qm-social-callout"><strong>{incomingSplit.challengerName} has sealed a choice for a {shillings(incomingSplit.stake)} stake.</strong><span>Your choice decides who takes the {shillings(incomingSplit.stake * 2)} pot.</span><div><button className="qm-button gold" disabled={locked || me.purse < incomingSplit.stake} onClick={() => void run('splitsteal', { action: 'choose', gameId: incomingSplit.id, choice: 'split' })}>Choose Split</button><button className="qm-button" disabled={locked || me.purse < incomingSplit.stake} onClick={() => void run('splitsteal', { action: 'choose', gameId: incomingSplit.id, choice: 'steal' })}>Choose Steal</button><button className="qm-text-button" disabled={locked} onClick={() => void run('splitsteal', { action: 'decline', gameId: incomingSplit.id })}>Decline</button></div></div> : openSplit ? <div className="qm-social-callout"><strong>Waiting for {openSplit.targetName}</strong><span>Your choice is sealed. Expires in {left(openSplit.expiresAt, now)}.</span></div> : <form className="qm-social-form" onSubmit={(e) => submit(e, 'splitsteal', { action: 'challenge', targetDiscordId: splitTarget, stake: Number(splitStake), choice: splitChoice })}><label className="qm-field">Invite<select value={splitTarget} onChange={e => setSplitTarget(e.target.value)}><option value="">Select a member</option>{peers.map(member => <option key={member.discordId} value={member.discordId}>{member.displayName}</option>)}</select></label><label className="qm-field">Each member stakes<input type="number" min={config.splitsteal.min_stake} max={config.splitsteal.max_stake} value={splitStake} onChange={e => setSplitStake(e.target.value)} /></label><div className="qm-choice" role="group" aria-label="Your sealed choice"><button type="button" className={splitChoice === 'split' ? 'active' : ''} onClick={() => setSplitChoice('split')}>Split</button><button type="button" className={splitChoice === 'steal' ? 'active danger' : ''} onClick={() => setSplitChoice('steal')}>Steal</button></div><button className="qm-button gold" disabled={locked || !splitTarget || !stakeValid(splitStake, 'splitsteal')}>Seal choice<FiArrowRight /></button></form>}{recentSplit?.result && <p className="qm-social-result">{recentSplit.result}</p>}<CoinReward reward={rewards.splitsteal} />{status('splitsteal')}</section>

      <section className="qm-panel qm-social-card heist"><span className="qm-social-icon"><FiFlag /></span><p className="qm-eyebrow">A public company venture</p><h3>Supply-wagon Heist</h3>{heist?.status === 'open' && heistWait ? <><p><strong>{heist.creatorName}</strong> opened the lobby. {heist.participants.length} joined, with {shillings(heist.pot)} in the pot.</p><div className="qm-social-timer"><FiClock /> Results in {heistWait}</div><button className="qm-button gold" disabled={locked || inHeist || me.purse < config.heist.entry_fee} onClick={() => void run('heist', { action: 'join', gameId: heist.id })}>{inHeist ? 'You are in the heist' : `Join for ${shillings(config.heist.entry_fee)}`}<FiArrowRight /></button></> : <><p>Open a 90-second lobby. Every member pays {shillings(config.heist.entry_fee)} and gets their own 60% chance to share the pot.</p><button className="qm-button gold" disabled={locked || me.purse < config.heist.entry_fee} onClick={() => void run('heist', { action: 'start' })}>Start a heist<FiArrowRight /></button>{heist?.status === 'finished' && <p className="qm-social-result">Last heist: {heist.winners?.length ? `${heist.winners.map(member => member.displayName).join(', ')} divided ${shillings(heist.pot)}.` : 'the whole party failed.'}</p>}</>}<CoinReward reward={rewards.heist} />{status('heist')}</section>

      <section className="qm-panel qm-social-card lottery"><span className="qm-social-icon">🎟️</span><p className="qm-eyebrow">Ticket-funded daily draw</p><h3>Shillings Lottery</h3><p>Current pot: <strong>{shillings(social.lottery?.pot ?? 0)}</strong><br />Your tickets: <strong>{social.lottery?.ownTickets ?? 0}</strong></p>{social.lottery && <div className="qm-social-timer"><FiClock /> Draw in {left(social.lottery.drawsAt, now) || 'moments'}</div>}<form className="qm-ticket-form" onSubmit={(e) => submit(e, 'lottery', { action: 'buy', qty: Number(tickets) })}><label className="qm-field">Tickets<input type="number" min="1" max={config.lottery.max_tickets_per_member - (social.lottery?.ownTickets ?? 0)} value={tickets} onChange={e => setTickets(e.target.value)} /></label><button className="qm-button gold" disabled={locked || !ticketValid}>Buy for {shillings(Number(tickets || 0) * config.lottery.ticket_price)}</button></form>{social.lottery?.lastResult && <p className="qm-social-result">Last draw: {social.lottery.lastResult.winnerName ? `${social.lottery.lastResult.winnerName} won ${shillings(social.lottery.lastResult.pot)}.` : 'No tickets were entered.'}</p>}<CoinReward reward={rewards.lottery} />{status('lottery')}</section>

      <section className="qm-panel qm-social-card wanted"><span className="qm-social-icon"><FiCrosshair /></span><p className="qm-eyebrow">The company watch list</p><h3>Most Wanted</h3><ol>{mostWanted.map((member, index) => <li key={member.discordId}><span>{index + 1}. {member.displayName}{member.discordId === me.discordId ? ' (You)' : ''}</span><strong>{member.forageWins} success{member.forageWins === 1 ? '' : 'es'}</strong></li>)}</ol></section>
    </div>
    <p className="qm-social-footnote">All games use fictional Shillings with no cash value. Challenges and lobbies update automatically every five seconds.</p>
  </>;
}

