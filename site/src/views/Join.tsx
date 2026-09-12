import { useState } from 'react';
import { FaArrowRight, FaDiscord } from 'react-icons/fa6';
import { COMMUNITY_DISCORD } from '../components/SiteShell';
import { asset } from '../lib/asset';
export default function Join({ signIn }: { signIn: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    ['Join the conversation.', 'Start in our Discord. It is where the community meets, plans games and answers questions.'],
    ['Find your company.', 'Interested in the 2nd Coldstream Guards, a game night, or simply playing together? Introduce yourself and speak with the community.'],
    ['Make yourself at home.', 'Once your Discord member access is ready, sign in here for your rank, statistics, weekly brief and events.'],
  ];
  return <main className="hq-join hq-band"><div className="hq-join-intro"><img src={asset('/crest.webp')} width="180" height="184" alt="Coldstream crest" /><p className="hq-eyebrow">Join the Coldstream</p><h1>A place in<br /><em>the line.</em></h1><p>A gaming community since 2011.<br />Your next chapter starts on Discord.</p></div><section className="hq-join-steps"><div className="hq-step-tabs" role="tablist" aria-label="Joining Coldstream">{['I', 'II', 'III'].map((n, i) => <button key={n} role="tab" id={`step-${i}`} aria-selected={step === i} aria-controls="join-step" tabIndex={step === i ? 0 : -1} onKeyDown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const next = (step + (e.key === 'ArrowRight' ? 1 : 2)) % 3; setStep(next); document.getElementById(`step-${next}`)?.focus(); } }} onClick={() => setStep(i)}>{n}<span>{['Discord', 'Community', 'Headquarters'][i]}</span></button>)}</div><div key={step} className="hq-step-content" id="join-step" role="tabpanel" aria-labelledby={`step-${step}`}><span className="hq-eyebrow">Step {step + 1} of 3</span><h2>{steps[step][0]}</h2><p>{steps[step][1]}</p>{step < 2 ? <><a className="hq-button primary" href={COMMUNITY_DISCORD} target="_blank" rel="noreferrer"><FaDiscord />Open Discord</a><button className="hq-text-link" onClick={() => setStep(step + 1)}>Next step <FaArrowRight /></button></> : <button className="hq-button primary" onClick={signIn}><FaDiscord />Continue with Discord</button>}</div><small>Already a member? <button onClick={signIn}>Sign in to your headquarters.</button></small></section></main>;
}
