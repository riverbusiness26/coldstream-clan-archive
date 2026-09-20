import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO } from '../lib/supa';
import { loadJukebox, musicUrl, saveMusic, uploadMusic, validateMusic, type JukeboxTrack } from '../lib/jukebox';
import '../jukebox-admin.css';

function TrackEditor({ track, changed }: { track: JukeboxTrack; changed: () => Promise<void> }) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [order, setOrder] = useState(track.sort_order);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState('');
  useEffect(() => { setTitle(track.title); setArtist(track.artist); setOrder(track.sort_order); }, [track.title, track.artist, track.sort_order]);
  async function save(published: boolean) {
    setBusy(true); setMessage('');
    try {
      await saveMusic({ ...track, title, artist, sort_order: order, published });
      setMessage(published ? 'Published to the jukebox.' : 'Saved as a draft. Members cannot play it.');
      await changed();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The track could not be saved.'); }
    finally { setBusy(false); }
  }
  return <article className="jukebox-admin-track" aria-label={track.title}>
    <header><strong>{track.title}</strong><span>{track.published ? 'Published' : 'Draft'}</span></header>
    <div className="jukebox-admin-fields">
      <label>Title<input value={title} maxLength={120} onChange={e => setTitle(e.target.value)} disabled={busy}/></label>
      <label>Artist <small>(optional)</small><input value={artist} maxLength={120} onChange={e => setArtist(e.target.value)} disabled={busy}/></label>
      <label>Play order<input type="number" min={0} max={9999} step={1} value={order} onChange={e => setOrder(Number(e.target.value))} disabled={busy}/></label>
    </div>
    <div className="jukebox-admin-actions">
      <button type="button" disabled={busy || !title.trim()} onClick={() => void save(track.published)}>Save changes</button>
      <button type="button" disabled={busy || !title.trim()} onClick={() => void save(!track.published)}>{track.published ? 'Unpublish' : 'Publish to jukebox'}</button>
      <button type="button" disabled={busy} onClick={async () => {
        setBusy(true); setMessage('');
        try { setPreview(await musicUrl(track)); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Preview unavailable.'); }
        finally { setBusy(false); }
      }}>Load audio preview</button>
    </div>
    {preview && <audio controls src={preview} preload="metadata" aria-label={`Preview ${track.title}`}/>}
    {message && <p role="status">{message}</p>}
  </article>;
}

export default function JukeboxAdmin({ role }: { role: string | undefined }) {
  const [tracks, setTracks] = useState<JukeboxTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    if (role !== 'admin') return;
    setLoading(true); setError('');
    try { setTracks(await loadJukebox(true)); }
    catch (error) { setError(error instanceof Error ? error.message : 'The playlist could not load.'); }
    finally { setLoading(false); }
  }, [role]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (role !== 'admin') return <section className="jukebox-admin"><h1>Admin access required</h1><p>Only admins can upload or publish jukebox music.</p></section>;
  return <section className="jukebox-admin" aria-labelledby="jukebox-admin-title">
    <header><div><p className="hq-eyebrow">Shillings</p><h1 id="jukebox-admin-title">Jukebox music</h1><p>Upload a track, listen to the draft, then publish it for members.</p></div><button onClick={() => void refresh()} disabled={loading || busy}>Refresh playlist</button></header>
    {DEMO && <p className="jukebox-admin-notice" role="status">Local layout preview. Uploads and publishing are disabled until the website database is connected.</p>}
    <form onSubmit={async e => {
      e.preventDefault(); if (!file || busy) return;
      setBusy(true); setMessage(''); setError('');
      try {
        await uploadMusic(file, title, artist);
        setFile(null); setTitle(''); setArtist(''); if (input.current) input.current.value = '';
        setMessage('Uploaded as a draft. Preview it below, then choose Publish to jukebox.');
        await refresh();
      } catch (error) { setError(error instanceof Error ? error.message : 'Upload failed. Please retry.'); }
      finally { setBusy(false); }
    }}>
      <h2>Add music</h2>
      <div className="jukebox-admin-fields">
        <label>Audio file<input ref={input} type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/x-wav,.mp3,.m4a,.ogg,.wav" disabled={busy || DEMO} onChange={e => {
          const selected = e.target.files?.[0]; setFile(null); setError('');
          if (!selected) return;
          try { validateMusic(selected); setFile(selected); if (!title) setTitle(selected.name.replace(/\.[^.]+$/, '').slice(0,120)); }
          catch (error) { setError(error instanceof Error ? error.message : 'Unsupported audio file.'); e.target.value = ''; }
        }}/></label>
        <label>Track title<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} disabled={busy || DEMO}/></label>
        <label>Artist <small>(optional)</small><input maxLength={120} value={artist} onChange={e => setArtist(e.target.value)} disabled={busy || DEMO}/></label>
      </div>
      <p>MP3, M4A, Ogg or WAV, up to 25 MB per track. Only upload music you have permission to share. Members cannot upload files.</p>
      <button type="submit" disabled={busy || DEMO || !file || !title.trim()}>{busy ? 'Uploading, please wait' : 'Upload as draft'}</button>
    </form>
    {error && <p role="alert" className="jukebox-admin-notice">{error}</p>}
    {message && <p role="status">{message}</p>}
    <h2>Playlist <small>({tracks.length})</small></h2><p>Lower play-order numbers go first. Unpublish keeps the file here but removes it from member playlists.</p>
    {loading && <p role="status">Loading tracks...</p>}
    {!loading && !tracks.length && !error && <p>No tracks uploaded yet.</p>}
    {tracks.map(track => <TrackEditor key={track.id} track={track} changed={refresh}/>)}
  </section>;
}
