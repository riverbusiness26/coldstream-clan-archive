// The front page.
//
// Rebuilt 28 Aug 2026 against "Site refs/website". What came off, on River's
// call: the news blurb, the shoutbox, the next event module, and the Join tab
// with them. Between them they filled the page with boxes that were either
// empty, historical, or asking the visitor for something before the page had
// told them anything.
//
// What is left is the shape the reference mockups actually show, and the rule
// behind it is that every block answers one question a visitor really asks:
//
//   who are you            the hero, and the crest that spans every era
//   what do you play       the games, in the community's own words
//   is anyone about        Discord, and who is on Steam right now
//   can I play tonight     the servers, live
//   are you for real       the numbers, off the archive
//
// Nothing here is invented copy and nothing here is a placeholder. If a
// module has no data it says so plainly rather than pretending.
import { GAME_NAMES } from '../lib/games';
import summary from '../seed/summary.json';
import { useLiveServers } from '../lib/useLiveServers';
import MembersOnline from '../components/MembersOnline';
import Discord from '../components/Discord';
import type { Me } from '../lib/auth';
import { asset } from '../lib/asset';

// The eras, in the wording from the reference mockup rather than anything
// written here. These are the four the community is actually known for; the
// full run of games lives in the Archive, which is where the record belongs.
const ERAS: [string, string][] = [
  ['Mount and Blade: Warband', 'sword lines and saddle nights'],
  ['Holdfast: Nations At War', 'line battles and bugles'],
  ['Planetside 2', 'continents and combined arms'],
  ['Arma and Squad', 'realism, coordination, and trust'],
];

export default function Home({ go }: { me: Me | null; go: (v: string) => void; signIn: () => void }) {
  const servers = useLiveServers();

  return (
    <>
      {/* The crest art carries the whole pitch on its own: one badge over
          medieval, Napoleonic, modern and science fiction at once. It says
          "we have played all of this" faster than a paragraph can. */}
      <section className="hero">
        <img className="bg" src={asset('/hero-csg.jpg')} alt="" />
        <div className="scrim" />
        <div className="in">
          <div className="hero-eyebrow">Established 2011 · Second to None</div>
          <h2 className="hero-title">Coldstream Gaming</h2>
          <p>
            Fifteen years, one community, and a long list of games behind us.
            Muskets to retakes and most things in between. The games changed.
            We did not.
          </p>
          <div className="cta">
            <button className="btn primary" onClick={() => go('archive')}>The Archive</button>
            <button className="btn" onClick={() => go('servers')}>Servers</button>
            <button className="btn" onClick={() => go('gallery')}>Gallery</button>
          </div>
        </div>
      </section>

      <div className="wrap">
        <main>
          <div className="module">
            <div className="mhead"><h3>The Games</h3><span className="sub">what we have played, and still do</span></div>
            <ul className="eralist">
              {ERAS.map(([name, note]) => (
                <li className="eraline" key={name}>
                  <span className="eraline-name">{name}</span>
                  <span className="eraline-note">{note}</span>
                </li>
              ))}
            </ul>
            <div className="note">
              Every game, every era and every night on the calendar is in <button className="lnk" onClick={() => go('archive')}>the Archive</button>.
            </div>
          </div>

          <div className="module">
            <div className="mhead"><h3>Servers</h3><span className="sub">live status</span></div>
            {servers.length === 0 ? (
              <div className="note">No servers are published yet.</div>
            ) : (
              <div className="srv-grid">
                {servers.map((s) => (
                  <div className="srv" key={s.server_key}>
                    <div className="srv-top">
                      <span className="srv-game"><span className="gtag">{s.game}</span>{GAME_NAMES[s.game] ?? s.game}</span>
                      <span className={'pill' + (s.online ? ' live' : '')}>{s.online ? `${s.players}/${s.max_players}` : 'OFFLINE'}</span>
                    </div>
                    <div className="srv-name">{s.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <aside>
          <Discord />
          <MembersOnline />
          <div className="module">
            <div className="mhead"><h3>The Numbers</h3><span className="sub">off the record</span></div>
            <div className="stats">
              <div className="stat"><div className="n">{summary.people}</div><div className="l">members on the roll</div></div>
              <div className="stat"><div className="n">{summary.events}</div><div className="l">events on record</div></div>
              <div className="stat"><div className="n">2011</div><div className="l">established</div></div>
              <div className="stat"><div className="n">15</div><div className="l">years running</div></div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
