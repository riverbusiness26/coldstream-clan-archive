// Adding to the wall, on its own surface.
//
// This was a form sitting in the middle of the gallery, between the filters
// and the pictures. It pushed the wall down the page for everybody, and for a
// signed out visitor it put a sign-in pitch exactly where the images should
// have been. It is the same form and the same three code paths as before,
// moved behind the one button the mock draws.
import { useEffect, useRef, useState } from 'react';
import { supa } from '../lib/supa';
import type { Me } from '../lib/auth';
import { CATEGORIES, categoryBySlug, youtubeId } from '../lib/gallery';
import { compressImage, compressToDataUrl } from '../lib/image';
import { demoGallery } from '../lib/demoGallery';

const BUCKET = 'gallery';
const MAX_BYTES = 8 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const SENT = 'Submitted. An admin checks it in and then it joins the wall.';

export default function UploadDrawer({
  me, catIds, onClose, onUploaded,
}: {
  me: Me;
  catIds: Record<string, string>;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [cat, setCat] = useState(CATEGORIES[0].slug);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [game, setGame] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const catId = (slug: string): string | null => catIds[slug] ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => { panel.current?.querySelector('button')?.focus(); }, []);

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

  function clear() {
    setFile(null); setVideoUrl(''); setCaption(''); setGame(''); setYear('');
  }

  // Blank, or a whole year between the founding and now. Rejected here rather
  // than by a check constraint, so the member reads a sentence and not an error
  // code.
  function readYear(): { ok: true; value: number | null } | { ok: false; why: string } {
    const raw = year.trim();
    if (!raw) return { ok: true, value: null };
    const n = Number(raw);
    const now = new Date().getFullYear();
    if (!Number.isInteger(n) || n < 2011 || n > now) {
      return { ok: false, why: `The year should be between 2011 and ${now}, or left blank.` };
    }
    return { ok: true, value: n };
  }

  async function submit() {
    setFormError(null);
    const chosen = categoryBySlug(cat);
    if (!chosen) { setFormError('Pick a category.'); return; }
    if (chosen.locked) { setFormError('That category is a record, not a noticeboard. Pick another.'); return; }
    if (chosen.accepts !== 'both' && chosen.accepts !== mode) {
      setFormError(`${chosen.name} only takes ${chosen.accepts === 'video' ? 'videos' : 'images'}.`);
      return;
    }
    const yr = readYear();
    if (!yr.ok) { setFormError(yr.why); return; }

    if (mode === 'video') {
      const vid = youtubeId(videoUrl);
      if (!vid) { setFormError('That does not look like a YouTube link. Paste the address from the browser bar.'); return; }
      setBusy(true);
      try {
        if (!supa) {
          const res = demoGallery.add({
            media_type: 'video', storage_key: null, video_id: vid,
            category_slug: cat, caption: caption.trim() || null,
            game: game.trim() || null, year: yr.value, width: null, height: null,
          }, me.display_name);
          if (!res.ok) { setFormError(res.reason); return; }
        } else {
          const { error } = await supa.from('gallery_item').insert({
            uploader_id: me.id,
            media_type: 'video',
            video_id: vid,
            storage_key: null,
            category_id: catId(cat),
            caption: caption.trim() || null,
            game: game.trim() || null,
            year: yr.value,
          });
          if (error) { setFormError(error.message); return; }
        }
        clear();
        setDone(SENT);
        onUploaded();
      } finally { setBusy(false); }
      return;
    }

    if (!file) { setFormError('Choose an image first.'); return; }

    setBusy(true);
    try {
      if (!supa) {
        const shrunk = await compressToDataUrl(file);
        const res = demoGallery.add({
          media_type: 'image', storage_key: shrunk.url, video_id: null,
          category_slug: cat, caption: caption.trim() || null,
          game: game.trim() || null, year: yr.value, width: shrunk.w, height: shrunk.h,
        }, me.display_name);
        if (!res.ok) { setFormError(res.reason); return; }
        clear();
        setDone(SENT);
        onUploaded();
        return;
      }

      const squeezed = await compressImage(file);
      const key = `${me.id}/${crypto.randomUUID()}.${squeezed.ext}`;
      const up = await supa.storage.from(BUCKET).upload(key, squeezed.blob, {
        cacheControl: '31536000',
        contentType: squeezed.type,
      });
      if (up.error) {
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
        year: yr.value,
        // Written for the first time. The columns have been on the table since
        // 0009 and every row so far has them null, which is why the wall used
        // to crop everything to 16:9.
        width: squeezed.w,
        height: squeezed.h,
      });
      if (error) { setFormError(error.message); return; }
      clear();
      setDone(SENT);
      onUploaded();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'That image could not be read.');
    } finally {
      setBusy(false);
    }
  }

  const offered = CATEGORIES.filter((c) => !c.locked)
    .filter((c) => c.accepts === 'both' || c.accepts === mode);

  return (
    <div className="sheet" onClick={onClose} role="dialog" aria-modal="true" aria-label="Add to the wall">
      <div className="sheet-panel" ref={panel} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>Add to the wall</h3>
          <button className="sheet-x" onClick={onClose} aria-label="Close">x</button>
        </div>

        <div className="sheet-body">
          <div className="seg">
            <button className={'segbtn' + (mode === 'image' ? ' on' : '')}
              onClick={() => { setMode('image'); setFormError(null); }}>Screenshot</button>
            <button className={'segbtn' + (mode === 'video' ? ' on' : '')}
              onClick={() => { setMode('video'); setFormError(null); }}>Video</button>
          </div>

          <label className="flab" htmlFor="up-cat">Which game</label>
          <select id="up-cat" className="inp" value={cat}
            onChange={(e) => { setCat(e.target.value); setFormError(null); }}>
            {offered.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>

          {mode === 'video' ? (
            <>
              <label className="flab" htmlFor="up-url">The link</label>
              <input id="up-url" className="inp" placeholder="Paste a YouTube link"
                value={videoUrl} onChange={(e) => { setVideoUrl(e.target.value); setFormError(null); }} />
              <div className="fhint">
                Films stay on YouTube and the site gathers them. Nothing is copied off it.
              </div>
            </>
          ) : (
            <>
              <label className="flab" htmlFor="up-file">The image</label>
              <input id="up-file" className="inp" type="file" accept="image/*"
                onChange={(e) => pick(e.target.files?.[0] ?? null)} />
              <div className="fhint">JPG, PNG, WEBP or GIF, up to 8 MB. It is resized here before it is sent.</div>
            </>
          )}

          <label className="flab" htmlFor="up-cap">What is happening in it</label>
          <input id="up-cap" className="inp" placeholder="A line is enough" value={caption}
            onChange={(e) => setCaption(e.target.value)} maxLength={200} />

          <div className="fieldrow">
            <input className="inp" placeholder="Game, if it is not the category" value={game}
              onChange={(e) => setGame(e.target.value)} maxLength={60} aria-label="Game" />
            <input className="inp" placeholder="Year" value={year} inputMode="numeric"
              onChange={(e) => setYear(e.target.value)} maxLength={4} aria-label="Year" />
          </div>

          {formError && <div className="ferr">{formError}</div>}
          {done && <div className="fok">{done}</div>}
        </div>

        <div className="sheet-foot">
          <div className="fhint">
            An admin checks every submission in before it goes on the wall. By
            submitting you grant Coldstream Gaming permission to feature it.
          </div>
          <div className="sheet-acts">
            <button className="btn sm" onClick={onClose}>{done ? 'Close' : 'Cancel'}</button>
            <button className="btn primary sm" onClick={submit}
              disabled={busy || (mode === 'image' ? !file : !videoUrl.trim())}>
              {busy ? (mode === 'video' ? 'Submitting' : 'Uploading') : (mode === 'video' ? 'Submit video' : 'Upload')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
