// The gallery: one shared wall for recovered record items and member uploads.
// Origin details remain available when an item is opened, but never split the
// page into separate sections.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Me } from '../lib/auth';
import type { MediaItem } from '../lib/media';
import { fetchMedia, recordView, selectMedia, shownDate } from '../lib/media';
import DiscordButton from '../components/DiscordButton';
import PlateViewer from '../components/PlateViewer';
import UploadDrawer from '../components/UploadDrawer';
import MediaToolbar, { type Facets } from '../components/MediaToolbar';
import { MediaGrid, MediaTile } from '../components/MediaGrid';
import { supa } from '../lib/supa';
import { demoGallery } from '../lib/demoGallery';

/** How many results to render before asking. */
const PAGE = 24;

const BLANK: Facets = {
  search: '', sort: 'newest', collection: 'all', category: 'all', type: 'all', year: 'all',
};

const isBrowsing = (f: Facets) =>
  !f.search.trim() && f.collection === 'all' && f.category === 'all'
  && f.type === 'all' && f.year === 'all';

/** The item id in "#/gallery/<id>", or null. */
function idFromHash(): string | null {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  return parts[0] === 'gallery' && parts[1] ? decodeURIComponent(parts[1]) : null;
}

export default function Gallery({ me, signIn }: { me: Me | null; signIn: () => void }) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [pending, setPending] = useState<MediaItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [facets, setFacets] = useState<Facets>(BLANK);
  const [shown, setShown] = useState(PAGE);
  const [drawer, setDrawer] = useState(false);

  // The hash is the single source of truth for what is open, which is what
  // makes a deep link, the back button and a click on a tile the same thing.
  const [openId, setOpenId] = useState<string | null>(() => idFromHash());
  const pushedOwnEntry = useRef(false);

  const load = useCallback(() => {
    setLoadError(null);
    fetchMedia().then((r) => {
      setItems(r.items);
      setPending(r.pending);
      setLoadError(r.error);
    }).catch((e: unknown) => {
      setItems([]);
      setLoadError(e instanceof Error ? e.message : 'The gallery could not be loaded.');
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onHash = () => setOpenId(idFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // A new filter is a new list, so start it at the top rather than leaving
  // somebody several pages into a set that no longer exists.
  useEffect(() => { setShown(PAGE); }, [facets]);

  const browsing = isBrowsing(facets);

  const results = useMemo(
    () => selectMedia(items ?? [], facets),
    [items, facets]);

  const featured = useMemo(
    () => (items ?? []).filter((m) => m.featured).sort((a, b) => b.sortDate - a.sortDate).slice(0, 6),
    [items]);

  const anyViews = useMemo(() => (items ?? []).some((m) => typeof m.views === 'number'), [items]);

  // Prev and next walk the set the reader actually clicked in, so opening a
  // film from the wall pages through the wall rather than through the featured
  // shelf that happens to contain it as well. A cold deep link has no such
  // set, and falls back to whichever list holds the item.
  const clickedIn = useRef<MediaItem[] | null>(null);
  const viewer = useMemo(() => {
    if (!openId || !items) return null;
    const lists = [clickedIn.current, results, featured, items];
    for (const list of lists) {
      const i = list ? list.findIndex((m) => m.id === openId) : -1;
      if (list && i >= 0) return { list, i };
    }
    return null;
  }, [openId, items, results, featured]);

  // Count the view once per opening, not once per render.
  const counted = useRef<string | null>(null);
  useEffect(() => {
    const item = viewer?.list[viewer.i];
    if (!item || counted.current === item.id) return;
    counted.current = item.id;
    void recordView(item);
  }, [viewer]);

  const openItem = useCallback((item: MediaItem, list?: MediaItem[]) => {
    clickedIn.current = list ?? null;
    pushedOwnEntry.current = true;
    location.hash = `#/gallery/${encodeURIComponent(item.id)}`;
  }, []);

  const closeViewer = useCallback(() => {
    // Back, so the browser's own control and this button agree. Somebody who
    // arrived on a shared link has no entry of ours to go back to, so that
    // case replaces instead of throwing them off the site.
    if (pushedOwnEntry.current) {
      pushedOwnEntry.current = false;
      history.back();
    } else {
      location.replace('#/gallery');
      setOpenId(null);
    }
  }, []);

  const goToIndex = useCallback((i: number) => {
    const next = viewer?.list[i];
    if (next) location.replace(`#/gallery/${encodeURIComponent(next.id)}`);
    setOpenId(next?.id ?? null);
  }, [viewer]);

  const canModerate = me?.role === 'moderator' || me?.role === 'admin';

  async function approve(id: string) {
    if (!supa) { demoGallery.approve(id); load(); return; }
    await supa.from('gallery_item').update({ approved: true }).eq('id', id);
    load();
  }
  async function reject(id: string) {
    if (!supa) { demoGallery.remove(id); load(); return; }
    const { data } = await supa.from('gallery_item').select('storage_key').eq('id', id).maybeSingle();
    await supa.from('gallery_item').delete().eq('id', id);
    const key = (data as { storage_key: string | null } | null)?.storage_key;
    if (key && !key.startsWith('data:')) await supa.storage.from('gallery').remove([key]);
    load();
  }

  const loading = items === null;
  const years = new Set((items ?? []).map((m) => m.year).filter(Boolean));
  const films = (items ?? []).filter((m) => m.type === 'video').length;

  // Memoised so the callback MediaGrid builds from them keeps its identity,
  // and the tiles under it are not all re-rendered whenever some unrelated
  // piece of state moves.
  const resultPage = useMemo(() => results.slice(0, shown), [results, shown]);

  const openPending = useCallback((m: MediaItem) => openItem(m, pending), [openItem, pending]);

  return (
    <div className={'wrap plateroom' + (browsing ? '' : ' searching')}>
      <div className="page-head">
        <h1>The Gallery</h1>
        <p className="page-sub">The plate room.</p>
      </div>

      {loadError && (
        <div className="pr-alert">
          <div className="module alert">
            <div className="mhead"><h2>The wall could not be read</h2><span className="sub">the record below is unaffected</span></div>
            <p className="note">
              <b>{loadError}</b> The recovered half is bundled with the page and
              is all here. Member uploads come from the database and that is the
              part that did not answer.
            </p>
            <p className="note"><button className="btn sm" onClick={load}>Try again</button></p>
          </div>
        </div>
      )}

      <div className="pr-tools">
        <div className="module">
          <MediaToolbar
            scope={items ?? []}
            value={facets}
            onChange={setFacets}
            showViews={anyViews}
          />
        </div>
      </div>

      {loading && (
        <div className="pr-results">
          <div className="module">
            <div className="mhead"><h2>Loading</h2><span className="sub">reading the room</span></div>
            {/* Placeholders at the real tile shape, so nothing jumps when the
                pictures arrive. */}
            <div className="wall" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => <span className="frame skel" key={i} />)}
            </div>
            <p className="sr-only" role="status">Loading the gallery.</p>
          </div>
        </div>
      )}

      {!loading && !browsing && (
        <div className="pr-results">
          <div className="module">
            <div className="mhead">
              <h2>Results</h2>
              <span className="sub">
                {results.length} of {items?.length ?? 0}
                {facets.search.trim() ? ` for "${facets.search.trim()}"` : ''}
              </span>
            </div>
            {results.length === 0 ? (
              <div className="empty">
                <p className="empty-h">Nothing matches that.</p>
                <p className="note">
                  {facets.search.trim()
                    ? <>No title, tag, person or description contains <b>{facets.search.trim()}</b>.</>
                    : <>No item is in every one of those filters at once.</>}
                </p>
                <button className="btn sm" onClick={() => setFacets(BLANK)}>Clear everything</button>
              </div>
            ) : (
              <>
                <MediaGrid items={resultPage} onOpen={openItem} />
                {results.length > shown && (
                  <div className="more">
                    <button className="btn" onClick={() => setShown((n) => n + PAGE)}>
                      Show more
                    </button>
                    <span className="more-n">
                      showing {Math.min(shown, results.length)} of {results.length}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {!loading && browsing && (
        <div className="pr-results">
          <div className="module">
            <div className="mhead">
              <h2>Gallery</h2>
              <span className="sub">{results.length} items</span>
            </div>
            {results.length === 0 ? <div className="empty"><p className="empty-h">Nothing on the wall yet.</p></div> : <>
              <MediaGrid items={resultPage} onOpen={openItem} />
              {results.length > shown && <div className="more"><button className="btn" onClick={() => setShown((n) => n + PAGE)}>Show more</button><span className="more-n">showing {Math.min(shown, results.length)} of {results.length}</span></div>}
            </>}
            <div className="gallery-submit">
              {me ? <button className="btn primary" onClick={() => setDrawer(true)}>Submit a screenshot</button> : <DiscordButton me={me} signIn={signIn} />}
              <p className="railterms">{me ? 'An admin checks every submission before it goes up.' : 'Sign in through Discord to add to the gallery. An admin checks each one in before it goes up.'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="pr-wall">

        {/* Its own module, and only for the people it concerns. It used to be
            a dimmed strip under the wall that everybody scrolled past. */}
        {pending.length > 0 && (
          <div className="module">
            <div className="mhead">
              <h2>{canModerate ? 'Waiting to be checked in' : 'Waiting on an admin'}</h2>
              <span className="sub">{pending.length} held</span>
            </div>
            <p className="note">
              {canModerate
                ? 'Approve puts it on the wall for everyone. Deny removes it and its file.'
                : 'An admin looks over everything before it joins the wall.'}
            </p>
            {/* The controls are siblings of the tile, not children of it: the
                tile is a button and nesting one inside another is invalid and
                unreachable for some assistive technology. */}
            <div className="wall pending">
              {pending.map((m) => (
                <div className="frame-wrap" key={m.id}>
                  <MediaTile item={m} onOpen={openPending} />
                  {canModerate && (
                    <span className="modrow">
                      <button className="btn sm" onClick={() => approve(m.id)}
                        aria-label={`Approve ${m.title}`}>Approve</button>
                      <button className="btn sm" onClick={() => reject(m.id)}
                        aria-label={`Deny ${m.title}`}>Deny</button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {viewer && (
        <PlateViewer
          list={viewer.list}
          index={viewer.i}
          onIndex={goToIndex}
          onClose={closeViewer}
        />
      )}

      {drawer && me && (
        <UploadDrawer me={me} onClose={() => setDrawer(false)} onUploaded={load} />
      )}
    </div>
  );
}

export { shownDate };
