// Discord's own widget, embedded.
//
// This replaced a hand built panel that read widget.json and drew the member
// list itself. River asked for the official embed, and it is the better call
// for a reason worth writing down: the custom one could only ever show what
// widget.json exposes, while Discord's own frame carries the live channel
// list, voice presence and a working join button, and Discord keeps it
// working when they change things underneath.
//
// Two things this needs that are easy to miss. The site's Content Security
// Policy has to name discord.com in frame-src, or the browser refuses the
// frame and leaves an empty box explaining itself only in the console. And
// the widget has to be enabled in Server Settings, Widget, or Discord serves
// a "Widget Disabled" panel to everyone whatever we write here.
//
// The pulse in the status bar at the top of every page is separate and still
// reads widget.json directly. That is one small request and does not need a
// frame.
const GUILD_ID = '669723836165521413';
const INVITE = 'https://discord.gg/75sfq5VPY';

export default function Discord() {
  return (
    <div className="module">
      <div className="mhead">
        <h3>Discord</h3>
        <a className="ilink" href={INVITE} target="_blank" rel="noopener">Join the server</a>
      </div>
      <div className="dscframe">
        <iframe
          src={`https://discord.com/widget?id=${GUILD_ID}&theme=dark`}
          title="Coldstream Gaming on Discord"
          height={500}
          // Discord's own recommended sandbox, and deliberately not wider:
          // no allow-forms and no allow-top-navigation, so the frame cannot
          // submit anything or steer the page out from under the member.
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          loading="lazy"
        />
      </div>
    </div>
  );
}
