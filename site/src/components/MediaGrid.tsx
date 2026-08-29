// The tiles, and the justified rows they sit in.
//
// Rows are balanced rather than cropped: flex-basis is proportional to the
// item's aspect ratio and so is flex-grow, which makes every tile in a row
// resolve to the same height while keeping its own shape. A portrait phone
// grab and a 21:9 ultrawide can sit side by side and neither loses its edges.
// Items with no stored dimensions fall back to 16:9, which is what every row
// written before width and height were being saved will do.
import { memo, useCallback } from 'react';
import type { MediaItem } from '../lib/media';
import { collectionName, formatDuration, shownDate } from '../lib/media';
import { asset } from '../lib/asset';

const ratio = (m: MediaItem) => (m.width && m.height ? m.width / m.height : 1.7778);

// No children. The moderation controls used to render inside this button and
// a button inside a button is invalid HTML: React warns about it, the inner
// control is unreachable in some assistive technology, and a click on it
// activates the outer one too. They are a sibling now, in .frame-wrap.
function TileInner({ item, onOpen, size }: {
  item: MediaItem;
  onOpen: (item: MediaItem) => void;
  size?: 'feature';
}) {
  const duration = formatDuration(item.duration);
  const collection = collectionName(item.collection);
  // Everything the hover panel shows, joined for the accessible name, so a
  // screen reader gets the same information a sighted reader gets by pointing
  // at it rather than just "open".
  const detail = [
    item.type === 'video' ? 'Film' : 'Photo',
    collection, item.category, item.author, shownDate(item.date), duration,
  ].filter(Boolean).join(', ');

  return (
    <button
      className={'frame' + (size === 'feature' ? ' frame-feature' : '')}
      onClick={() => onOpen(item)}
      style={{ '--ar': ratio(item) } as React.CSSProperties}
      aria-label={`Open ${item.title}. ${detail}`}
    >
      <img
        src={asset(item.thumbnail)}
        alt={item.alt}
        loading="lazy"
        decoding="async"
        width={item.width ?? undefined}
        height={item.height ?? undefined}
      />

      {/* A shape and a word, never colour alone. */}
      <span className={'mbadge' + (item.type === 'video' ? ' is-film' : '')}>
        <span className="mbadge-i" aria-hidden="true" />
        {item.type === 'video' ? 'Film' : 'Photo'}
        {duration && <span className="mbadge-d">{duration}</span>}
      </span>

      {item.featured && <span className="mbadge is-featured">Featured</span>}

      <span className="frame-cap" aria-hidden="true">
        <b>{item.title}</b>
        <span className="frame-meta">
          {[collection, item.author ?? (item.origin === 'record' ? 'recovered' : null),
            shownDate(item.date)].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  );
}

export const MediaTile = memo(TileInner);

export function MediaGrid({ items, onOpen, className }: {
  items: MediaItem[];
  /** The list is passed back so the viewer walks the set that was clicked. */
  onOpen: (item: MediaItem, list: MediaItem[]) => void;
  className?: string;
}) {
  // One callback for the whole grid rather than one per tile: a closure built
  // inside map() is a new function on every render and would make memo() on
  // the tile do nothing at all.
  const open = useCallback((m: MediaItem) => onOpen(m, items), [items, onOpen]);
  return (
    <div className={'wall' + (className ? ' ' + className : '')}>
      {items.map((m) => <MediaTile key={m.id} item={m} onOpen={open} />)}
    </div>
  );
}
