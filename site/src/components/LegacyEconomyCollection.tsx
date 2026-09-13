import { useEffect, useState } from 'react';
import { supa } from '../lib/supa';
import { equipEconomyItem, readEconomySelf, type EconomySnapshot } from '../lib/economy';

export default function LegacyEconomyCollection() {
  const [record, setRecord] = useState<EconomySnapshot | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { let live = true; if (supa) void readEconomySelf(supa).then(value => { if (live) setRecord(value); }).catch(() => { if (live) setMessage('Your earlier collection could not be loaded. Refresh to try again.'); }); return () => { live = false; }; }, []);
  return <details className="qm-panel qm-legacy"><summary>Your earlier collection and history</summary><p>Your earlier decorations remain yours. Your opening balance is carried into your Wallet automatically.</p><p role="status">{message}</p>
    {record && <><div className="qm-kit-grid">{record.inventory.map(item => <article className="qm-panel" key={item.item_slug}><h3>{item.display_name}</h3><p>{item.description}</p><button className="qm-button" disabled={busy || record.equipped.some(entry => entry.item_slug === item.item_slug)} onClick={async () => { if (!supa) return; setBusy(true); try { await equipEconomyItem(supa, item.item_slug, item.slot); setRecord(await readEconomySelf(supa)); setMessage('Decoration equipped.'); } catch { setMessage('That decoration could not be equipped. Please try again.'); } finally { setBusy(false); } }}>Equip decoration</button></article>)}</div>
      {!record.inventory.length && <p>No earlier decorations.</p>}
      {record.ledger.map(entry => <p key={entry.id}>{new Date(entry.created_at).toLocaleDateString()} · {entry.action_kind === 'daily' ? 'Daily issue' : entry.item_slug} · {entry.delta > 0 ? '+' : ''}{entry.delta} Shillings</p>)}
    </>}
  </details>;
}
