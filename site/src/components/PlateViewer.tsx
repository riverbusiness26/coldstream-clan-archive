// One viewer, for every picture on the gallery.
//
// It takes the list it is looking at and an index into that same list. That is
// the whole fix for a real bug that shipped: the old lightbox rendered the
// year-filtered array but read `SHOTS[lightIdx]` out of the unfiltered one, so
// picking a year and clicking the second plate opened the second plate of all
// twelve, and the arrow keys and the thumbnail strip disagreed with each other
// besides. Passing the rendered list in makes list[i] the thing that was
// clicked by construction, and no caller can reintroduce it.
//
// A member's upload used to be an <a target="_blank"> to the raw storage URL,
// so half the pictures on the page left the site when you opened them. They
// come through here now like everything else.
import { useCallback, useEffect, useRef } from 'react';
import type { Plate } from '../lib/gallery';
import { youtubeEmbed } from '../lib/gallery';
import { asset } from '../lib/asset';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

// Dates arrive as YYYY-MM-DD or YYYY-MM depending on whether the original
// filename carried a day. Render only as much as we actually know.
export function shownDate(d: string | null | undefined) {
  if (!d) return 'date unknown';
  const [y, m, day] = d.split('-');
  const month = MONTHS[Number(m) - 1] ?? '';
  return day ? `${Number(day)} ${month} ${y}` : `${month} ${y}`;
}

export function host(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'unknown source'; }
}

export default function PlateViewer({
  list, index, onIndex, onClose,
}: {
  list: Plate[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const plate = list[index];
  const closeRef = useRef<HTMLButtonElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const step = useCallback((d: number) => {
    onIndex(Math.min(list.length - 1, Math.max(0, index + d)));
  }, [index, list.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onClose]);

  // Opening the viewer moves focus into it, so the keys above reach it without
  // the reader having to click first, and closing hands focus back to the page.
  useEffect(() => { closeRef.current?.focus(); }, []);

  // Keep the marked thumbnail in view when the arrows walk past the edge of
  // the strip, or a long set silently leaves the current plate off screen.
  useEffect(() => {
    const el = stripRef.current?.querySelector('.on');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [index]);

  // The body must not scroll behind a full screen viewer.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!plate) return null;

  return (
    <div className="lb" onClick={onClose} role="dialog" aria-modal="true"
      aria-label={plate.caption || 'Plate'}>
      <button ref={closeRef} className="lb-close" onClick={onClose} aria-label="Close">x</button>

      <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
        <button className="lb-nav" onClick={() => step(-1)}
          disabled={index === 0} aria-label="Previous">&lt;</button>
        {plate.media === 'video' && plate.videoId ? (
          // The embed has been in lib/gallery.ts since videos were added and
          // had never once been called: a film opened on youtube.com instead.
          <iframe className="lb-film" src={youtubeEmbed(plate.videoId)}
            title={plate.caption || 'Film'} allowFullScreen
            allow="accelerometer; encrypted-media; picture-in-picture" />
        ) : (
          <img src={asset(plate.src)} alt={plate.caption} />
        )}
        <button className="lb-nav" onClick={() => step(1)}
          disabled={index === list.length - 1} aria-label="Next">&gt;</button>
      </div>

      <div className="lb-plate" onClick={(e) => e.stopPropagation()}>
        <div className="cap">{plate.caption}</div>
        {plate.kind === 'record' ? (
          <>
            <div className="meta">
              {shownDate(plate.date)}{plate.game ? ` · ${plate.game}` : ''}
              {plate.source ? ` · recovered from ${host(plate.source)}` : ''}
            </div>
            {plate.who && plate.who.length > 0 && (
              <div className="who">
                <b>Legible in this shot</b> ({plate.who.length}, ours and theirs both): {plate.who.join(', ')}
              </div>
            )}
          </>
        ) : (
          <div className="meta">
            {/* No provenance line here, because there is no provenance. Who
                added it and when is the whole of what this half knows. */}
            <b>{plate.by ?? 'a member'}</b> added this
            {plate.game ? ` · ${plate.game}` : ''}{plate.year ? ` · ${plate.year}` : ''}
          </div>
        )}
      </div>

      <div className="lb-strip" ref={stripRef} onClick={(e) => e.stopPropagation()}>
        {list.map((p, i) => (
          <button key={p.key} className={i === index ? 'on' : undefined}
            onClick={() => onIndex(i)} aria-label={`Plate ${i + 1} of ${list.length}`}
            aria-current={i === index ? 'true' : undefined}>
            <img src={asset(p.src)} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
