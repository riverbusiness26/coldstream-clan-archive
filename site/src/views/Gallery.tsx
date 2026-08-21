// The gallery. Two halves that are deliberately kept apart.
//
// "From the Archives" is the recovered material: screenshots pulled back off
// Photobucket and imgur before the links died for good. Every one of them
// carries its date, the names legible in it, and the address it came from,
// because the whole point of the archive is that you can check it.
//
// "Member Uploads" is the live half: anything a signed-in member adds. Those
// land unapproved and a moderator clears them, so the two can never be
// confused for each other.
import { useCallback, useEffect, useState } from 'react';
import { supa } from '../lib/supa';
import type { Me } from '../lib/auth';
import SteamButton from '../components/SteamButton';
import { one } from '../lib/rel';
import shotsSeed from '../seed/gallery.json';
import { compressImage, compressToDataUrl } from '../lib/image';
import { demoGallery } from '../lib/demoGallery';
import { asset } from '../lib/asset';
import { CATEGORIES, categoryBySlug, youtubeId, youtubeThumb, youtubeWatch } from '../lib/gallery';

interface Shot {
  src: string;
  w: number;
  h: number;
  caption: string;
  date: string | null;
  year: number | null;
  game: string;
  who: string[];
  source: string;
}

interface Upload {
  id: string;
  storage_key: string | null;
  category_id: string | null;
  category_slug?: string | null;
  media_type: 'image' | 'video';
  video_id: string | null;
  caption: string | null;
  game: string | null;
  year: number | null;
  approved: boolean;
  created_at: string;
  uploader?: { display_name: string } | { display_name: string }[] | null;
}

const SHOTS = shotsSeed as Shot[];
const BUCKET = 'gallery';
const MAX_BYTES = 8 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

// Dates arrive as YYYY-MM-DD or YYYY-MM depending on whether the original
// filename carried a day. Render only as much as we actually know.
function shownDate(d: string | null) {
  if (!d) return 'date unknown';
  const [y, m, day] = d.split('-');
  const month = MONTHS[Number(m) - 1] ?? '';
  return day ? `${Number(day)} ${month} ${y}` : `${month} ${y}`;
}

function host(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'unknown source'; }
}

export default function Gallery({ me, signIn }: { me: Me | null; signIn: () => void }) {
  const [light, setLight] = useState<Shot | null>(null);
  const [uploads, setUploads] = useState<Upload[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [game, setGame] = useState('');
  const [cat, setCat] = useState<string>(CATEGORIES[0].slug);
  const [browse, setBrowse] = useState<string>('all');
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [videoUrl, setVideoUrl] = useState('');
  const [catIds, setCatIds] = useState<Record<string, string>>({});
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const loadUploads = useCallback(() => {
    if (!supa) { setUploads(demoGallery.list() as unknown as Upload[]); return; }
    supa
      .from('gallery_item')
      .select('*, uploader:member(display_name)')
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data }) => setUploads((data ?? []) as Upload[]));
  }, []);

  useEffect(() => { loadUploads(); }, [loadUploads]);

  // Slug to id, so an insert can name a category the database recognises.
  // Demo mode has no ids and does not need them.
  useEffect(() => {
    if (!supa) return;
    supa.from('gallery_category').select('id, slug').then(({ data }) => {
      if (!data) return;
      setCatIds(Object.fromEntries((data as { id: string; slug: string }[]).map((c) => [c.slug, c.id])));
    });
  }, []);

  const catId = (slug: string): string | null => catIds[slug] ?? null;
  const categorySlugById = (id: string | null): string | null => {
    if (!id) return null;
    const hit = Object.entries(catIds).find(([, v]) => v === id);
    return hit ? hit[0] : null;
  };

  // Escape closes the lightbox, same as clicking the backdrop.
  useEffect(() => {
    if (!light) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLight(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [light]);

  const publicUrl = (k: string | null) =>
    !k ? '' : k.startsWith('data:') ? k : supa ? supa.storage.from(BUCKET).getPublicUrl(k).data.publicUrl : '';

  // The thumbnail for any item, whichever kind it is.
  const thumbOf = (u: Upload) =>
    u.media_type === 'video' && u.video_id ? youtubeThumb(u.video_id) : publicUrl(u.storage_key);
  const linkOf = (u: Upload) =>
    u.media_type === 'video' && u.video_id ? youtubeWatch(u.video_id) : publicUrl(u.storage_key);

  function pick(f: File | null) {
    setFormError(null);
    setDone(null);
    if (!f) { setFile(null); return; }
    if (!OK_TYPES.includes(f.type)) {
      setFormError('That file is not an image. JPG, PNG, WEBP and GIF work.');
      setFile(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setFormError(`That image is ${(f.size / 1048576).toFixed(1)} MB. The limit is 8 MB.`);
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function upload() {
    setFormError(null);
    if (!me) return;

    const chosen = categoryBySlug(cat);
    if (!chosen) { setFormError('Pick a category.'); return; }
    if (chosen.locked) { setFormError('That category is a record, not a noticeboard. Pick another.'); return; }
    if (chosen.accepts !== 'both' && chosen.accepts !== mode) {
      setFormError(`${chosen.name} only takes ${chosen.accepts === 'video' ? 'videos' : 'images'}.`);
      return;
    }

    if (mode === 'video') {
      const vid = youtubeId(videoUrl);
      if (!vid) { setFormError('That does not look like a YouTube link. Paste the address from the browser bar.'); return; }
      const yr2 = year.trim() ? Number(year.trim()) : null;
      setBusy(true);
      try {
        if (!supa) {
          setDone('Video submitted to the demo store. A moderator clears it and then it shows for everyone.');
        } else {
          const { error } = await supa.from('gallery_item').insert({
            uploader_id: me.id,
            media_type: 'video',
            video_id: vid,
            storage_key: null,
            category_id: catId(cat),
            caption: caption.trim() || null,
            game: game.trim() || null,
            year: yr2,
          });
          if (error) { setFormError(error.message); return; }
          setDone('Video submitted. A moderator clears it and then it shows up here for everyone.');
        }
        setVideoUrl(''); setCaption(''); setGame(''); setYear('');
        loadUploads();
      } finally { setBusy(false); }
      return;
    }

    if (!file) { setFormError('Choose an image first.'); return; }

    const yr = year.trim() ? Number(year.trim()) : null;
    if (yr !== null && (!Number.isInteger(yr) || yr < 2011 || yr > new Date().getFullYear())) {
      setFormError(`The year should be between 2011 and ${new Date().getFullYear()}, or left blank.`);
      return;
    }

    if (!supa) {
      setBusy(true);
      try {
        const dataUrl = await compressToDataUrl(file);
        const res = demoGallery.add(dataUrl, caption.trim() || null, game.trim() || null, yr, me.display_name);
        if (!res.ok) { setFormError(res.reason); return; }
        setFile(null); setCaption(''); setGame(''); setYear('');
        setDone('Uploaded to the demo store. A moderator clears it and then it shows for everyone.');
        loadUploads();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'That image could not be read.');
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    const squeezed = await compressImage(file);
    const key = `${me.id}/${crypto.randomUUID()}.${squeezed.ext}`;

    const up = await supa.storage.from(BUCKET).upload(key, squeezed.blob, {
      cacheControl: '31536000',
      contentType: squeezed.type,
    });
    if (up.error) {
      setBusy(false);
      setFormError(
        /bucket/i.test(up.error.message)
          ? 'The upload store is not set up yet. An admin needs to create the gallery bucket.'
          : up.error.message,
      );
      return;
    }

    const { error } = await supa.from('gallery_item').insert({
      uploader_id: me.id,
      storage_key: key,
      media_type: 'image',
      category_id: catId(cat),
      caption: caption.trim() || null,
      game: game.trim() || null,
      year: yr,
    });
    setBusy(false);
    if (error) { setFormError(error.message); return; }

    setFile(null); setCaption(''); setGame(''); setYear('');
    setDone('Uploaded. A moderator clears it and then it shows up here for everyone.');
    loadUploads();
  }

  const inBrowse = (u: Upload) =>
    browse === 'all' || (u.category_slug ?? categorySlugById(u.category_id)) === browse;
  const mine = uploads?.filter((u) => !u.approved) ?? [];
  const live = (uploads?.filter((u) => u.approved) ?? []).filter(inBrowse);
  const canModerate = me?.role === 'moderator' || me?.role === 'admin';

  async function approve(id: string) {
    if (!supa) { demoGallery.approve(id); loadUploads(); return; }
    await supa.from('gallery_item').update({ approved: true }).eq('id', id);
    loadUploads();
  }
  async function reject(id: string, key: string | null) {
    if (!supa) { demoGallery.remove(id); loadUploads(); return; }
    await supa.from('gallery_item').delete().eq('id', id);
    if (key) await supa.storage.from(BUCKET).remove([key]);
    loadUploads();
  }

  return (
    <div className="wrap solo">
      <main>
        <div className="module">
          <div className="mhead">
            <h3>From the Archives</h3>
            <span className="sub">{SHOTS.length} screenshots recovered before the links died</span>
          </div>
          <div className="note">
            These came off Photobucket and imgur, where most of them were one
            outage away from being gone. Open any of them for the date, the
            names still legible in the shot, and the address it was pulled from.
          </div>
          <div className="gal-grid">
            {SHOTS.map((s) => (
              <button className="shotbtn" key={s.src} onClick={() => setLight(s)}
                aria-label={`Open: ${s.caption}`}>
                <img src={asset(s.src)} alt={s.caption} loading="lazy" width={s.w} height={s.h} />
                <span className="shotyear">{s.date ? s.date.slice(0, 4) : 'undated'}</span>
                {s.who.length > 0 && <span className="shotwho">{s.who.length} {s.who.length === 1 ? "name" : "names"}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="module">
          <div className="mhead">
            <h3>Member Uploads</h3>
            <span className="sub">{live.length} in {browse === 'all' ? 'all categories' : categoryBySlug(browse)?.name}</span>
          </div>
          <div className="chips">
            <button className={'chip' + (browse === 'all' ? ' on' : '')}
              onClick={() => setBrowse('all')}>Everything</button>
            {CATEGORIES.filter((c) => !c.locked).map((c) => (
              <button key={c.slug} className={'chip' + (browse === c.slug ? ' on' : '')}
                onClick={() => setBrowse(c.slug)}>{c.name}</button>
            ))}
          </div>
          {browse !== 'all' && (
            <div className="note">{categoryBySlug(browse)?.description}</div>
          )}

          {!me && (
            <div className="compose">
              <div className="note" style={{ padding: 0 }}>
                Sign in through Steam to add your own screenshots. Anything you
                still have from back then belongs up here.
              </div>
              <SteamButton me={me} signIn={signIn} />
            </div>
          )}

          {me && (
            <div className="compose">
              <div className="seg">
                <button className={'segbtn' + (mode === 'image' ? ' on' : '')}
                  onClick={() => { setMode('image'); setFormError(null); }}>Screenshot</button>
                <button className={'segbtn' + (mode === 'video' ? ' on' : '')}
                  onClick={() => { setMode('video'); setFormError(null); }}>Video</button>
              </div>
              <select className="inp" value={cat} onChange={(e) => { setCat(e.target.value); setFormError(null); }}>
                {CATEGORIES.filter((c) => !c.locked)
                  .filter((c) => c.accepts === 'both' || c.accepts === mode)
                  .map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
              {mode === 'video' ? (
                <input className="inp" placeholder="Paste a YouTube link"
                  value={videoUrl} onChange={(e) => { setVideoUrl(e.target.value); setFormError(null); }} />
              ) : (
                <input className="inp" type="file" accept="image/*"
                  onChange={(e) => pick(e.target.files?.[0] ?? null)} />
              )}
              <input className="inp" placeholder="What is happening in it?" value={caption}
                onChange={(e) => setCaption(e.target.value)} maxLength={200} />
              <div className="fieldrow">
                <input className="inp" placeholder="Game" value={game}
                  onChange={(e) => setGame(e.target.value)} maxLength={60} />
                <input className="inp" placeholder="Year" value={year} inputMode="numeric"
                  onChange={(e) => setYear(e.target.value)} maxLength={4} />
              </div>
              {formError && <div className="ferr">{formError}</div>}
              {done && <div className="fok">{done}</div>}
              <button className="btn primary sm" onClick={upload}
                disabled={busy || (mode === 'image' ? !file : !videoUrl.trim())}>
                {busy ? (mode === 'video' ? 'Submitting' : 'Uploading') : (mode === 'video' ? 'Submit video' : 'Upload')}
              </button>
            </div>
          )}

          {uploads === null && <div className="note">Loading.</div>}
          {uploads?.length === 0 && (
            <div className="note">
              Nothing uploaded yet. The archive half above is what survived on
              its own, so this half is up to us.
            </div>
          )}

          {live.length > 0 && (
            <div className="gal-grid">
              {live.map((u) => (
                <a className="shotbtn" key={u.id} href={linkOf(u)}
                  target="_blank" rel="noopener">
                  <img src={thumbOf(u)} alt={u.caption ?? ''} loading="lazy" />
                  {u.media_type === 'video' && <span className="playmark" aria-hidden="true" />}
                  {u.year && <span className="shotyear">{u.year}</span>}
                  <span className="shotwho">{one(u.uploader)?.display_name ?? 'member'}</span>
                </a>
              ))}
            </div>
          )}

          {mine.length > 0 && (
            <>
              <div className="note"><b>Waiting on a moderator</b> ({mine.length})</div>
              <div className="gal-grid pending">
                {mine.map((u) => (
                  <div className="shotbtn" key={u.id}>
                    <img src={thumbOf(u)} alt={u.caption ?? ''} loading="lazy" />
                    {u.media_type === 'video' && <span className="playmark" aria-hidden="true" />}
                    <span className="shotyear">held</span>
                    {canModerate && (
                      <span className="modrow">
                        <button className="btn sm" onClick={() => approve(u.id)}>Approve</button>
                        <button className="btn sm" onClick={() => reject(u.id, u.storage_key)}>Remove</button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {light && (
        <div className="lightbox" onClick={() => setLight(null)} role="dialog" aria-modal="true">
          <img src={asset(light.src)} alt={light.caption} onClick={(e) => e.stopPropagation()} />
          <div className="lightcap" onClick={(e) => e.stopPropagation()}>
            <div className="lcap-main">{light.caption}</div>
            <div className="lcap-meta">{shownDate(light.date)} · {light.game}</div>
            {light.who.length > 0 && (
              <div className="lcap-who">
                <b>Legible in this shot</b> ({light.who.length}, ours and theirs both):
                {' '}{light.who.join(', ')}
              </div>
            )}
            <div className="lcap-src">recovered from {host(light.source)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
