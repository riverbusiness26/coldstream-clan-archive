// Adding to the wall, on its own surface.
//
// This was a form sitting in the middle of the gallery, between the filters
// and the pictures. It pushed the wall down the page for everybody, and for a
// signed out visitor it put a sign-in pitch exactly where the images should
// have been.
//
// It writes the fields 0021 adds, and survives 0021 not having been run: a
// rejected column means the extras are dropped and the base row is written,
// rather than the member losing the upload entirely. 0020 sat unrun for a
// week, so this is not a hypothetical.
import { useEffect, useRef, useState } from 'react';
import { supa } from '../lib/supa';
import type { Me } from '../lib/auth';
import { CATEGORIES, categoryBySlug, youtubeId } from '../lib/gallery';
import { COLLECTIONS } from '../lib/media';
import { compressImage, compressToDataUrl } from '../lib/image';
import { demoGallery } from '../lib/demoGallery';

const BUCKET = 'gallery';
const MAX_BYTES = 8 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const SENT = 'Submitted. An admin checks it in and then it joins the wall.';

// The columns 0021 adds. Dropped together if the database has not got them.
const EXTRAS = ['description', 'tags', 'collection', 'duration_seconds', 'captions_url'] as const;

export default function UploadDrawer({
  me, onClose, onUploaded,
}: {
  me: Me;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [cat, setCat] = useState(CATEGORIES[0].slug);
  const [collection, setCollection] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [game, setGame] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [catIds, setCatIds] = useState<Record<string, string>>({});
  const panel = useRef<HTMLDivElement>(null);

  // Slug to id, so an insert can name a category the database recognises.
  // Demo mode has no ids and does not need them.
  useEffect(() => {
    if (!supa) return;
    supa.from('gallery_category').select('id, slug').then(({ data }) => {
      if (!data) return;
      setCatIds(Object.fromEntries((data as { id: string; slug: string }[]).map((c) => [c.slug, c.id])));
    });
  }, []);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [onClose]);

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
    setFile(null); setVideoUrl(''); setCaption(''); setDescription('');
    setTags(''); setGame(''); setYear('');
  }

  // Blank, or a whole year between the founding and now. Rejected here rather
  // than by a check constraint, so the member reads a sentence not a code.
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

  const tagList = () =>
    tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12);

  // Insert, and survive a database that has not caught up with this build.
  // Match on the column name as well as the code, so unrelated schema drift
  // still fails loudly instead of being retried into a half written row.
  async function insert(base: Record<string, unknown>, extra: Record<string, unknown>) {
    const first = await supa!.from('gallery_item').insert({ ...base, ...extra });
    if (!first.error) return { error: null as string | null, degraded: false };
    const msg = first.error.message;
    if (msg.includes('PGRST204') && EXTRAS.some((c) => msg.includes(c))) {
      const second = await supa!.from('gallery_item').insert(base);
      return { error: second.error?.message ?? null, degraded: !second.error };
    }
    return { error: msg, degraded: false };
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

    const extra = {
      description: description.trim() || null,
      tags: tagList(),
      collection: collection || null,
    };

    setBusy(true);
    try {
      if (mode === 'video') {
        const vid = youtubeId(videoUrl);
        if (!vid) { setFormError('That does not look like a YouTube link. Paste the address from the browser bar.'); return; }
        if (!supa) {
          const res = demoGallery.add({
            media_type: 'video', storage_key: null, video_id: vid, category_slug: cat,
            caption: caption.trim() || null, game: game.trim() || null,
            year: yr.value, width: null, height: null, ...extra,
          }, me.display_name);
          if (!res.ok) { setFormError(res.reason); return; }
        } else {
          const { error, degraded } = await insert({
            uploader_id: me.id, media_type: 'video', video_id: vid, storage_key: null,
            category_id: catIds[cat] ?? null, caption: caption.trim() || null,
            game: game.trim() || null, year: yr.value,
          }, extra);
          if (error) { setFormError(error); return; }
          if (degraded) setDone(`${SENT} The description and tags were not saved: the database has not had 0021 run yet.`);
        }
      } else {
        if (!file) { setFormError('Choose an image first.'); return; }
        if (!supa) {
          const shrunk = await compressToDataUrl(file);
          const res = demoGallery.add({
            media_type: 'image', storage_key: shrunk.url, video_id: null, category_slug: cat,
            caption: caption.trim() || null, game: game.trim() || null,
            year: yr.value, width: shrunk.w, height: shrunk.h, ...extra,
          }, me.display_name);
          if (!res.ok) { setFormError(res.reason); return; }
        } else {
          const squeezed = await compressImage(file);
          const key = `${me.id}/${crypto.randomUUID()}.${squeezed.ext}`;
          const up = await supa.storage.from(BUCKET).upload(key, squeezed.blob, {
            cacheControl: '31536000', contentType: squeezed.type,
          });
          if (up.error) {
            setFormError(/bucket/i.test(up.error.message)
              ? 'The upload store is not set up yet. An admin needs to create the gallery bucket.'
              : up.error.message);
            return;
          }
          const { error, degraded } = await insert({
            uploader_id: me.id, storage_key: key, media_type: 'image',
            category_id: catIds[cat] ?? null, caption: caption.trim() || null,
            game: game.trim() || null, year: yr.value,
            // Written since the rebuild. The columns have been on the table
            // since 0009 and nothing had ever filled them, which is why the
            // wall used to crop everything to 16:9.
            width: squeezed.w, height: squeezed.h,
          }, extra);
          if (error) { setFormError(error); return; }
          if (degraded) setDone(`${SENT} The description and tags were not saved: the database has not had 0021 run yet.`);
        }
      }
      clear();
      setDone((d) => d ?? SENT);
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
          <h2>Add to the wall</h2>
          <button className="sheet-x" onClick={onClose} aria-label="Close without submitting">x</button>
        </div>

        <div className="sheet-body">
          <div className="seg" role="group" aria-label="What kind of media">
            <button className={'segbtn' + (mode === 'image' ? ' on' : '')} aria-pressed={mode === 'image'}
              onClick={() => { setMode('image'); setFormError(null); }}>Screenshot</button>
            <button className={'segbtn' + (mode === 'video' ? ' on' : '')} aria-pressed={mode === 'video'}
              onClick={() => { setMode('video'); setFormError(null); }}>Video</button>
          </div>

          <label className="flab" htmlFor="up-cat">Which game</label>
          <select id="up-cat" className="inp" value={cat}
            onChange={(e) => { setCat(e.target.value); setFormError(null); }}>
            {offered.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>

          <label className="flab" htmlFor="up-col">What kind of thing it is</label>
          <select id="up-col" className="inp" value={collection}
            onChange={(e) => setCollection(e.target.value)}>
            <option value="">Not sure, leave it unsorted</option>
            {COLLECTIONS.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>

          {mode === 'video' ? (
            <>
              <label className="flab" htmlFor="up-url">The link</label>
              <input id="up-url" className="inp" placeholder="Paste a YouTube link"
                value={videoUrl} onChange={(e) => { setVideoUrl(e.target.value); setFormError(null); }} />
              <p className="fhint">Films stay on YouTube and the site gathers them. Nothing is copied off it.</p>
            </>
          ) : (
            <>
              <label className="flab" htmlFor="up-file">The image</label>
              <input id="up-file" className="inp" type="file" accept="image/*"
                onChange={(e) => pick(e.target.files?.[0] ?? null)} />
              <p className="fhint">JPG, PNG, WEBP or GIF, up to 8 MB. It is resized here before it is sent.</p>
            </>
          )}

          <label className="flab" htmlFor="up-cap">What is happening in it</label>
          <input id="up-cap" className="inp" placeholder="A line is enough" value={caption}
            onChange={(e) => setCaption(e.target.value)} maxLength={200} />

          <label className="flab" htmlFor="up-desc">Anything more worth saying</label>
          <textarea id="up-desc" className="inp ta" value={description} maxLength={2000}
            placeholder="Who was there, what the night was, why you kept it"
            onChange={(e) => setDescription(e.target.value)} />

          <label className="flab" htmlFor="up-tags">Tags</label>
          <input id="up-tags" className="inp" placeholder="linebattle, drill, siege" value={tags}
            onChange={(e) => setTags(e.target.value)} maxLength={200} />
          <p className="fhint">Separated by commas. These are searched.</p>

          <div className="fieldrow">
            <input className="inp" placeholder="Game, if it is not the category" value={game}
              onChange={(e) => setGame(e.target.value)} maxLength={60} aria-label="Game" />
            <input className="inp" placeholder="Year" value={year} inputMode="numeric"
              onChange={(e) => setYear(e.target.value)} maxLength={4} aria-label="Year" />
          </div>

          {formError && <p className="ferr" role="alert">{formError}</p>}
          {done && <p className="fok" role="status">{done}</p>}
        </div>

        <div className="sheet-foot">
          <p className="fhint">
            An admin checks every submission in before it goes on the wall. By
            submitting you grant Coldstream Gaming permission to feature it.
          </p>
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
