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
// The plate is sky, land and crest only. "WE'RE BACK.", the motto and the
// button are real HTML, so they reflow, they scale with the viewport, they
// are selectable, they are readable by a screen reader, and they never end
// up sliced in half by a crop. An earlier mockup had the type burned into
// the image and it could not survive a phone.
//
// Two plates, not one scaled plate. The desktop file is 3:2 and the mobile
// file is 9:16, swapped by <picture>. `contain` was rejected deliberately:
// letterboxing a splash screen makes it feel like an image viewer rather
// than a front door, so both plates are `cover` and each is composed for the
// shape it serves.
import { asset } from '../lib/asset';
import type { Me } from '../lib/auth';

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
        <h1>WE&rsquo;RE BACK.</h1>
        {/* The rules and arrowheads either side are chrome, not content, so
            they are empty elements a screen reader never has to announce. */}
        <p className="splash-motto">
          <i aria-hidden="true" />
          <span>Second to none.</span>
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
          Enter the Site
        </a>
      </div>
    </div>
  );
}
