// The gallery: a record room for the pictures.
//
// Two halves that are deliberately kept apart, and one way of looking at
// anything in either. That split is River's call and it is editorial, not
// cosmetic:
//
//   "From the Record" is recovered material, pulled back off Photobucket and
//   imgur before the links died. Every plate carries its date, the names still
//   legible in it, and the address it came from, because the whole point of
//   the record is that you can check it.
//
//   "From Members" is the live half. It carries an author and a date and no
//   provenance at all, and it must never be dressed up as though it had any.
//
// The layout is River's ref, Site refs/website/games.png: the record on the
// left, members in a rail on the right under one button. Above RAIL_HOLDS
// approved items the wall breaks out full width beneath both columns, because
// a 336px rail becomes a second and worse gallery once it has to hold a set.
//
// Searching or filtering leaves that composition on purpose. A result set is
// one list, and splitting it across two columns of different widths would ask
// the reader to scan twice to answer one question.
//
// A note so nobody wires the wrong things together: the recovered half is the
// bundled seed at src/seed/gallery.json. The locked 'the-archive' category in
// gallery_category is a different object, it is empty, and nothing here reads
// from it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Me } from '../lib/auth';
import type { MediaItem } from '../lib/media';
import { fetchMedia, recordView, selectMedia, shownDate } from '../lib/media';
import SteamButton from '../components/SteamButton';
import PlateViewer from '../components/PlateViewer';
import UploadDrawer from '../components/UploadDrawer';
import MediaToolbar, { type Facets } from '../components/MediaToolbar';
import { MediaGrid, MediaTile } from '../components/MediaGrid';
import { supa } from '../lib/supa';
import { demoGallery } from '../lib/demoGallery';

const RAIL_HOLDS = 4;
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

  const record = useMemo(() => (items ?? []).filter((m) => m.origin === 'record'), [items]);
  const members = useMemo(() => (items ?? []).filter((m) => m.origin === 'member'), [items]);

  const recordHits = useMemo(() => selectMedia(record, facets), [record, facets]);
  const memberHits = useMemo(() => selectMedia(members, facets), [members, facets]);
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
    const lists = [clickedIn.current, results, recordHits, memberHits, featured, items];
    for (const list of lists) {
      const i = list ? list.findIndex((m) => m.id === openId) : -1;
      if (list && i >= 0) return { list, i };
    }
    return null;
  }, [openId, items, results, recordHits, memberHits, featured]);

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
  const recordPage = useMemo(() => recordHits.slice(0, shown), [recordHits, shown]);
  const memberPage = useMemo(() => memberHits.slice(0, shown), [memberHits, shown]);

  const openFeatured = useCallback((m: MediaItem) => openItem(m, featured), [openItem, featured]);
  const openRail = useCallback((m: MediaItem) => openItem(m, memberHits), [openItem, memberHits]);
  const openPending = useCallback((m: MediaItem) => openItem(m, pending), [openItem, pending]);

  const railFeatured = memberHits[0] ?? null;
  const breakout = memberHits.length > RAIL_HOLDS;
  const railRest = breakout ? [] : memberHits.slice(1);

  return (
    <div className={'wrap plateroom' + (browsing ? '' : ' searching')}>
      <div className="page-head">
        <h1>The Gallery</h1>
        <p className="page-sub">The plate room.</p>
      </div>

      {/* Label, figure, then where it came from. The refs put a source line
          under every count and they are right to: a bare number on a record
          page is a claim. These say what the seeds actually are. */}
      <div className="pr-numbers">
        <div className="module">
          <div className="mhead"><h2>The Numbers</h2><span className="sub">what is in the room</span></div>
          <div className="stats sourced" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="stat">
              <div className="l">plates recovered</div>
              <div className="n">{loading ? '·' : record.length}</div>
              <div className="src">from the community archives</div>
            </div>
            <div className="stat">
              <div className="l">on the wall</div>
              <div className="n">{loading ? '·' : members.length}</div>
              <div className="src">added by members</div>
            </div>
            <div className="stat">
              <div className="l">films</div>
              <div className="n">{loading ? '·' : films}</div>
              <div className="src">gathered, not hosted</div>
            </div>
            <div className="stat">
              <div className="l">years covered</div>
              <div className="n">{loading ? '·' : years.size}</div>
              <div className="src">earliest dated plate on</div>
            </div>
          </div>
        </div>
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

      {!loading && featured.length > 0 && (
        <div className="pr-featured">
          <div className="module">
            <div className="mhead"><h2>Featured</h2><span className="sub">picked out by a moderator</span></div>
            <div className="wall feature-wall">
              {featured.map((m, i) => (
                <MediaTile key={m.id} item={m} onOpen={openFeatured} size={i === 0 ? 'feature' : undefined} />
              ))}
            </div>
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
        <>
          <main className="pr-record">
            <div className="module">
              <div className="mhead">
                <h2>From the Record</h2>
                <span className="sub">{record.length} recovered before the links died</span>
              </div>
              <p className="note">
                These came off Photobucket and imgur, where most of them were one
                outage away from being gone. Open any of them for the date, the
                names still legible in the shot, and the address it was pulled from.
              </p>
              <MediaGrid items={recordPage} onOpen={openItem} className="filmstrip" />
              {recordHits.length > shown && (
                <div className="more">
                  <button className="btn" onClick={() => setShown((n) => n + PAGE)}>Show more</button>
                  <span className="more-n">showing {shown} of {recordHits.length}</span>
                </div>
              )}
            </div>
          </main>

          <aside className="pr-rail">
            <div className="module">
              <div className="mhead">
                <h2>From Members</h2>
                <span className="sub">{members.length} on the wall</span>
              </div>

              {railFeatured ? (
                <>
                  <div className="railfeat">
                    <MediaTile item={railFeatured} onOpen={openRail} />
                  </div>
                  {railRest.length > 0 && (
                    <div className="railrest">
                      {railRest.map((m) => <MediaTile key={m.id} item={m} onOpen={openRail} />)}
                    </div>
                  )}
                </>
              ) : (
                <p className="note">
                  Nothing on the wall yet. The half beside this one survived on
                  its own, so this one is up to us. Anything you still have from
                  back then belongs here.
                </p>
              )}

              <div className="railcta">
                {me
                  ? <button className="btn primary" onClick={() => setDrawer(true)}>Submit a screenshot</button>
                  : <SteamButton me={me} signIn={signIn} />}
                <p className="railterms">
                  {me
                    ? 'An admin checks every submission in. By submitting you grant Coldstream Gaming permission to feature the image.'
                    : 'Sign in through Steam to add to the wall. An admin checks each one in before it goes up.'}
                </p>
              </div>
            </div>
          </aside>
        </>
      )}

      <div className="pr-wall">
        {!loading && browsing && breakout && (
          <div className="module">
            <div className="mhead">
              <h2>The Members' Wall</h2>
              <span className="sub">{memberHits.length} items</span>
            </div>
            <MediaGrid items={memberPage} onOpen={openItem} />
            {memberHits.length > shown && (
              <div className="more">
                <button className="btn" onClick={() => setShown((n) => n + PAGE)}>Show more</button>
                <span className="more-n">showing {shown} of {memberHits.length}</span>
              </div>
            )}
          </div>
        )}

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
