// One viewer, for every picture and every film on the gallery.
//
// It takes the list it is looking at and an index into that same list. That is
// the whole fix for a bug that shipped: the old lightbox rendered the
// year-filtered array but read the open plate out of the unfiltered one, so
// picking a year and clicking the second plate opened the second plate of all
// twelve, and the arrows and the thumbnail strip disagreed with each other
// besides. Passing the rendered list in makes list[i] the thing that was
// clicked by construction, and no caller can reintroduce it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MediaItem } from '../lib/media';
import { collectionName, formatDuration, host, shownDate } from '../lib/media';
import { asset } from '../lib/asset';

const FOCUSABLE = 'a[href],button:not([disabled]),iframe,video,[tabindex]:not([tabindex="-1"])';

export default function PlateViewer({
  list, index, onIndex, onClose,
}: {
  list: MediaItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const item = list[index];
  const dialog = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const step = useCallback((d: number) => {
    onIndex(Math.min(list.length - 1, Math.max(0, index + d)));
  }, [index, list.length, onIndex]);

  // Focus goes back where it came from on close. Without this, dismissing the
  // viewer drops a keyboard user at the top of the document and they have to
  // tab all the way back to the tile they were on.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowRight') { step(1); return; }
      if (e.key === 'ArrowLeft') { step(-1); return; }
      if (e.key !== 'Tab') return;
      // Trap. A modal that lets you tab out into the page behind it is a modal
      // only for people using a mouse.
      const nodes = [...(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
        .filter((n) => n.offsetParent !== null || n.tagName === 'IFRAME');
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.current?.contains(active))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onClose]);

  // Keep the marked thumbnail in view when the arrows walk past the edge of
  // the strip, or a long set silently leaves the open plate off screen.
  useEffect(() => {
    strip.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [index]);

  // The page behind must not scroll.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // A new plate is a new chance for the image to load.
  useEffect(() => { setFailed(false); setCopied(false); }, [item?.id]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !item) return '';
    return `${location.origin}${location.pathname}#/gallery/${item.id}`;
  }, [item?.id]);

  async function share() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard is refused outside a secure context and in some browsers
      // without a gesture. Select the text instead of failing silently.
      const el = document.getElementById('lb-share-url') as HTMLInputElement | null;
      el?.select();
    }
  }

  if (!item) return null;

  const duration = formatDuration(item.duration);
  const collection = collectionName(item.collection);

  return (
    <div className="lb" onClick={onClose} role="dialog" aria-modal="true"
      aria-label={item.title || 'Media'} ref={dialog}>
      <div className="lb-bar" onClick={(e) => e.stopPropagation()}>
        <span className="lb-count" aria-live="polite">
          {index + 1} <span aria-hidden="true">/</span>
          <span className="sr-only">of</span> {list.length}
        </span>
        <span className="lb-acts">
          <button className="lb-act" onClick={share}
            aria-label={copied ? 'Link copied' : 'Copy a link to this item'}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          {item.downloadable && (
            <a className="lb-act" href={asset(item.src)} download
              // Same origin for our own files; a cross origin href just opens.
              aria-label={`Download ${item.title}`}>Download</a>
          )}
          {item.videoId && (
            <a className="lb-act" href={item.src} target="_blank" rel="noopener">
              Watch on YouTube
            </a>
          )}
          <button ref={closeBtn} className="lb-act lb-close" onClick={onClose}
            aria-label="Close the viewer">Close</button>
        </span>
      </div>

      <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
        <button className="lb-nav" onClick={() => step(-1)}
          disabled={index === 0} aria-label="Previous item">&lt;</button>

        {item.type === 'video' && item.videoId ? (
          <iframe className="lb-film" src={item.embed ?? undefined}
            title={item.title} allowFullScreen
            allow="accelerometer; encrypted-media; picture-in-picture" />
        ) : item.type === 'video' ? (
          // Nothing self hosted today, but the model allows it and a <video>
          // with a poster and a caption track is what it would need.
          <video className="lb-film" controls playsInline preload="none"
            poster={item.poster ? asset(item.poster) : undefined}>
            <source src={asset(item.src)} />
            {item.captions && <track kind="captions" src={item.captions} default label="Captions" />}
            <a href={asset(item.src)}>Download the film</a>
          </video>
        ) : failed ? (
          <p className="lb-failed">
            This image could not be loaded. It may have moved, or the
            connection dropped. <a href={asset(item.src)} target="_blank" rel="noopener">Try it directly</a>.
          </p>
        ) : (
          <img src={asset(item.src)} alt={item.alt}
            width={item.width ?? undefined} height={item.height ?? undefined}
            onError={() => setFailed(true)} />
        )}

        <button className="lb-nav" onClick={() => step(1)}
          disabled={index === list.length - 1} aria-label="Next item">&gt;</button>
      </div>

      <div className="lb-plate" onClick={(e) => e.stopPropagation()}>
        <h2 className="cap">{item.title}</h2>
        {item.description && <p className="lb-desc">{item.description}</p>}

        {item.origin === 'record' ? (
          <p className="meta">
            {shownDate(item.date)}
            {item.tags.length > 0 ? '' : ''}
            {item.source ? ` · recovered from ${host(item.source)}` : ''}
          </p>
        ) : (
          <p className="meta">
            {/* No provenance line, because there is no provenance. Who added
                it and when is the whole of what this half knows. */}
            <b>{item.author}</b> added this · {shownDate(item.date)}
            {collection ? ` · ${collection}` : ''}
            {duration ? ` · ${duration}` : ''}
            {typeof item.views === 'number' ? ` · ${item.views} views` : ''}
          </p>
        )}

        {item.names.length > 0 && (
          <p className="who">
            <b>Legible in this shot</b> ({item.names.length}, ours and theirs both): {item.names.join(', ')}
          </p>
        )}

        <label className="sr-only" htmlFor="lb-share-url">Link to this item</label>
        <input id="lb-share-url" className="lb-url" readOnly value={shareUrl}
          onClick={(e) => (e.target as HTMLInputElement).select()} />
      </div>

      <div className="lb-strip" ref={strip} onClick={(e) => e.stopPropagation()}
        role="tablist" aria-label="Items in this set">
        {list.map((p, i) => (
          <button key={p.id} className={i === index ? 'on' : undefined}
            role="tab" aria-selected={i === index}
            onClick={() => onIndex(i)}
            aria-label={`${p.title}, item ${i + 1} of ${list.length}`}>
            <img src={asset(p.thumbnail)} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
