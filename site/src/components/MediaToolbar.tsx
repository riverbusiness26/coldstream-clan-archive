// Search, sort and the facets, in the module they govern.
//
// The old page had one year filter that quietly reached across both halves
// while the kind and category chips reached across only one, so the toolbar
// read as global and was not. Every control here belongs to the list rendered
// directly beneath it.
//
// A facet row only appears when it has more than one thing to choose between.
// A row of one chip is not a filter, it is furniture.
import type { MediaItem, SortKey } from '../lib/media';
import { COLLECTIONS, collectionName, countBy } from '../lib/media';
import { BROWSE_CATEGORIES, categoryBySlug } from '../lib/gallery';

export interface Facets {
  search: string;
  sort: SortKey;
  collection: string;
  category: string;
  type: 'all' | 'image' | 'video';
  year: string;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'featured', label: 'Featured first' },
  { key: 'views', label: 'Most viewed' },
];

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="facet">
      <span className="facet-l" id={`facet-${label}`}>{label}</span>
      <div className="chips" role="group" aria-labelledby={`facet-${label}`}>{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children, count }: {
  on: boolean; onClick: () => void; children: React.ReactNode; count?: number;
}) {
  return (
    <button className={'chip' + (on ? ' on' : '')} onClick={onClick} aria-pressed={on}>
      {children}
      {typeof count === 'number' && <span className="chip-n">{count}</span>}
    </button>
  );
}

export default function MediaToolbar({
  scope, value, onChange, showViews,
}: {
  /** Everything this toolbar could filter, for the counts. */
  scope: MediaItem[];
  value: Facets;
  onChange: (next: Facets) => void;
  /** Only offer "most viewed" once something is actually counting views. */
  showViews: boolean;
}) {
  const set = (patch: Partial<Facets>) => onChange({ ...value, ...patch });

  const byCollection = countBy(scope, (m) => m.collection);
  const byCategory = countBy(scope, (m) => m.category);
  const byYear = countBy(scope, (m) => (m.year ? String(m.year) : null));
  const films = scope.filter((m) => m.type === 'video').length;
  const photos = scope.length - films;

  const collections = COLLECTIONS.filter((c) => byCollection.get(c.slug));
  const categories = BROWSE_CATEGORIES.filter((c) => byCategory.get(c.slug));
  const years = [...byYear.keys()].sort();
  const sorts = SORTS.filter((s) => s.key !== 'views' || showViews);

  return (
    <div className="toolbar">
      <div className="toolbar-top">
        <div className="tsearch">
          <label className="sr-only" htmlFor="media-search">
            Search by title, description, tag or author
          </label>
          <input
            id="media-search"
            className="inp"
            type="search"
            placeholder="Search titles, tags, people"
            value={value.search}
            onChange={(e) => set({ search: e.target.value })}
          />
          {value.search && (
            <button className="tclear" onClick={() => set({ search: '' })}
              aria-label="Clear the search">x</button>
          )}
        </div>

        <div className="tsort">
          <label className="sr-only" htmlFor="media-sort">Sort</label>
          <select id="media-sort" className="inp" value={value.sort}
            onChange={(e) => set({ sort: e.target.value as SortKey })}>
            {sorts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {(photos > 0 && films > 0) && (
        <ChipRow label="Media">
          <Chip on={value.type === 'all'} onClick={() => set({ type: 'all' })} count={scope.length}>
            Everything
          </Chip>
          <Chip on={value.type === 'image'} onClick={() => set({ type: 'image' })} count={photos}>
            Photos
          </Chip>
          <Chip on={value.type === 'video'} onClick={() => set({ type: 'video' })} count={films}>
            Films
          </Chip>
        </ChipRow>
      )}

      {collections.length > 1 && (
        <ChipRow label="Kind">
          <Chip on={value.collection === 'all'} onClick={() => set({ collection: 'all' })}>
            All kinds
          </Chip>
          {collections.map((c) => (
            <Chip key={c.slug} on={value.collection === c.slug}
              onClick={() => set({ collection: c.slug })} count={byCollection.get(c.slug)}>
              {c.name}
            </Chip>
          ))}
        </ChipRow>
      )}

      {categories.length > 1 && (
        <ChipRow label="Game">
          <Chip on={value.category === 'all'} onClick={() => set({ category: 'all' })}>
            All games
          </Chip>
          {categories.map((c) => (
            <Chip key={c.slug} on={value.category === c.slug}
              onClick={() => set({ category: c.slug })} count={byCategory.get(c.slug)}>
              {c.name}
            </Chip>
          ))}
        </ChipRow>
      )}

      {years.length > 1 && (
        <ChipRow label="Year">
          <Chip on={value.year === 'all'} onClick={() => set({ year: 'all' })}>Any year</Chip>
          {years.map((y) => (
            <Chip key={y} on={value.year === y} onClick={() => set({ year: y })}
              count={byYear.get(y)}>{y}</Chip>
          ))}
        </ChipRow>
      )}

      {value.category !== 'all' && (
        <p className="note">{categoryBySlug(value.category)?.description}</p>
      )}
      {value.collection !== 'all' && value.category === 'all' && (
        <p className="note">Showing {collectionName(value.collection)?.toLowerCase()} only.</p>
      )}
    </div>
  );
}
