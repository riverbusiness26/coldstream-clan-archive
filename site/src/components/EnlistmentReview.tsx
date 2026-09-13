import { useEffect, useMemo, useState } from 'react';
import { FaClipboardCheck, FaDiscord, FaMapMarkerAlt, FaUserPlus } from 'react-icons/fa';
import type { EnlistmentDecision } from '../lib/enlistmentAdmin';

export interface EnlistmentAnswers {
  age?: number | string;
  holdfast_name?: string;
  region?: string;
  found_us?: string;
  leadership_interest?: string;
}

export interface EnlistmentRow {
  id: string;
  member_id: string | null;
  display_name: string;
  body: string;
  created_at: string;
  answers: EnlistmentAnswers | null;
  status: 'pending' | 'accepted' | 'denied' | 'withdrawn';
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  discord_id: string | null;
  discord_username: string | null;
  guild_id: string | null;
  discord_status: 'not_synced' | 'queued' | 'complete' | 'error' | null;
  discord_last_error: string | null;
  discord_processed_at: string | null;
}

interface Props {
  applications: EnlistmentRow[];
  busy: boolean;
  loading: boolean;
  error?: string;
  onRefresh: () => void;
  onReview: (id: string, decision: EnlistmentDecision, reason: string) => void;
}

const dateTime = (value: string) => new Date(value).toLocaleString(undefined, {
  year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

const answer = (row: EnlistmentRow, key: keyof EnlistmentAnswers, fallback = 'Not answered') => {
  const value = row.answers?.[key];
  return value === undefined || value === null || String(value).trim() === '' ? fallback : String(value);
};

export default function EnlistmentReview({ applications, busy, loading, error, onRefresh, onReview }: Props) {
  const [filter, setFilter] = useState<'pending' | 'accepted' | 'denied' | 'all'>('pending');
  const [order, setOrder] = useState<'oldest' | 'newest'>('oldest');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [denialOpen, setDenialOpen] = useState(false);
  const [reason, setReason] = useState('');
  const visible = useMemo(() => applications
    .filter((row) => filter === 'all' || row.status === filter)
    .filter((row) => !search.trim() || `${row.display_name} ${row.discord_username ?? ''} ${row.discord_id ?? ''} ${answer(row, 'region', '')}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (order === 'oldest' ? 1 : -1) * (Date.parse(a.created_at) - Date.parse(b.created_at))), [applications, filter, order, search]);
  const selected = visible.find((row) => row.id === selectedId) ?? visible[0] ?? null;
  const pending = applications.filter((row) => row.status === 'pending').length;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
    if (!selected) setSelectedId(null);
  }, [selected?.id, selectedId]);
  useEffect(() => { setDenialOpen(false); setReason(''); }, [selected?.id]);

  return <section className="enlistment-review-shell">
    <div className="enlistment-review-toolbar">
      <label>Find an applicant<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Holdfast name, Discord name, or region" /></label>
      <label>Status<select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="pending">Needs review</option><option value="accepted">Accepted</option><option value="denied">Denied</option><option value="all">All applications</option></select></label>
      <label>Order<select value={order} onChange={(event) => setOrder(event.target.value as typeof order)}><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select></label>
      <span>{pending} waiting</span>
    </div>
    {error && <div className="command-message error" role="alert"><b>Applications could not be refreshed.</b><p>{error}</p><button onClick={onRefresh}>Retry</button></div>}
    <div className="enlistment-review-columns">
      <aside className="enlistment-applicant-list" aria-label="Regiment applications">
        <header><b>Applicants</b><span>{visible.length} shown</span></header>
        {loading && !applications.length && <p className="command-empty">Loading applications.</p>}
        {!loading && !visible.length && <p className="command-empty">No applications match this view.</p>}
        {visible.map((row) => <button type="button" key={row.id} className={selected?.id === row.id ? 'selected' : ''} aria-pressed={selected?.id === row.id} onClick={() => setSelectedId(row.id)}>
          <span><FaUserPlus /><b>{answer(row, 'holdfast_name', row.display_name)}</b></span>
          <small>{row.discord_username ? `@${row.discord_username}` : row.discord_id ? `Discord ${row.discord_id}` : 'Legacy website application'}</small>
          <span><em>{answer(row, 'region')}</em><time>{dateTime(row.created_at)}</time></span>
          <strong className={`enlistment-status enlistment-status-${row.status}`}>{row.status === 'pending' ? 'Needs review' : row.status}</strong>
        </button>)}
      </aside>
      {selected ? <article className="enlistment-application-detail">
        <header>
          <div><span className="staff-overline">2nd Coldstream Guard application</span><h2>{answer(selected, 'holdfast_name', selected.display_name)}</h2><p>Submitted {dateTime(selected.created_at)}</p></div>
          <strong className={`enlistment-status enlistment-status-${selected.status}`}>{selected.status === 'pending' ? 'Needs review' : selected.status}</strong>
        </header>
        <div className="enlistment-identity-strip"><span><FaDiscord /><small>Discord</small><b>{selected.discord_username ? `@${selected.discord_username}` : selected.discord_id ?? 'Not linked'}</b></span><span><FaMapMarkerAlt /><small>Region</small><b>{answer(selected, 'region')}</b></span><span><FaClipboardCheck /><small>Age check</small><b>{answer(selected, 'age')}</b></span></div>
        <dl className="enlistment-answer-list">
          <div><dt>How old are you?</dt><dd>{answer(selected, 'age')}</dd></div>
          <div><dt>What is your name in Holdfast?</dt><dd>{answer(selected, 'holdfast_name', selected.display_name)}</dd></div>
          <div><dt>What region are you in?</dt><dd>{answer(selected, 'region')}</dd></div>
          <div><dt>How did you find us?</dt><dd>{answer(selected, 'found_us')}</dd></div>
          <div><dt>Interested in a leadership position later on?</dt><dd>{answer(selected, 'leadership_interest')}</dd></div>
        </dl>
        {selected.status === 'pending' ? <footer className="enlistment-decision-panel">
          <p>Accepting queues the `2nd Coldstream Guard` and `Volunteer` roles, the `[2ndCS] Vol.` nickname, and a private confirmation. A denial must include the reason sent to the applicant.</p>
          {!denialOpen ? <div><button className="command-primary" disabled={busy} onClick={() => onReview(selected.id, 'accepted', '')}>Accept application</button><button className="command-secondary" disabled={busy} onClick={() => setDenialOpen(true)}>Deny application</button></div> : <div className="enlistment-denial-form"><label>Reason sent privately<textarea value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Write the clear staff reason this applicant should receive." /></label><div><button className="command-danger" disabled={busy || !reason.trim()} onClick={() => onReview(selected.id, 'denied', reason)}>Send denial</button><button className="command-secondary" disabled={busy} onClick={() => { setDenialOpen(false); setReason(''); }}>Cancel</button></div></div>}
        </footer> : <footer className="enlistment-decision-panel reviewed"><p><b>Reviewed {selected.reviewed_at ? dateTime(selected.reviewed_at) : 'by staff'}.</b>{selected.review_note ? ` Reason: ${selected.review_note}` : ''}</p><p>Discord delivery: <strong>{selected.discord_status?.replaceAll('_', ' ') || 'not recorded'}</strong>{selected.discord_processed_at ? ` on ${dateTime(selected.discord_processed_at)}` : ''}.</p>{selected.discord_last_error && <p className="enlistment-delivery-warning">{selected.discord_last_error}</p>}</footer>}
      </article> : <div className="enlistment-application-detail enlistment-empty"><FaUserPlus /><h2>The application inbox is clear</h2><p>New 2nd Coldstream Guard applications will appear here after they are submitted in Discord.</p></div>}
    </div>
  </section>;
}
