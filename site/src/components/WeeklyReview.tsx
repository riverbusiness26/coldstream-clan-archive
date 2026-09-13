import { useEffect, useState } from 'react';
import { weeklyMediaItems } from '../lib/weeklyMedia';
import { youtubeEmbed, youtubeId } from '../lib/gallery';

interface Submission {
  id: string; submitter_id: string; title: string; description: string | null;
  url: string; provider: string; status: string; submitted_at: string;
}
interface Props {
  submissions: Submission[];
  memberName: (id: string) => string;
  busy: boolean; loading: boolean; error?: string;
  onRefresh: () => void;
  onReview: (id: string, status: 'approved' | 'rejected' | 'archived') => void;
  onPublish: () => void;
}
const label = (status: string) => ({ pending: 'Needs review', approved: 'Approved', archived: 'Archived' }[status] ?? status);
const timestamp = (value: string) => new Date(value).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

export default function WeeklyReview({ submissions, memberName, busy, loading, error, onRefresh, onReview, onPublish }: Props) {
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const rows = submissions.filter((row) => row.status !== 'rejected' && (filter === 'all' || row.status === filter))
    .filter((row) => `${row.title} ${memberName(row.submitter_id)} ${row.description ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at));
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
  const media = selected ? weeklyMediaItems([selected], youtubeId)[0] : null;
  useEffect(() => { setConfirmReject(false); setPreviewFailed(false); }, [selected?.id]);

  return <section className="weekly-review" aria-label="Weekly content review">
    <div className="weekly-review-toolbar">
      <div role="group" aria-label="Filter weekly submissions">{['pending', 'approved', 'archived', 'all'].map((status) => <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)}>{status === 'all' ? 'All content' : label(status)} <small>{submissions.filter((row) => row.status !== 'rejected' && (status === 'all' || row.status === status)).length}</small></button>)}</div>
      <label>Find content<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title or member name" /></label>
    </div>
    {error ? <div role="alert" className="command-empty">Weekly content could not be loaded. {error} <button disabled={busy || loading} onClick={onRefresh}>Retry</button></div> : loading && !submissions.length ? <p role="status" className="command-empty">Loading weekly submissions…</p> : <div className="weekly-review-columns">
      <aside className="weekly-review-inbox" aria-label="Weekly submissions">
        <header><b>{rows.length} {rows.length === 1 ? 'submission' : 'submissions'}</b><span>Newest first</span></header>
        {!rows.length && <p className="command-empty">No content matches this view. Try another status or clear your search.</p>}
        {rows.map((row) => <button type="button" key={row.id} aria-pressed={selected?.id === row.id} onClick={() => setSelectedId(row.id)}>
          <span className="weekly-review-status">{label(row.status)}</span><strong>{row.title || 'Community highlight'}</strong>
          <span>{memberName(row.submitter_id)}</span><small>{timestamp(row.submitted_at)}</small>
        </button>)}
      </aside>
      {selected ? <article className="weekly-review-detail">
        <header><span className="weekly-review-status">{label(selected.status)} · {selected.provider}</span><h2>{selected.title || 'Community highlight'}</h2><p>Submitted by <b>{memberName(selected.submitter_id)}</b> · {timestamp(selected.submitted_at)}</p></header>
        <div className="weekly-review-preview" key={selected.id}>
          {previewFailed || !media || media.type === 'link' ? <p>Embedded preview unavailable. Use Open original below to inspect this submission.</p>
            : media.type === 'youtube' ? <iframe title={`Preview: ${selected.title}`} src={youtubeEmbed(media.src)} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            : media.type === 'image' ? <img src={media.src} alt={selected.title} onError={() => setPreviewFailed(true)} />
            : <video src={media.src} controls preload="metadata" playsInline onError={() => setPreviewFailed(true)} />}
        </div>
        {media && <a className="weekly-original" href={selected.url} target="_blank" rel="noopener noreferrer">Open original in a new tab ↗</a>}
        <section className="weekly-review-description"><h3>Member’s description</h3><p>{selected.description || 'No description was included.'}</p></section>
        <footer>
          {selected.status === 'pending' ? <><p>Accepting publishes this content to the homepage rotation immediately. Review the media first.</p><div className="weekly-review-actions"><button className="command-primary" type="button" disabled={busy || !media} onClick={() => onReview(selected.id, 'approved')}>{busy ? 'Working…' : 'Accept and publish'}</button><button className="command-secondary" type="button" disabled={busy} onClick={() => setConfirmReject(true)}>Reject submission</button></div>
            {confirmReject && <div className="weekly-reject-confirm" role="alert"><p>Reject and permanently remove this submission from the queue?</p><button className="command-danger" type="button" disabled={busy} onClick={() => onReview(selected.id, 'rejected')}>Confirm rejection</button><button className="command-secondary" type="button" disabled={busy} onClick={() => setConfirmReject(false)}>Keep reviewing</button></div>}</>
            : selected.status === 'approved' ? <><p>Approved content takes priority over archive placeholders. Use retry if publication previously failed.</p><div className="weekly-review-actions"><button className="command-secondary" disabled={busy} onClick={onPublish}>Retry publication</button><button className="command-secondary" disabled={busy} onClick={() => onReview(selected.id, 'archived')}>Archive from rotation</button></div></>
            : <p>This submission is archived and no longer appears in the weekly rotation.</p>}
        </footer>
      </article> : <div className="weekly-review-detail"><h2>No submission selected</h2><p>Choose content from the inbox to watch it and review the member’s details.</p></div>}
    </div>}
  </section>;
}
