// The front door. One plate of artwork, three lines of type, one way in.
//
// What this replaced, so nobody re-does it by accident: this view used to run
// four curated YouTube segments full screen, double buffered with a crossfade.
// That version is in git and is worth reading before reviving it, because it
// solved real problems (no black flash, no spinner, reduced motion handling).
// River asked for the sunset plate instead. The film reel did not survive the
// change; the reasoning for the cut is River's call, not a defect.
//
// The rule that shapes this file: **nothing is baked into the artwork.**
// The plate is sky and land. The crest, "WE'RE BACK.", the motto and the
// button are all real elements, so they reflow, they scale with the
// viewport, the type is selectable and readable by a screen reader, and
// none of it ends up sliced in half by a crop. An earlier mockup had the
// type burned into the image and it could not survive a phone.
//
// The crest was the second thing to come out of the plate, and for a
// concrete reason: painted in, it was whatever size the crop made it, about
// 36 percent of the viewport width, and River wanted it smaller. With the
// plate as the only lever the options were all bad, because `cover` already
// shows as little of the image as it can. As an element it is one number.
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
        {/* The crest is an element, not part of the plate, for the same
            reason the headline is. Baked in, its size was whatever the crop
            made it, roughly 36 percent of the viewport with no way to change
            that short of new artwork. Here it is a number in the CSS. */}
        <img className="splash-crest" src={asset('/crest.webp')} alt="" fetchPriority="high" width={900} height={920} />
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
