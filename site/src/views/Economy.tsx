import Quartermaster from './Quartermaster';
import ShillingCoin from '../components/ShillingCoin';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEMO, supa } from '../lib/supa';
import { claimEconomyDaily, createEconomyRequestKey, equipEconomyItem, purchaseEconomyItem, readEconomySelf, type EconomyActionResult, type EconomySnapshot, type EconomySlot } from '../lib/economy';
import '../economy.css';

const demoSnapshot: EconomySnapshot = {
  currency_display_name: 'Shillings', shop_display_name: "Quartermaster's Stores", balance: 120,
  catalogue: [{ slug: 'engraved-frame', display_name: 'Engraved Frame', description: 'A restrained brass frame for your member display.', slot: 'frame', price: 40, art_key: null }],
  inventory: [{ item_slug: 'engraved-frame', display_name: 'Engraved Frame', description: 'A restrained brass frame for your member display.', slot: 'frame', art_key: null, acquired_at: '2026-09-12T12:00:00Z' }],
  equipped: [{ slot: 'frame', item_slug: 'engraved-frame', equipped_at: '2026-09-12T12:00:00Z' }],
  ledger: [{ id: 2, delta: -40, resulting_balance: 120, action_kind: 'purchase', source_ref: 'demo', request_key: 'purchase:demo', item_slug: 'engraved-frame', period_start: null, created_at: '2026-09-12T12:00:00Z' }, { id: 1, delta: 10, resulting_balance: 160, action_kind: 'daily', source_ref: 'demo', request_key: 'daily:demo', item_slug: null, period_start: '2026-09-12', created_at: '2026-09-11T12:00:00Z' }],
};

type ActionState = { key: string; kind: 'daily' | 'purchase' | 'equip'; slug?: string; slot?: EconomySlot; status: 'pending' | 'unknown'; message: string } | null;
const slotLabel: Record<EconomySlot, string> = { frame: 'Frame', badge: 'Badge', backdrop: 'Backdrop' };
const knownFailure: Record<string, string> = {
  ECONOMY_DAILY_ALREADY_CLAIMED: 'You have already received today\'s daily issue.',
  ECONOMY_INSUFFICIENT_FUNDS: 'You do not have enough Shillings for that purchase.',
  ECONOMY_ITEM_ALREADY_OWNED: 'That decoration is already in your collection.',
  ECONOMY_ITEM_UNAVAILABLE: 'That decoration is not currently available.',
  ECONOMY_ITEM_NOT_OWNED: 'That decoration is not in your collection.',
  ECONOMY_SLOT_MISMATCH: 'That decoration does not fit this display slot.',
  ECONOMY_REQUEST_KEY_CONFLICT: 'That request could not be safely repeated. Please refresh Shillings.',
  ECONOMY_REQUEST_KEY_INVALID: 'That request was rejected. Please refresh Shillings and try again.',
};

export default function Economy({ demo = DEMO }: { demo?: boolean }) { return <Quartermaster demo={demo} />; }

export function LegacyEconomy({ demo = DEMO }: { demo?: boolean }) {
  const [snapshot, setSnapshot] = useState<EconomySnapshot | null>(demo ? demoSnapshot : null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionState>(null);
  const [notice, setNotice] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [hasOlderLedger, setHasOlderLedger] = useState(true);
  const requestKeys = useRef(new Map<string, string>());
  const [filter, setFilter] = useState<'all' | 'owned' | 'available'>('all');
  const load = useCallback(async () => { if (demo || !supa) return; setLoading(true); setError(null); try { setSnapshot(await readEconomySelf(supa)); } catch (e) { setError(e instanceof Error ? e.message : 'Shillings is unavailable.'); } finally { setLoading(false); } }, [demo]);
  useEffect(() => { void load(); }, [load]);
  const owned = useMemo(() => new Set(snapshot?.inventory.map((item) => item.item_slug)), [snapshot]);
  const visible = snapshot?.catalogue.filter((item) => filter === 'all' || filter === (owned.has(item.slug) ? 'owned' : 'available')) ?? [];
  const runAction = async (kind: 'daily' | 'purchase' | 'equip', slug?: string, slot?: EconomySlot) => {
    const id = `${kind}:${slug ?? 'daily'}`; const key = requestKeys.current.get(id) ?? (kind === 'equip' ? '' : createEconomyRequestKey(kind)); if (kind !== 'equip') requestKeys.current.set(id, key);
    setAction({ key, kind, slug, slot, status: 'pending', message: kind === 'daily' ? 'Claiming daily issue…' : kind === 'purchase' ? 'Processing purchase…' : 'Equipping item…' }); setNotice('');
    try {
      if (demo) { requestKeys.current.delete(id); setNotice(kind === 'daily' ? 'Daily issue claimed in local preview.' : kind === 'purchase' ? 'Purchase completed in local preview.' : 'Display case updated in local preview.'); setAction(null); return; }
      if (!supa) throw new Error('Shillings is unavailable.');
      let result: EconomyActionResult | unknown;
      if (kind === 'daily') result = await claimEconomyDaily(supa, key);
      else if (kind === 'purchase') result = await purchaseEconomyItem(supa, slug!, key);
      else result = await equipEconomyItem(supa, slug!, slot!);
      void result; requestKeys.current.delete(id); await load(); setNotice(kind === 'equip' ? 'Display case updated.' : 'Server state refreshed successfully.'); setAction(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      const definite = Object.entries(knownFailure).find(([code]) => message.includes(code))?.[1];
      if (definite) { requestKeys.current.delete(id); setNotice(definite); setAction(null); }
      else setAction({ key, kind, slug, slot, status: 'unknown', message: 'The result is unknown. Refresh your balance or retry with the same request.' });
      setError(null);
    }
  };
  const loadOlder = async () => {
    const ledgerBefore = snapshot?.ledger.at(-1)?.id;
    if (demo || !supa || !ledgerBefore) { setHasOlderLedger(false); setNotice('There are no older ledger entries.'); return; }
    setLedgerLoading(true); setNotice('');
    try {
      const next = await readEconomySelf(supa, { ledgerBefore, ledgerLimit: 20 });
      setSnapshot((current) => current ? { ...next, ledger: [...current.ledger, ...next.ledger.filter((entry) => !current.ledger.some((existing) => existing.id === entry.id))] } : next);
      setHasOlderLedger(next.ledger.length === 20);
      if (next.ledger.length === 0) setNotice('There are no older ledger entries.');
    } catch { setNotice('Older ledger entries could not be loaded. Your current balance is unchanged.'); }
    finally { setLedgerLoading(false); }
  };
  if (loading) return <main className="economy-page wrap solo" aria-busy="true"><p className="cg-eyebrow">Shillings</p><h1>Opening your account.</h1><p role="status">Loading your balance and collection…</p></main>;
  if (error && !snapshot) return <main className="economy-page wrap solo"><p className="cg-eyebrow">Shillings</p><h1>Shillings is unavailable.</h1><p role="alert">{error}</p><button className="hq-button" onClick={() => void load()}>Refresh Shillings</button></main>;
  if (!snapshot) return null;
  return <main className="economy-page wrap solo"><header className="economy-hero"><div><p className="cg-eyebrow">Member economy</p><h1>Shillings</h1><p className="page-sub">Your balance, collection and access to the Quartermaster's Stores.</p></div><ShillingCoin /><div className="economy-balance"><span>Your balance</span><strong>{snapshot.balance} <small>{snapshot.currency_display_name}</small></strong><button className="hq-button primary" disabled={action?.status === 'pending'} onClick={() => void runAction('daily')}>Claim daily issue</button></div></header>
    <div className="economy-status" role="status" aria-live="polite">{notice || action?.message || ''}{action?.status === 'unknown' && <button className="hq-button" onClick={() => void runAction(action.kind, action.slug, action.slot)}>Retry with the same request</button>}</div>
    <div className="economy-grid"><section className="economy-catalogue" aria-labelledby="catalogue-title"><div className="economy-section-head"><div><p className="cg-eyebrow">{snapshot.shop_display_name}</p><h2 id="catalogue-title">Available decorations</h2></div><label>Filter <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">All</option><option value="owned">Owned</option><option value="available">Available</option></select></label></div>{visible.length ? visible.map((item) => <article className="economy-card" key={item.slug}><div className="economy-art" aria-label={`${item.display_name} placeholder art`}>◇</div><div><h3>{item.display_name}</h3><p>{item.description}</p><strong>{item.price} {snapshot.currency_display_name}</strong><div className="economy-actions"><button className="hq-button" onClick={() => setNotice(`${item.display_name}: ${item.description}`)}>Inspect</button><button className="hq-button primary" disabled={owned.has(item.slug) || action?.status === 'pending'} onClick={() => void runAction('purchase', item.slug)}>{owned.has(item.slug) ? 'Owned' : 'Purchase'}</button></div></div></article>) : <p className="economy-empty">No catalogue items match this filter. New decorations will appear here when approved.</p>}</section>
      <aside className="economy-side"><section aria-labelledby="display-title"><p className="cg-eyebrow">Your display case</p><h2 id="display-title">Equipped profile slots</h2><div className="economy-slots">{(['frame', 'badge', 'backdrop'] as EconomySlot[]).map((slot) => { const item = snapshot.inventory.find((candidate) => candidate.slot === slot && snapshot.equipped.some((equipped) => equipped.slot === slot && equipped.item_slug === candidate.item_slug)); return <div className="economy-slot" key={slot}><span>{slotLabel[slot]}</span><strong>{item?.display_name ?? 'Empty'}</strong>{item && <button className="hq-button" disabled>Equipped</button>}</div>; })}</div></section><section aria-labelledby="collection-title"><p className="cg-eyebrow">Your collection</p><h2 id="collection-title">Owned decorations</h2>{snapshot.inventory.length ? <div className="economy-collection">{snapshot.inventory.map((item) => { const equipped = snapshot.equipped.some((entry) => entry.item_slug === item.item_slug && entry.slot === item.slot); return <article key={item.item_slug}><h3>{item.display_name}</h3><p>{slotLabel[item.slot]} slot</p><button className="hq-button" disabled={equipped || action?.status === 'pending'} onClick={() => void runAction('equip', item.item_slug, item.slot)}>{equipped ? 'Equipped' : 'Equip'}</button></article>; })}</div> : <p className="economy-empty">Your collection is empty. Claim a daily issue and visit the catalogue to begin.</p>}</section></aside></div>
    <section className="economy-ledger" aria-labelledby="ledger-title"><div className="economy-section-head"><div><p className="cg-eyebrow">The ledger</p><h2 id="ledger-title">Every change accounted for</h2></div><button className="hq-button" disabled={ledgerLoading || !hasOlderLedger || snapshot.ledger.length === 0} onClick={() => void loadOlder()}>{ledgerLoading ? 'Loading…' : hasOlderLedger ? 'Load older entries' : 'Ledger complete'}</button></div><div className="economy-ledger-list">{snapshot.ledger.length ? snapshot.ledger.map((entry) => <div className="economy-ledger-row" key={entry.id}><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time><span>{entry.action_kind === 'daily' ? 'Daily issue' : entry.item_slug ?? 'Purchase'}</span><strong className={entry.delta > 0 ? 'positive' : ''}>{entry.delta > 0 ? '+' : ''}{entry.delta}</strong><span>Bal. {entry.resulting_balance}</span></div>) : <p className="economy-empty">Your ledger will explain each reward and purchase here.</p>}</div></section>
  </main>;
}
