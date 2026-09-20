import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FiArrowLeft, FiArrowRight, FiCompass, FiFlag, FiMap, FiTool, FiMinus, FiPlus, FiPause, FiPlay, FiNavigation } from 'react-icons/fi';
import pilot from '../campaign-data/pilot_config.json';
import targets from '../campaign-data/review-targets.json';
import type { MapActivity, MapControls, MapExpedition } from '../lib/campaignMapScene';
import '../campaign-map.css';

type Location = { id: string; name: string; plans?: Record<string, { recon: number; supplies: number; readiness: number }>; capture_boon?: { kind: string; value: number } };
const locations = pilot.map.nodes as Location[];
const stories: Record<string, { subtitle: string; description: string; decision: string }> = {
  camp: { subtitle: 'Our foothold on the road', description: 'Canvas, timber and a shared purpose. The expedition begins here, with a Field Kitchen built by the company.', decision: 'Choose where your free orders help most: gather Materials or build the Kitchen.' },
  crossing: { subtitle: 'Across the winding river', description: 'A narrow timber crossing opens the road inland. Prepare the first advance together, then decide which route the company follows.', decision: 'Choose the Orchard route for supplies or the Windmill route for reconnaissance.' },
  orchard: { subtitle: 'Shelter beneath the apple trees', description: 'Walled orchards and small farms provide a dependable place to gather the next operation’s supplies.', decision: 'Capturing the Orchard adds 4 starting Supplies to future operations.' },
  windmill: { subtitle: 'Eyes above the countryside', description: 'The old mill commands a long view across the valley. Its vantage point offers a different advantage from the Orchard.', decision: 'Capturing the Windmill adds 2 starting Recon to future operations.' },
  village: { subtitle: 'Where the roads meet', description: 'Both approaches reach the village square. From here, the company can make for the Redoubt or take time to secure the Supply Depot.', decision: 'Choose the direct advance or the optional supply detour. A legal unclaimed route can still be revisited.' },
  depot: { subtitle: 'A worthwhile detour', description: 'Storehouses, wagons and packed provisions offer a stronger supply position for the road ahead.', decision: 'Capturing the Depot provides 8 starting Supplies, replacing the Orchard’s 4 rather than stacking.' },
  redoubt: { subtitle: 'The final approach', description: 'Earthworks guard the ascent to Saint-Aubin. Prepare the company carefully; taking this position opens the way to the fort.', decision: 'Choose a Prepared Assault or a Recon-heavy Flank Approach before this objective is activated.' },
  fort: { subtitle: 'Saint-Aubin on the horizon', description: 'The campaign’s final stronghold stands above the valley. Capture the Redoubt first, then prepare a shared final operation.', decision: 'Capturing Fort Saint-Aubin finishes this campaign. Your campaign history will remain.' },
};
const encounters = [
  { mark: 'I', title: 'The road gives way', text: 'Heavy rain has washed out the route. Scout a safer detour or help the engineers restore the crossing.' },
  { mark: 'II', title: 'A wagon in the mud', text: 'A stranded supply wagon needs help. Recover its load or conserve the company’s effort for the road ahead.' },
  { mark: 'III', title: 'The abandoned outpost', text: 'A shuttered post appears beyond the trees. Investigate the site or keep the expedition moving.' },
];

export default function CampaignMap({ completedKitchen, startedKitchen, openCamp, expedition, openOperation, motion, activity, actionPanel }: { completedKitchen: boolean; startedKitchen: boolean; openCamp: () => void; expedition?: MapExpedition; openOperation?: () => void; motion?: boolean; activity?: MapActivity[]; actionPanel?: ReactNode }) {
  const host = useRef<HTMLDivElement>(null); const controls = useRef<MapControls | null>(null);
  const [ready, setReady] = useState(false); const [failed, setFailed] = useState(false);
  const [pins, setPins] = useState<Record<string, { x: number; y: number }>>({});
  const [selected, setSelected] = useState(expedition?.operation?.nodeId || 'camp');
  const [zoom, setZoom] = useState(1), [localMotion, setLocalMotion] = useState(true), [reducedMotion, setReducedMotion] = useState(false), [showLabels, setShowLabels] = useState(true);
  const latest = useRef({ completedKitchen, startedKitchen, expedition, motion: motion ?? localMotion, selected }); latest.current = { completedKitchen, startedKitchen, expedition, motion: motion ?? localMotion, selected };
  const seenActivity = useRef(new Set<string>()), activityInitialized = useRef(false), mountedAt = useRef(Date.now());
  useEffect(() => {
    let active = true;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)'); const changed = () => setReducedMotion(preference.matches); changed(); preference.addEventListener('change', changed);
    import('../lib/campaignMapScene').then(({ createCampaignMap }) => {
      if (!active || !host.current) return;
      controls.current = createCampaignMap(host.current, { ...latest.current, edges: pilot.map.edges,
        onZoom: value => { if (active) setZoom(value); }, onPins: value => { if (active) setPins(value); }, onReady: () => { if (active) setReady(true); }, onFailure: () => { if (active) { setReady(false); setFailed(true); } } });
      controls.current.select(latest.current.selected);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; preference.removeEventListener('change', changed); controls.current?.dispose(); controls.current = null; };
  }, []);
  useEffect(() => { controls.current?.updateKitchen(completedKitchen, startedKitchen); }, [completedKitchen, startedKitchen]);
  useEffect(() => { controls.current?.updateExpedition(expedition); }, [expedition]);
  useEffect(() => { controls.current?.setMotion(motion ?? localMotion); }, [motion, localMotion]);
  useEffect(() => {
    if (!activity) return;
    for (const event of activity) { if (activityInitialized.current && !seenActivity.current.has(event.id) && Date.parse(event.at) >= mountedAt.current) controls.current?.react(event.kind, event.nodeId); seenActivity.current.add(event.id); }
    activityInitialized.current = true;
    // The backend feed is bounded. Retain a little extra history without an unbounded set.
    if (seenActivity.current.size > 600) seenActivity.current = new Set([...seenActivity.current].slice(-400));
  }, [activity]);
  const choose = (id: string) => { setSelected(id); controls.current?.select(id); };
  const location = locations.find(node => node.id === selected)!; const story = stories[selected];
  const planningScale = Math.max(pilot.population.minimum_scale, targets.expected_active_members / pilot.population.baseline);
  const successors = pilot.map.edges.filter(edge => edge[0] === selected).map(edge => locations.find(node => node.id === edge[1])!);
  const companyLocation = locations.find(node => node.id === expedition?.currentNode)?.name || 'Camp';
  const destination = expedition?.operation?.nodeId;
  const status = (id: string) => !expedition ? id === 'camp' ? 'Our camp' : 'Work in progress' : expedition.owned.includes(id) ? id === expedition.currentNode ? 'Company here' : 'Secured' : id === destination ? 'Active objective' : pilot.map.edges.some(([a, b]) => b === id && expedition.owned.includes(a)) ? 'Route available' : 'Beyond our reach';
  const statusClass = (id: string) => expedition?.owned.includes(id) ? 'secured' : id === destination ? 'active' : expedition && pilot.map.edges.some(([a, b]) => b === id && expedition.owned.includes(a)) ? 'available' : 'locked';
  return <div className="lc-map-view">
    <div className="lc-map-intro"><div><p className="qm-eyebrow">Follow the company across the valley</p><h3>Road to Saint-Aubin</h3><p>Eight locations. Branching roads. One company deciding the way forward.</p></div><span className="lc-wip"><FiTool /> Expansion &amp; final polish WIP</span></div>
    <div className="lc-company-status"><div><FiFlag /><span>Company position<strong>{companyLocation}</strong></span></div><div><FiNavigation /><span>{expedition?.victory ? 'Campaign complete' : 'Next objective'}<strong>{expedition?.victory ? 'Saint-Aubin secured' : expedition?.operation?.name || 'The road ahead'}</strong></span></div>{expedition?.operation && <button onClick={openOperation || (() => choose(destination!))}>Open operation <FiArrowRight /></button>}</div>
    <div className={`lc-map-frame ${(motion ?? localMotion) && !reducedMotion ? 'has-motion' : ''}`} tabIndex={0} role="group" aria-label="Interactive expedition map" aria-describedby="lc-map-help"><div className="lc-map-canvas" ref={host} role="img" aria-label={`Three-dimensional tabletop map. Company at ${companyLocation}. ${expedition?.operation ? `Active objective: ${expedition.operation.name}.` : ''} Inspect any location using its map pin or the list below.`} />
      {!ready && <div className="lc-map-fallback"><FiMap /><p>{failed ? 'The 3D map is unavailable on this device. Explore every location in the list below.' : 'Unfolding the expedition map…'}</p></div>}
      {ready && showLabels && <div className="lc-map-pins">{locations.map((node, index) => pins[node.id] && <button key={node.id} className={`lc-map-pin ${statusClass(node.id)} ${node.id === 'camp' ? 'home' : ''} ${selected === node.id ? 'selected' : ''} ${node.id === expedition?.currentNode ? 'company-here' : ''}`} style={{ left: pins[node.id].x, top: pins[node.id].y }} aria-label={`Inspect ${node.name}, ${status(node.id)}`} aria-pressed={selected === node.id} onClick={() => choose(node.id)}><b>{node.id === expedition?.currentNode ? <FiFlag /> : String(index + 1).padStart(2, '0')}</b><span>{node.name}<small>{status(node.id)}</small></span></button>)}</div>}
      <button className="lc-map-label-toggle" data-map-controls disabled={!ready} aria-pressed={showLabels} onClick={() => setShowLabels(value => !value)}>{showLabels ? 'Hide labels' : 'Show labels'}</button>
      <div className="lc-map-compass" aria-hidden="true"><FiCompass /><span>N</span></div><div className="lc-map-seal" aria-hidden="true">COLDSTREAM EXPEDITION<small>SECOND TO NONE</small></div>
      <div className="lc-map-controls" data-map-controls><button disabled={!ready} aria-label="Zoom out" onClick={() => controls.current?.zoom(-1)}><FiMinus /></button><output aria-label="Map zoom">{Math.round(zoom * 100)}%</output><button disabled={!ready} aria-label="Zoom in" onClick={() => controls.current?.zoom(1)}><FiPlus /></button><i /><button disabled={!ready} aria-label="Turn map left" onClick={() => controls.current?.turn(-1)}><FiArrowLeft /></button><button disabled={!ready} aria-label="Reset map view" onClick={() => controls.current?.reset()}>Reset</button><button disabled={!ready} aria-label="Turn map right" onClick={() => controls.current?.turn(1)}><FiArrowRight /></button>{motion === undefined && <button className="lc-motion-button" disabled={reducedMotion} aria-label={localMotion ? 'Pause map motion' : 'Resume map motion'} aria-pressed={!localMotion || reducedMotion} onClick={() => setLocalMotion(value => !value)}>{localMotion && !reducedMotion ? <FiPause /> : <FiPlay />}</button>}</div>
    </div>
    <div className="lc-map-help" id="lc-map-help"><span>Drag to explore · Scroll or pinch to zoom · Focus map: arrows, + / −, 0 to reset</span><span>{reducedMotion ? 'Reduced motion enabled' : (motion ?? localMotion) ? 'Living tabletop' : 'Motion paused'}</span></div>
    <div className="lc-route-legend" aria-label="Map legend"><span><i className="secured" /> Secured road</span><span><i className="active" /> Active advance</span><span><i className="available" /> Available route</span><span><i className="locked" /> Future road</span><span><FiFlag /> Company</span><span><i className="selection" /> Selected location</span></div>
    {actionPanel}
    <div className="lc-map-stage-note"><FiFlag /><p>{expedition ? <><strong>Operations are playable in this local preview.</strong> The standard marks our company; the gold ring marks its objective. Shared actions bring scouts, supplies and builders onto the board. Map expansion and final polish remain in progress.</> : <><strong>The Field Kitchen is working now.</strong> The other locations, operation choices, route ballots and encounters are a work in progress.</>} Inspecting a location does not start an operation or spend anything.</p></div>
    <div className="lc-map-details"><nav className="lc-location-list" aria-label="Campaign location list"><p className="qm-eyebrow">Explore the road</p>{locations.map((node, index) => <button key={node.id} aria-pressed={selected === node.id} onClick={() => choose(node.id)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{node.name}</strong><small>{status(node.id)}</small></button>)}</nav>
      <article className="lc-location-detail" aria-live="polite"><p className="qm-eyebrow">{story.subtitle}</p><h3>{location.name}</h3><p>{story.description}</p><div className="lc-route-choice"><FiCompass /><p>{selected === 'camp' && expedition ? 'Choose where your free orders help most: gather Materials or work on the current camp project.' : story.decision}</p></div>
        {destination === selected && <div className="lc-current-operation"><span><FiFlag /> Active operation · {expedition?.operation?.phaseName}</span>{openOperation && <button className="qm-button gold" onClick={openOperation}>Join the preparation <FiArrowRight /></button>}</div>}
        {location.plans && <><h4>Two plans to consider</h4><p className="lc-plan-note">Planning for {targets.expected_active_members} active members, with {targets.lower_turnout_members} as the lower turnout case. {expedition ? 'These preview requirements are per phase. Each operation has three phases; the active operation shows its frozen requirements and current progress.' : 'Scaled pilot requirements below are previews. Each target’s rules will be frozen when it opens.'}</p><div className="lc-plans">{Object.entries(location.plans).map(([id, plan]) => <div key={id}><strong>{id === 'prepared_assault' ? 'Prepared Assault' : 'Flank Approach'}</strong><dl><div><dt>Recon</dt><dd>{Math.ceil(plan.recon * planningScale)}</dd></div><div><dt>Supplies</dt><dd>{Math.ceil(plan.supplies * planningScale)}</dd></div><div><dt>Readiness</dt><dd>{Math.ceil(plan.readiness * planningScale)}</dd></div></dl></div>)}</div></>}
        {successors.length > 0 && <div className="lc-next-roads"><span>Roads onward</span>{successors.map(node => <button key={node.id} onClick={() => choose(node.id)}>{node.name} <FiArrowRight /></button>)}</div>}
        {selected === 'camp' && <><p className="lc-plan-note">Three facilities across the campaign: Field Kitchen, Engineer Workshop and Signal Post. {expedition ? 'Choose the next project together with one member, one vote.' : 'Future project choices will use one member, one vote.'}</p><button className="qm-button gold" onClick={openCamp}>{expedition ? 'Open our camp' : 'Help build our Field Kitchen'} <FiArrowRight /></button></>}
      </article></div>
    <section className="lc-encounters"><div><p className="qm-eyebrow">A little uncertainty on the road</p><h3>Encounters, not just checkpoints.</h3><p>{expedition ? 'The active operation brings roadside choices to the company. Open the operation to see the current encounter and its published effects. More encounter variety and final presentation are still in progress.' : 'Planned for Milestone 2: internal campaign encounters with choices for the company. Their terms will be revealed before the affected objective accepts funding. Completed preparation stays reliable.'}</p></div><span className="lc-wip">More encounters · work in progress</span>{!expedition && <div className="lc-encounter-cards">{encounters.map(item => <article key={item.mark}><b>{item.mark}</b><h4>{item.title}</h4><p>{item.text}</p><small>Concept only · mechanics still to be reviewed</small></article>)}</div>}</section>
    <p className="lc-journey-note">Pacing target, still unvalidated: designed for 4 to 5 active members and roughly a month. Actual pacing depends on participation and the route chosen. No forced daily attendance, automatic inactivity defeat, or fixed campaign expiry.</p>
  </div>;
}
