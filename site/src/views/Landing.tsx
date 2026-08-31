// The front door. One plate of artwork, three lines of type, one way in.
//
// What this replaced, so nobody re-does it by accident: this view used to run
// four curated YouTube segments full screen, double buffered with a crossfade.
// That version is in git and is worth reading before reviving it, because it
// solved real problems (no black flash, no spinner, reduced motion handling).
// River asked for the sunset plate instead. The film reel did not survive the
// change; the reasoning for the cut is River's call, not a defect.
//
// The rule that shapes this file: **no words are baked into the artwork.**
// The plate is sky and land. The crest, the headline, the motto and the
// button are all real elements, so they reflow, they scale with the
// viewport, the type is selectable and readable by a screen reader, and
// none of it ends up sliced in half by a crop.
//
// There was a middle version, between c2bb632 and here, where the headline
// and motto shipped as one engraved bitmap and the button as another. It
// looked better and it could not survive a phone: an image scales but it
// cannot reflow, so at a 375px viewport the lockup came down to about 330px
// wide and the motto inside it to roughly seventeen pixels tall, with the
// line break painted in and no way to wrap. Live type holds its size and
// wraps instead. The trade, stated plainly rather than discovered later: the
// engraved stone texture, the bevels and the drawn leaf ornaments are
// painted effects that CSS cannot reach, so the fill below is a clipped
// gradient and the flourishes are drawn rules. It approximates the artwork.
// It does not reproduce it. That was the price of the two things River asked
// for, which were responsive and editable.
//
// Two plates, not one scaled plate. The desktop file is 3:2 and the mobile
// file is 9:16, swapped by <picture>. `contain` was rejected deliberately:
// letterboxing a splash screen makes it feel like an image viewer rather
// than a front door, so both plates are `cover` and each is composed for the
// shape it serves.
import { asset } from '../lib/asset';
import type { Me } from '../lib/auth';

// The whole of the front door's copy, in one place, so changing what it says
// is an edit to three strings rather than a hunt through markup. It lives
// here and not in lib/content because content imports news.json, and the
// splash is the first thing every visitor downloads.
//
// This is as editable as it gets without a deploy in the loop: a change here
// still needs a build and a push. The version River can edit from the admin
// panel is the same three strings read from the database, which is a small
// job on top of the pattern Admin.tsx already uses for news, and it is
// waiting on migration 0017 being run.
export const copy = {
  headline: 'WE’RE BACK.',
  motto: 'Second to none.',
  enter: 'Enter the Site',
};

export default function Landing({ go }: { me: Me | null; go: (v: string) => void; signIn: () => void }) {
  return (
    <div className="splash">
      {/* Decorative. Every word a reader needs is in the markup below, so
          announcing the plate would only repeat it. */}
      <picture className="splash-art">
        <source
          media="(max-width: 820px) and (orientation: portrait)"
          srcSet={asset('/landing-mobile.jpg')}
        />
        <img src={asset('/landing-desktop.jpg')} alt="" fetchPriority="high" />
      </picture>

      <div className="splash-scrim" aria-hidden="true" />

      <div className="splash-copy">
        {/* The crest is an element, not part of the plate, for the same
            reason the headline is. Baked in, its size was whatever the crop
            made it, roughly 36 percent of the viewport with no way to change
            that short of new artwork. Here it is a number in the CSS. */}
        <img className="splash-crest" src={asset('/crest.webp')} alt="" fetchPriority="high" width={900} height={920} />
        <h1>{copy.headline}</h1>
        {/* The rules and arrowheads either side are chrome, not content, so
            they are empty elements a screen reader never has to announce. */}
        <p className="splash-motto">
          <i aria-hidden="true" />
          <span>{copy.motto}</span>
          <i aria-hidden="true" />
        </p>
        {/* A real anchor, not a button: it has an href, so it opens in a new
            tab on middle click and survives JavaScript failing to boot. The
            handler only adds the scroll reset that `go` does. */}
        <a
          className="splash-enter"
          href="#/home"
          onClick={(e) => { e.preventDefault(); go('home'); }}
        >
          {copy.enter}
        </a>
      </div>
    </div>
  );
}
