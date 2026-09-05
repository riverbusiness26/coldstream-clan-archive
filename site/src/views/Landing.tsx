// The front door. One plate of artwork, three lines of type, one way in.
//
// What this replaced, so nobody re-does it by accident: this view used to run
// four curated YouTube segments full screen, double buffered with a crossfade.
// That version is in git and is worth reading before reviving it, because it
// solved real problems (no black flash, no spinner, reduced motion handling).
// River asked for the sunset plate instead. The film reel did not survive the
// change; the reasoning for the cut is River's call, not a defect.
//
// The plate stays text-free. The crest, engraved wordmark and entry plaque
// are separate elements, so the background can keep its two responsive crops
// and the crest can still be sized without regenerating the landscape.
// River chose the engraved image treatment after comparing it with live type.
// The trade is deliberate: the painted words scale rather than reflow, but
// retain the bevels, stone texture and leaf ornaments that CSS cannot match.
//
// Two plates, not one scaled plate. The desktop file is 3:2 and the mobile
// file is 9:16, swapped by <picture>. `contain` was rejected deliberately:
// letterboxing a splash screen makes it feel like an image viewer rather
// than a front door, so both plates are `cover` and each is composed for the
// shape it serves.
import { asset } from '../lib/asset';
import type { Me } from '../lib/auth';

const DISCORD = 'https://discord.gg/75sfq5VPY';

export default function Landing({ me, go, signIn }: { me: Me | null; go: (v: string) => void; signIn: () => void }) {
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
        {/* The words stay in the accessibility tree through the image alt.
            Headline and motto remain one asset because their engraved spacing
            and flourishes are part of the chosen artwork. */}
        <h1 className="splash-wordmark">
          <img src={asset('/wordmark.webp')} alt="We&rsquo;re back. Second to none."
               width={2087} height={392} fetchPriority="high" />
        </h1>
        <div className="splash-actions">
          <a className="splash-choice join" href={DISCORD} target="_blank" rel="noopener">Join us!</a>
          <button className="splash-choice login" type="button" onClick={() => me ? go('home') : signIn()}>Member Login</button>
        </div>
        <p className="splash-access-note">Member, Moderator or Admin role required.</p>
      </div>
    </div>
  );
}
