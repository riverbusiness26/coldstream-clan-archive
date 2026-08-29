// The gallery. Two halves that are deliberately kept apart, and one way of
// looking at anything in either.
//
// "From the Record" is the recovered material: screenshots pulled back off
// Photobucket and imgur before the links died for good. Every one of them
// carries its date, the names legible in it, and the address it came from,
// because the whole point of the record is that you can check it.
//
// "From Members" is the live half: anything a signed-in member adds. Those
// land unapproved and a moderator clears them, so the two can never be
// confused for each other.
//
// The layout is River's ref (Site refs/website/games.png): the record on the
// left, members in a rail on the right under one button. What the ref does not
// show is what happens when the members' half outgrows a 336px rail, so above
// RAIL_HOLDS approved items the wall breaks out full width underneath both
// columns and the rail keeps the newest plate and the button.
//
// A note on the recovered half, so nobody wires it to the wrong thing: it is
// the seed at src/seed/gallery.json, rendered on the client. The locked
// 'the-archive' category in gallery_category is a different object, it is
// empty, and nothing here reads from it.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supa } from '../lib/supa';
import type { Me } from '../lib/auth';
import SteamButton from '../components/SteamButton';
import PlateViewer from '../components/PlateViewer';
import UploadDrawer from '../components/UploadDrawer';
import { one } from '../lib/rel';
import shotsSeed from '../seed/gallery.json';
import { demoGallery } from '../lib/demoGallery';
import { asset } from '../lib/asset';
import type { Plate } from '../lib/gallery';
import { BROWSE_CATEGORIES, categoryBySlug, youtubeThumb } from '../lib/gallery';

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
  width?: number | null;
  height?: number | null;
  approved: boolean;
  created_at: string;
  uploader?: { display_name: string } | { display_name: string }[] | null;
}

const SHOTS = shotsSeed as Shot[];
const BUCKET = 'gallery';

// How many approved uploads the rail will hold before the wall breaks out on
// its own. Four is what fits beside the record column without the rail turning
// into a second, narrower gallery.
const RAIL_HOLDS = 4;

const UNDATED = 'undated';

const shotYear = (s: Shot) => (s.date ? s.date.slice(0, 4) : s.year ? String(s.year) : null);

// Aspect ratio for a tile. Unknown dimensions fall back to 16:9, which is what
// every row written before width and height were being saved will have.
const ratio = (w: number | null | undefined, h: number | null | undefined) =>
  w && h ? w / h : 1.7778;

const publicUrl = (k: string | null) =>
  !k ? '' : k.startsWith('data:') ? k : supa ? supa.storage.from(BUCKET).getPublicUrl(k).data.publicUrl : '';

function toMemberPlate(u: Upload): Plate {
  const video = u.media_type === 'video' && !!u.video_id;
  return {
    key: u.id,
    kind: 'member',
    src: video ? youtubeThumb(u.video_id as string) : publicUrl(u.storage_key),
    // A YouTube poster frame is 16:9 whatever the film is, so it is stated
    // rather than left to the fallback that happens to agree with it.
    w: video ? 480 : u.width ?? null,
    h: video ? 270 : u.height ?? null,
    caption: u.caption || (u.media_type === 'video' ? 'A film' : 'A screenshot'),
    media: u.media_type,
    videoId: u.video_id,
    game: u.game,
    year: u.year,
    by: one(u.uploader)?.display_name ?? 'member',
  };
}

// Every picture on the page is one of these, and every one of them opens the
// viewer on the list it was rendered from.
function Tile({ list, i, onOpen, children }: {
  list: Plate[]; i: number; onOpen: (list: Plate[], i: number) => void; children?: React.ReactNode;
}) {
  const p = list[i];
  return (
    <button className="frame" onClick={() => onOpen(list, i)}
      style={{ '--ar': ratio(p.w, p.h) } as React.CSSProperties}
      aria-label={`Open: ${p.caption}`}>
      <img src={asset(p.src)} alt={p.caption} loading="lazy"
        width={p.w ?? undefined} height={p.h ?? undefined} />
      {p.media === 'video' && <span className="playmark2" aria-hidden="true" />}
      {children}
      <span className="frame-cap">
        <b>{p.caption}</b>
        <span>
          {p.kind === 'record'
            ? `${p.date ? p.date.slice(0, 4) : UNDATED}${p.who && p.who.length > 0 ? ` · ${p.who.length} ${p.who.length === 1 ? 'name' : 'names'}` : ''}`
            : `${p.by}${p.year ? ` · ${p.year}` : ''}`}
        </span>
      </span>
    </button>
  );
}

export default function Gallery({ me, signIn }: { me: Me | null; signIn: () => void }) {
  const [uploads, setUploads] = useState<Upload[] | null>(null);
  const [catIds, setCatIds] = useState<Record<string, string>>({});

  // One filter per half, each living inside the module it governs. The old
  // page had a single year filter that quietly reached across both halves
  // while the category and kind chips reached across only one, so the toolbar
  // read as global and was not.
  const [recordYear, setRecordYear] = useState<string>('all');
  const [browse, setBrowse] = useState<string>('all');
  const [kind, setKind] = useState<'all' | 'image' | 'video'>('all');
  const [memberYear, setMemberYear] = useState<string>('all');

  // The viewer is handed the list that was rendered, never a global one.
  const [viewing, setViewing] = useState<{ list: Plate[]; i: number } | null>(null);
  const [drawer, setDrawer] = useState(false);

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

  const categorySlugById = useCallback((id: string | null): string | null => {
    if (!id) return null;
    const hit = Object.entries(catIds).find(([, v]) => v === id);
    return hit ? hit[0] : null;
  }, [catIds]);

  const open = useCallback((list: Plate[], i: number) => setViewing({ list, i }), []);

  // ------------------------------------------------------------ the record
  const recordYears = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of SHOTS) {
      const y = shotYear(s) ?? UNDATED;
      counts.set(y, (counts.get(y) ?? 0) + 1);
    }
    // Undated last, whatever it sorts as.
    return [...counts.entries()].sort((a, b) =>
      a[0] === UNDATED ? 1 : b[0] === UNDATED ? -1 : a[0].localeCompare(b[0]));
  }, []);

  const recordPlates: Plate[] = useMemo(() => SHOTS
    .filter((s) => recordYear === 'all' || (shotYear(s) ?? UNDATED) === recordYear)
    .map((s) => ({
      key: s.src,
      kind: 'record' as const,
      src: s.src,
      w: s.w, h: s.h,
      caption: s.caption,
      media: 'image' as const,
      videoId: null,
      game: s.game,
      year: s.date ? Number(s.date.slice(0, 4)) : s.year,
      date: s.date,
      who: s.who,
      source: s.source,
    })), [recordYear]);

  // ----------------------------------------------------------- the members
  const approvedRows = useMemo(
    () => (uploads ?? []).filter((u) => u.approved),
    [uploads]);
  const approvedPlates = useMemo(
    () => approvedRows.map(toMemberPlate),
    [approvedRows]);

  const memberYears = useMemo(() => {
    const ys = new Set<string>();
    for (const u of approvedRows) if (u.year) ys.add(String(u.year));
    return [...ys].sort();
  }, [approvedRows]);

  const nShots = approvedRows.filter((u) => u.media_type === 'image').length;
  const nFilms = approvedRows.filter((u) => u.media_type === 'video').length;

  const wallPlates = useMemo(() => approvedRows
    .filter((u) => (browse === 'all' || (u.category_slug ?? categorySlugById(u.category_id)) === browse)
      && (kind === 'all' || u.media_type === kind)
      && (memberYear === 'all' || String(u.year ?? '') === memberYear))
    .map(toMemberPlate),
  [approvedRows, browse, kind, memberYear, categorySlugById]);

  const featured = approvedPlates[0] ?? null;
  const breakout = approvedPlates.length > RAIL_HOLDS;
  const railRest = breakout ? [] : approvedPlates.slice(1);

  const pending = (uploads ?? []).filter((u) => !u.approved);
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
    <div className="wrap plateroom">
      {/* The page says what it is before any module does, the same way the
          Archive does. These are siblings: one is the record of the community,
          this is the record of what it looked like. */}
      <div className="page-head">
        <h2>The Gallery</h2>
        <p className="page-sub">The plate room.</p>
      </div>

      <main className="pr-record">
        <div className="module">
          <div className="mhead">
            <h3>From the Record</h3>
            <span className="sub">
              {recordYear === 'all'
                ? `${SHOTS.length} recovered before the links died`
                : `${recordPlates.length} of ${SHOTS.length}, ${recordYear === UNDATED ? 'undated' : `from ${recordYear}`}`}
            </span>
          </div>
          <div className="note">
            These came off Photobucket and imgur, where most of them were one
            outage away from being gone. Open any of them for the date, the
            names still legible in the shot, and the address it was pulled from.
          </div>
          {/* Years, not games. All twelve recovered plates are the same game,
              so a game chip row would be a row of one. When the recovered set
              grows past Warband this is where the game chips go. */}
          <div className="chips">
            <button className={'chip' + (recordYear === 'all' ? ' on' : '')}
              onClick={() => setRecordYear('all')}>
              All<span className="chip-n">{SHOTS.length}</span>
            </button>
            {recordYears.map(([y, n]) => (
              <button key={y} className={'chip' + (recordYear === y ? ' on' : '')}
                onClick={() => setRecordYear(y)}>
                {y === UNDATED ? 'Undated' : y}<span className="chip-n">{n}</span>
              </button>
            ))}
          </div>
          <div className="filmstrip">
            {recordPlates.map((p, i) => <Tile key={p.key} list={recordPlates} i={i} onOpen={open} />)}
          </div>
        </div>
      </main>

      <aside className="pr-rail">
        <div className="module">
          <div className="mhead">
            <h3>From Members</h3>
            <span className="sub">
              {uploads === null ? 'loading' : `${approvedPlates.length} on the wall`}
            </span>
          </div>

          {featured
            ? (
              <>
                <div className="railfeat">
                  <Tile list={approvedPlates} i={0} onOpen={open} />
                </div>
                {railRest.length > 0 && (
                  <div className="railrest">
                    {railRest.map((p, i) => <Tile key={p.key} list={approvedPlates} i={i + 1} onOpen={open} />)}
                  </div>
                )}
              </>
            )
            : (
              <div className="note">
                {uploads === null
                  ? 'Loading.'
                  : 'Nothing on the wall yet. The half beside this one survived on its own, so this one is up to us. Anything you still have from back then belongs here.'}
              </div>
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

      <div className="pr-wall">
        {/* The wall only appears once the rail cannot hold the set, and it
            brings its own filters with it. Below that there is nothing for a
            filter to do, so there is no filter. */}
        {breakout && (
          <div className="module">
            <div className="mhead">
              <h3>The Members' Wall</h3>
              <span className="sub">
                {wallPlates.length} {kind === 'image' ? (wallPlates.length === 1 ? 'screenshot' : 'screenshots')
                  : kind === 'video' ? (wallPlates.length === 1 ? 'film' : 'films')
                    : (wallPlates.length === 1 ? 'item' : 'items')}
                {browse === 'all' ? '' : ' in ' + categoryBySlug(browse)?.name}
              </span>
            </div>
            <div className="seg" style={{ margin: '0 16px 10px' }}>
              <button className={'segbtn' + (kind === 'all' ? ' on' : '')}
                onClick={() => setKind('all')}>Everything ({nShots + nFilms})</button>
              <button className={'segbtn' + (kind === 'image' ? ' on' : '')}
                onClick={() => setKind('image')}>Screenshots ({nShots})</button>
              <button className={'segbtn' + (kind === 'video' ? ' on' : '')}
                onClick={() => setKind('video')}>Films ({nFilms})</button>
            </div>
            <div className="chips">
              <button className={'chip' + (browse === 'all' ? ' on' : '')}
                onClick={() => setBrowse('all')}>Everything</button>
              {BROWSE_CATEGORIES.map((c) => (
                <button key={c.slug} className={'chip' + (browse === c.slug ? ' on' : '')}
                  onClick={() => setBrowse(c.slug)}>{c.name}</button>
              ))}
              {memberYears.length > 1 && (
                <>
                  <span className="chipsep" aria-hidden="true" />
                  <button className={'chip' + (memberYear === 'all' ? ' on' : '')}
                    onClick={() => setMemberYear('all')}>Any year</button>
                  {memberYears.map((y) => (
                    <button key={y} className={'chip' + (memberYear === y ? ' on' : '')}
                      onClick={() => setMemberYear(y)}>{y}</button>
                  ))}
                </>
              )}
            </div>
            {browse !== 'all' && (
              <div className="note">{categoryBySlug(browse)?.description}</div>
            )}
            {wallPlates.length === 0
              ? <div className="note">Nothing on the wall matches that. Widen it and they come back.</div>
              : (
                <div className="wall">
                  {wallPlates.map((p, i) => (
                    <Tile key={p.key} list={wallPlates} i={i} onOpen={open}>
                      {canModerate && (
                        <span className="modrow" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                          <button className="btn sm" onClick={() => reject(p.key, approvedRows.find((u) => u.id === p.key)?.storage_key ?? null)}>Remove</button>
                        </span>
                      )}
                    </Tile>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* The queue is its own module now. It used to be a dimmed strip under
            the wall that everybody scrolled past, on a page where most people
            have nothing to moderate. */}
        {pending.length > 0 && (
          <div className="module">
            <div className="mhead">
              <h3>{canModerate ? 'Waiting to be checked in' : 'Waiting on an admin'}</h3>
              <span className="sub">{pending.length} held</span>
            </div>
            <div className="note">
              {canModerate
                ? 'Approve puts it on the wall for everyone. Deny removes it and its file.'
                : 'An admin looks over everything before it joins the wall.'}
            </div>
            <div className="wall pending">
              {pending.map((u) => {
                const p = toMemberPlate(u);
                return (
                  <div className="frame" key={u.id}
                    style={{ '--ar': ratio(p.w, p.h) } as React.CSSProperties}>
                    <img src={asset(p.src)} alt={p.caption} loading="lazy" />
                    {p.media === 'video' && <span className="playmark2" aria-hidden="true" />}
                    <span className="frame-cap"><b>{p.caption}</b><span>{p.by} · held</span></span>
                    {canModerate && (
                      <span className="modrow">
                        <button className="btn sm" onClick={() => approve(u.id)}>Approve</button>
                        <button className="btn sm" onClick={() => reject(u.id, u.storage_key)}>Deny</button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {viewing && (
        <PlateViewer
          list={viewing.list}
          index={viewing.i}
          onIndex={(i) => setViewing((v) => (v ? { ...v, i } : v))}
          onClose={() => setViewing(null)}
        />
      )}

      {drawer && me && (
        <UploadDrawer me={me} catIds={catIds}
          onClose={() => setDrawer(false)}
          onUploaded={loadUploads} />
      )}
    </div>
  );
}
