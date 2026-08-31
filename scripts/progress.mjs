import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const boardPath = path.join(root, 'progress', 'board.json');
const outPath = path.join(root, 'progress', 'index.html');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function gitChanges() {
  try {
    const format = '%H%x1f%aI%x1f%an%x1f%s%x1e';
    const raw = execFileSync('git', ['log', '-24', `--pretty=format:${format}`], {
      cwd: root,
      encoding: 'utf8',
    });
    return raw.split('\x1e').map((row) => row.trim()).filter(Boolean).map((row) => {
      const [hash, at, author, title] = row.split('\x1f');
      return { hash: hash.slice(0, 7), at, author, title };
    }).filter((item) => !item.title.includes('refresh the progress board'));
  } catch {
    return [];
  }
}

function statusLabel(status) {
  return ({ todo: 'Queued', doing: 'In progress', blocked: 'Blocked', done: 'Done' })[status] ?? status;
}

function laneIcon(id) {
  const icons = {
    website: '<circle cx="12" cy="12" r="8"/><path class="accent" d="M4 12h16M12 4c2.2 2.3 3.4 5 3.4 8S14.2 17.7 12 20c-2.2-2.3-3.4-5-3.4-8S9.8 6.3 12 4Z"/>',
    'game-servers': '<rect x="4" y="4" width="16" height="6" rx="1"/><rect x="4" y="14" width="16" height="6" rx="1"/><path class="accent" d="M8 7h.01M8 17h.01M12 7h5M12 17h5"/>',
    discord: '<path d="M5 5h14v11H9l-4 4v-4H5Z"/><path class="accent" d="M9 10h.01M15 10h.01M9 13h6"/>',
    graphics: '<path d="M4 4h16v16H4Z"/><path class="accent" d="m12 6 1.4 3.2L17 10.5l-3 2.1.8 3.6-2.8-2.1-2.8 2.1.8-3.6-3-2.1 3.6-1.3Z"/>',
    archive: '<path d="M4 8h16v12H4Z"/><path d="M3 4h18v5H3Z"/><path class="accent" d="M9 12h6"/>',
    '2nd-coldstream': '<path d="M12 3 19 6v5c0 4.7-2.7 7.8-7 10-4.3-2.2-7-5.3-7-10V6Z"/><path class="accent" d="M8 10h8M12 6v9"/>',
    'training-map': '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path class="accent" d="M9 3v15M15 6v15M12 9h.01M12 9c0 2-2 2.2-2 4"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[id] ?? icons.website}</svg>`;
}

function laneMarkup(lane, tasks) {
  const laneTasks = tasks.filter((task) => task.lane === lane.id);
  const done = laneTasks.filter((task) => task.status === 'done').length;
  const total = laneTasks.length;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const ordered = [...laneTasks].sort((a, b) => {
    const order = { doing: 0, blocked: 1, todo: 2, done: 3 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });
  const items = ordered.length ? ordered.map((task) => `
    <li class="task task-${escapeHtml(task.status)}">
      <span class="task-state" aria-label="${escapeHtml(statusLabel(task.status))}"></span>
      <span class="task-copy"><b>${escapeHtml(task.title)}</b>${task.note ? `<small>${escapeHtml(task.note)}</small>` : ''}</span>
      <span class="task-label">${escapeHtml(statusLabel(task.status))}</span>
    </li>`).join('') : `
    <li class="lane-empty"><b>Ready for the first entry.</b><span>Tell Codex what belongs here and it will appear on the next refresh.</span></li>`;

  return `
  <article class="lane" data-lane="${escapeHtml(lane.id)}" data-status="${total ? 'active' : 'empty'}" data-static-done="${done}" data-static-total="${total}">
    <header class="lane-head">
      <span class="lane-code">${laneIcon(lane.id)}</span>
      <span class="lane-title"><b>${escapeHtml(lane.label)}</b><small>${escapeHtml(lane.description)}</small></span>
      <span class="lane-actions"><span class="lane-count"><b>${done}/${total}</b><small>complete</small></span><button class="lane-add" type="button" data-add-lane="${escapeHtml(lane.id)}" aria-label="Add a task to ${escapeHtml(lane.label)}">+</button></span>
    </header>
    <div class="rail" aria-label="${progress}% complete"><i style="width:${progress}%"></i></div>
    <ul class="tasks" data-task-list>${items}</ul>
  </article>`;
}

function activityMarkup(board, changes) {
  const taskActivity = [...(board.history ?? [])].reverse().slice(0, 8).map((item) => ({
    at: item.at,
    title: item.text,
    meta: board.lanes.find((lane) => lane.id === item.lane)?.label ?? 'Board',
    kind: 'board',
  }));
  const commitActivity = changes.slice(0, 14).map((item) => ({
    at: item.at,
    title: item.title.replace(/^(codex|claude|river):\s*/i, ''),
    meta: `${item.author} · ${item.hash}`,
    kind: 'change',
  }));
  return [...taskActivity, ...commitActivity]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 14)
    .map((item) => `<li><i class="activity-mark ${item.kind}"></i><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.meta)} · <time datetime="${escapeHtml(item.at)}">${escapeHtml(item.at)}</time></small></span></li>`)
    .join('');
}

const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const changes = gitChanges();
const total = board.tasks.length;
const done = board.tasks.filter((task) => task.status === 'done').length;
const doing = board.tasks.filter((task) => task.status === 'doing').length;
const blocked = board.tasks.filter((task) => task.status === 'blocked').length;
const queued = board.tasks.filter((task) => task.status === 'todo').length;
const completion = total ? Math.round((done / total) * 100) : 0;
const lanes = board.lanes.map((lane) => laneMarkup(lane, board.tasks)).join('');
const activity = activityMarkup(board, changes);
const laneOptions = board.lanes.map((lane) => `<option value="${escapeHtml(lane.id)}">${escapeHtml(lane.label)}</option>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#111315">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(board.title)}</title>
  <style>
    @font-face{font-family:Cormorant;src:url('/fonts/cormorant-garamond-latin.woff2') format('woff2');font-weight:300 700;font-display:swap}
    @font-face{font-family:Satoshi;src:url('/fonts/satoshi-400.woff2') format('woff2');font-weight:400;font-display:swap}
    @font-face{font-family:Satoshi;src:url('/fonts/satoshi-500.woff2') format('woff2');font-weight:500;font-display:swap}
    @font-face{font-family:Satoshi;src:url('/fonts/satoshi-700.woff2') format('woff2');font-weight:700;font-display:swap}
    :root{--ground:#121416;--panel:#1b1f22;--raised:#24292c;--line:#0a0c0d;--hair:#343a3e;--brass:#b08d57;--ink:#e8eae6;--muted:#9aa19a;--faint:#6b716c;--frost:#c5d0d8;--navy:#1a2740;--display:Cormorant,Georgia,serif;--body:Satoshi,'Segoe UI',sans-serif}
    *{box-sizing:border-box}html{background:var(--ground);color:var(--ink);font-family:var(--body)}body{margin:0;min-height:100vh;background:radial-gradient(circle at 48% -20%,rgba(197,208,216,.055),transparent 36%),repeating-linear-gradient(100deg,rgba(255,255,255,.009) 0,rgba(255,255,255,.009) 1px,transparent 1px,transparent 5px),var(--ground)}
    body:before{content:'';position:fixed;inset:0;pointer-events:none;opacity:.15;background-image:repeating-radial-gradient(circle at 30% 40%,rgba(255,255,255,.08) 0,rgba(255,255,255,.08) .45px,transparent .65px,transparent 3px);mix-blend-mode:soft-light}
    button,input,select{font:inherit}button{color:inherit}.shell{width:min(100%,1800px);margin:auto;padding:clamp(18px,2.2vw,36px)}
    .top{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:20px;padding-bottom:22px;border-bottom:1px solid var(--line)}
    .seal{width:74px;height:74px;display:grid;place-items:center;border:1px solid var(--hair);background:rgba(10,12,13,.48);position:relative}.seal:after{content:'';position:absolute;inset:5px;border:1px solid rgba(197,208,216,.12)}.seal img{width:68px;height:68px;object-fit:contain;position:relative;z-index:1}
    .eyebrow,.label{font-size:10px;line-height:1;letter-spacing:.24em;text-transform:uppercase;color:var(--brass)}h1{margin:5px 0 2px;font:600 clamp(30px,3.1vw,52px)/.95 var(--display);letter-spacing:.025em}.subtitle{margin:0;color:var(--muted);font-size:13px}
    .clock{text-align:right;font-variant-numeric:tabular-nums}.clock b{display:block;font:500 clamp(24px,2.2vw,38px)/1 var(--display);color:var(--frost)}.clock span{display:block;margin-top:7px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
    .summary{display:grid;grid-template-columns:minmax(240px,1.4fr) repeat(4,minmax(105px,.6fr));gap:1px;margin-top:18px;background:var(--line);border:1px solid var(--hair)}.metric{background:linear-gradient(103deg,rgba(255,255,255,.018),transparent 38%),rgba(27,31,34,.97);min-height:102px;padding:18px 20px;display:flex;flex-direction:column;justify-content:space-between}.metric b{font:500 34px/1 var(--display);color:var(--ink)}.metric small{font-size:9px;letter-spacing:.17em;text-transform:uppercase;color:var(--faint)}.metric.major{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:18px}.ring{--p:${completion};width:66px;height:66px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--brass) calc(var(--p)*1%),var(--hair) 0);position:relative}.ring:before{content:'';position:absolute;inset:6px;border-radius:50%;background:var(--panel)}.ring b{position:relative;font:500 20px/1 var(--display);color:var(--brass)}.major-copy b{font-size:19px}.major-copy small{display:block;margin-top:7px;line-height:1.5}.metric.blocked b{color:var(--frost)}
    .work{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,24%);gap:18px;margin-top:18px}.board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-content:start}.lane{background:linear-gradient(107deg,rgba(197,208,216,.018),transparent 42%),rgba(27,31,34,.97);border:1px solid var(--hair);min-width:0}.lane[data-status=empty]{background:rgba(27,31,34,.68)}.lane-head{display:grid;grid-template-columns:46px 1fr auto;gap:12px;align-items:center;padding:15px 16px 13px}.lane-code{width:44px;height:40px;display:grid;place-items:center;border:1px solid var(--hair);color:var(--frost);background:linear-gradient(145deg,rgba(26,39,64,.62),rgba(10,12,13,.48));box-shadow:inset 0 0 0 4px rgba(197,208,216,.025)}.lane-code svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round}.lane-code svg .accent{stroke:var(--brass)}.lane-title{min-width:0}.lane-title b{display:block;font:600 22px/1 var(--display);color:var(--ink)}.lane-title small{display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:var(--faint)}.lane-actions{display:flex;align-items:center;gap:10px}.lane-count{text-align:right}.lane-count b{display:block;font:500 18px/1 var(--display);color:var(--brass)}.lane-count small{display:block;margin-top:3px;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}.lane-add{width:42px;height:42px;border:1px solid var(--hair);background:rgba(26,39,64,.5);color:var(--frost);font:400 22px/1 var(--display);cursor:pointer;touch-action:manipulation}.lane-add:hover,.lane-add:focus-visible{border-color:var(--brass);color:var(--brass);outline:0}.rail{height:2px;background:var(--line)}.rail i{display:block;height:100%;background:var(--brass)}
    .tasks{list-style:none;padding:0;margin:0;max-height:174px;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--hair) transparent}.task{display:grid;grid-template-columns:12px 1fr auto;gap:11px;align-items:center;padding:13px 16px;border-top:1px solid var(--hair)}.task-state{width:8px;height:8px;border:1px solid var(--faint);transform:rotate(45deg)}.task-doing .task-state{border-color:var(--brass);background:var(--brass);box-shadow:0 0 0 3px rgba(176,141,87,.1)}.task-blocked .task-state{border-color:var(--frost);background:repeating-linear-gradient(45deg,var(--navy) 0,var(--navy) 2px,var(--frost) 2px,var(--frost) 3px)}.task-done .task-state{border-color:var(--frost);background:var(--frost)}.task-copy{min-width:0}.task-copy b{display:block;font-size:12px;font-weight:500}.task-copy small{display:block;margin-top:4px;font-size:10px;line-height:1.45;color:var(--faint)}.task-label{font-size:8px;letter-spacing:.13em;text-transform:uppercase;color:var(--faint)}.task-doing .task-label{color:var(--brass)}.task-blocked .task-label{color:var(--frost)}.task-controls{display:flex;align-items:center;gap:8px}.task-remove{min-width:58px;min-height:32px;padding:0 9px;border:1px solid var(--hair);background:rgba(10,12,13,.5);color:var(--muted);font-size:9px;cursor:pointer;touch-action:manipulation}.task-remove:hover,.task-remove:focus-visible{border-color:var(--brass);color:var(--brass);outline:0}.task-remove:disabled{opacity:.45;cursor:wait}.lane-empty{padding:18px 16px 20px;border-top:1px solid var(--hair);color:var(--faint)}.lane-empty b{display:block;font:500 15px/1.2 var(--display);color:var(--muted)}.lane-empty span{display:block;margin-top:5px;font-size:10px;line-height:1.5}
    .side{background:linear-gradient(110deg,rgba(197,208,216,.018),transparent 45%),rgba(27,31,34,.97);border:1px solid var(--hair);align-self:start;position:sticky;top:18px}.side-head{padding:17px 18px 14px;border-bottom:1px solid var(--hair)}.side-head h2{margin:5px 0 0;font:600 24px/1 var(--display)}.activity{list-style:none;margin:0;padding:0 18px;max-height:520px;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--hair) transparent}.activity li{display:grid;grid-template-columns:10px 1fr;gap:12px;padding:13px 0;border-bottom:1px solid var(--hair)}.activity li:last-child{border-bottom:0}.activity-mark{width:7px;height:7px;margin-top:5px;border:1px solid var(--brass);transform:rotate(45deg)}.activity-mark.change{border-color:var(--frost)}.activity b{display:block;font-size:11px;font-weight:500;line-height:1.35}.activity small{display:block;margin-top:5px;font-size:8px;line-height:1.4;letter-spacing:.05em;text-transform:uppercase;color:var(--faint)}
    .update{margin-top:18px;border:1px solid var(--hair);background:rgba(26,39,64,.22)}.update summary{cursor:pointer;list-style:none;padding:14px 18px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--frost);touch-action:manipulation}.update summary::-webkit-details-marker{display:none}.update summary:after{content:'+';float:right;font-size:16px;line-height:.6}.update[open] summary:after{content:'−'}.update-body{padding:0 18px 17px;border-top:1px solid var(--hair)}.update-body p{font-size:11px;line-height:1.6;color:var(--muted)}.commands{display:grid;gap:7px}.command{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;background:rgba(10,12,13,.6);border:1px solid var(--hair);font-size:10px;color:var(--muted)}.command b{color:var(--ink);font-weight:500}.foot{display:flex;justify-content:space-between;gap:16px;margin-top:15px;padding-top:14px;border-top:1px solid var(--hair);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
    dialog{width:min(92vw,560px);padding:0;border:1px solid var(--hair);background:var(--panel);color:var(--ink);box-shadow:0 26px 80px rgba(0,0,0,.66)}dialog::backdrop{background:rgba(5,7,8,.82);backdrop-filter:blur(4px)}.task-form-head{padding:22px 24px 18px;border-bottom:1px solid var(--hair)}.task-form-head h2{margin:5px 0 0;font:600 29px/1 var(--display)}.task-form{padding:20px 24px 24px}.field{display:grid;gap:7px;margin-bottom:15px}.field label{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}.field input,.field textarea,.field select{width:100%;border:1px solid var(--hair);background:#111416;color:var(--ink);padding:12px 13px;outline:0}.field textarea{min-height:92px;resize:vertical}.field input:focus,.field textarea:focus,.field select:focus{border-color:var(--brass)}.field-help{font-size:9px;color:var(--faint)}.trap{position:absolute!important;left:-9999px!important}.form-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:19px}.form-btn{min-height:44px;padding:0 18px;border:1px solid var(--hair);background:transparent;color:var(--muted);cursor:pointer}.form-btn.primary{border-color:var(--brass);background:rgba(176,141,87,.1);color:var(--brass)}.form-btn:disabled{opacity:.45;cursor:wait}.form-status{min-height:18px;margin:13px 0 0;font-size:11px;color:var(--muted)}.form-status.error{color:var(--frost)}.toast{position:fixed;z-index:10;right:22px;bottom:22px;max-width:360px;padding:13px 16px;border:1px solid var(--brass);background:var(--panel);color:var(--ink);font-size:11px;box-shadow:0 12px 40px rgba(0,0,0,.45)}.toast button{margin-left:14px;padding:5px 9px;border:1px solid var(--brass);background:transparent;color:var(--brass);font-size:10px;cursor:pointer}
    .filters{display:none}
    @media (min-width:1400px){.board{grid-template-columns:repeat(3,minmax(0,1fr))}.work{grid-template-columns:minmax(0,1fr) minmax(330px,22%)}}
    @media (max-width:980px){.work{grid-template-columns:1fr}.side{position:static}.summary{grid-template-columns:repeat(4,1fr)}.metric.major{grid-column:1/-1}.board{grid-template-columns:1fr 1fr}}
    @media (max-width:660px){.shell{padding:14px}.top{grid-template-columns:auto 1fr}.seal{width:58px;height:58px}.seal img{width:52px;height:52px}.clock{grid-column:1/-1;display:flex;justify-content:space-between;text-align:left;padding-top:12px;border-top:1px solid var(--line)}.summary{grid-template-columns:1fr 1fr}.metric.major{grid-column:1/-1}.board{grid-template-columns:1fr}.work{gap:12px}.foot{flex-direction:column}.subtitle{font-size:11px}}
    @media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  </style>
</head>
<body>
  <div class="shell">
    <header class="top">
      <div class="seal"><img src="/progress/coldstream-crest.png" alt="Coldstream Gaming crest"></div>
      <div><span class="eyebrow">Operations record · live board</span><h1>${escapeHtml(board.title)}</h1><p class="subtitle">Established. Welcoming. Built to last.</p></div>
      <div class="clock"><b id="clock">00:00</b><span id="date">Central time</span></div>
    </header>
    <section class="summary" aria-label="Board summary">
      <div class="metric major"><span class="ring" id="overall-ring"><b id="overall-percent">${completion}%</b></span><span class="major-copy"><small>Overall progress</small><b id="overall-count">${done} of ${total} tasks complete</b><small>Progress is calculated from the task record, never typed in by hand.</small></span></div>
      <div class="metric"><small>In progress</small><b id="metric-doing">${doing}</b></div>
      <div class="metric"><small>Queued</small><b id="metric-queued">${queued}</b></div>
      <div class="metric blocked"><small>Blocked</small><b id="metric-blocked">${blocked}</b></div>
      <div class="metric"><small>Workstreams</small><b>${board.lanes.length}</b></div>
    </section>
    <main class="work">
      <section class="board" aria-label="Workstreams">${lanes}</section>
      <aside class="side">
        <header class="side-head"><span class="label">Automatic record</span><h2>Recent changes</h2></header>
        <ol class="activity">${activity || '<li><span>No changes recorded yet.</span></li>'}</ol>
        <details class="update"><summary>Update this board</summary><div class="update-body"><p>Use the + button on any workstream to add a task. New entries start in the queue. Codex still handles status changes and completion reports for now.</p><div class="commands"><span class="command"><b>Add work</b>Use the + button in the right category</span><span class="command"><b>Move work</b>Tell Codex “Mark web-3 done”</span></div></div></details>
      </aside>
    </main>
    <footer class="foot"><span>Coldstream Gaming · Established 2011</span><span>Board refreshes every five minutes · Last task update <time datetime="${escapeHtml(board.updatedAt)}">${escapeHtml(board.updatedAt)}</time></span></footer>
  </div>
  <dialog id="task-dialog">
    <header class="task-form-head"><span class="label">Leadership entry</span><h2>Add a task</h2></header>
    <form class="task-form" id="task-form">
      <div class="field"><label for="task-lane">Workstream</label><select id="task-lane" name="lane" required>${laneOptions}</select></div>
      <div class="field"><label for="task-title">Task</label><input id="task-title" name="title" maxlength="120" required autocomplete="off" placeholder="What needs to be done?"><span class="field-help">Keep it short enough to scan during a leadership check-in.</span></div>
      <div class="field"><label for="task-note">Context, optional</label><textarea id="task-note" name="note" maxlength="280" placeholder="What matters, or what is blocking it?"></textarea></div>
      <div class="field trap" aria-hidden="true"><label for="task-company">Company</label><input id="task-company" name="company" tabindex="-1" autocomplete="off"></div>
      <div class="form-actions"><button class="form-btn" type="button" id="task-cancel">Cancel</button><button class="form-btn primary" type="submit" id="task-submit">Add to board</button></div>
      <p class="form-status" id="form-status" role="status"></p>
    </form>
  </dialog>
  <div class="toast" id="toast" role="status" hidden></div>
  <script>
    const API = 'https://zcpbpcktinlqnxmqddzc.supabase.co/functions/v1/progress-board';
    const fmt = new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'});
    const day = new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',month:'short',day:'numeric'});
    function tick(){const now=new Date();document.querySelector('#clock').textContent=fmt.format(now);document.querySelector('#date').textContent=day.format(now)+' · Central';}
    document.querySelectorAll('time').forEach((el)=>{const d=new Date(el.dateTime);if(!Number.isNaN(d.valueOf()))el.textContent=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(d)});
    const dialog=document.querySelector('#task-dialog');
    const form=document.querySelector('#task-form');
    const laneSelect=document.querySelector('#task-lane');
    const titleInput=document.querySelector('#task-title');
    const formStatus=document.querySelector('#form-status');
    const submitButton=document.querySelector('#task-submit');
    const toast=document.querySelector('#toast');
    const OWNED_KEY='csg.progress.owned.v1';
    let ownedTasks={};
    try{ownedTasks=JSON.parse(localStorage.getItem(OWNED_KEY)||'{}')||{}}catch{}

    function saveOwnedTasks(){try{localStorage.setItem(OWNED_KEY,JSON.stringify(ownedTasks))}catch{}}
    function rememberOwnedTask(id,deleteToken){if(!id||!deleteToken)return;ownedTasks[id]={deleteToken,createdAt:Date.now()};saveOwnedTasks()}
    function showToast(text,actionLabel='',action=null){toast.replaceChildren(document.createTextNode(text));if(actionLabel&&action){const button=document.createElement('button');button.type='button';button.textContent=actionLabel;button.addEventListener('click',async()=>{button.disabled=true;try{await action()}catch(error){showToast(error.message||'The action could not be completed.')}});toast.append(button)}toast.hidden=false;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>{toast.hidden=true},action?9000:4500)}
    function setFormStatus(text,error=false){formStatus.textContent=text;formStatus.classList.toggle('error',error)}
    async function removeOwnedTask(id,quiet=false){
      const owned=ownedTasks[id];
      if(!owned)throw new Error('This task can only be removed from the device that added it.');
      const response=await fetch(API,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,delete_token:owned.deleteToken})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'The task could not be removed');
      delete ownedTasks[id];saveOwnedTasks();await loadPublicTasks();
      if(!quiet)showToast('Task removed from the board.');
    }
    function updateCounts(){
      document.querySelectorAll('.lane').forEach((lane)=>{
        const tasks=[...lane.querySelectorAll('.task')];
        const done=tasks.filter((task)=>task.classList.contains('task-done')).length;
        const total=tasks.length;
        lane.dataset.status=total?'active':'empty';
        const count=lane.querySelector('.lane-count b');
        const rail=lane.querySelector('.rail i');
        if(count)count.textContent=done+'/'+total;
        if(rail)rail.style.width=(total?Math.round(done/total*100):0)+'%';
        const empty=lane.querySelector('.lane-empty');
        if(empty)empty.hidden=total>0;
      });
      const tasks=[...document.querySelectorAll('.task')];
      const count=(status)=>tasks.filter((task)=>task.classList.contains('task-'+status)).length;
      const done=count('done');
      const total=tasks.length;
      const percent=total?Math.round(done/total*100):0;
      document.querySelector('#overall-count').textContent=done+' of '+total+' tasks complete';
      document.querySelector('#overall-percent').textContent=percent+'%';
      document.querySelector('#overall-ring').style.setProperty('--p',percent);
      document.querySelector('#metric-doing').textContent=count('doing');
      document.querySelector('#metric-queued').textContent=count('todo');
      document.querySelector('#metric-blocked').textContent=count('blocked');
    }
    function taskNode(task){
      const item=document.createElement('li');
      item.className='task task-'+task.status;
      item.dataset.publicTask=task.id;
      const state=document.createElement('span');
      state.className='task-state';
      state.setAttribute('aria-label','Queued');
      const copy=document.createElement('span');
      copy.className='task-copy';
      const title=document.createElement('b');
      title.textContent=task.title;
      copy.append(title);
      if(task.note){const note=document.createElement('small');note.textContent=task.note;copy.append(note)}
      const label=document.createElement('span');
      label.className='task-label';
      label.textContent='Queued';
      const controls=document.createElement('span');
      controls.className='task-controls';
      controls.append(label);
      if(ownedTasks[task.id]){
        const remove=document.createElement('button');
        remove.type='button';remove.className='task-remove';remove.textContent='Remove';
        remove.setAttribute('aria-label','Remove '+task.title);
        remove.addEventListener('click',async()=>{remove.disabled=true;try{await removeOwnedTask(task.id)}catch(error){remove.disabled=false;showToast(error.message||'The task could not be removed')}});
        controls.append(remove);
      }
      item.append(state,copy,controls);
      return item;
    }
    function addPublicActivity(tasks){
      document.querySelectorAll('[data-public-activity]').forEach((item)=>item.remove());
      const activity=document.querySelector('.activity');
      [...tasks].slice(0,5).reverse().forEach((task)=>{
        const item=document.createElement('li');
        item.dataset.publicActivity=task.id;
        const mark=document.createElement('i');
        mark.className='activity-mark board';
        const copy=document.createElement('span');
        const title=document.createElement('b');
        title.textContent=task.title+' added to the board';
        const meta=document.createElement('small');
        const lane=document.querySelector('[data-lane="'+task.lane+'"] .lane-title b');
        meta.textContent=(lane?lane.textContent:'Board')+' · '+new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(task.created_at));
        copy.append(title,meta);item.append(mark,copy);activity.prepend(item);
      });
    }
    async function loadPublicTasks(){
      const response=await fetch(API,{headers:{Accept:'application/json'},cache:'no-store'});
      if(!response.ok)throw new Error('Task service is unavailable');
      const result=await response.json();
      document.querySelectorAll('[data-public-task]').forEach((item)=>item.remove());
      for(const task of result.tasks||[]){
        const list=document.querySelector('[data-lane="'+task.lane+'"] [data-task-list]');
        if(list)list.prepend(taskNode(task));
      }
      addPublicActivity(result.tasks||[]);
      updateCounts();
    }
    document.querySelectorAll('[data-add-lane]').forEach((button)=>button.addEventListener('click',()=>{
      laneSelect.value=button.dataset.addLane;
      setFormStatus('');
      dialog.showModal();
      requestAnimationFrame(()=>titleInput.focus());
    }));
    document.querySelector('#task-cancel').addEventListener('click',()=>dialog.close());
    form.addEventListener('submit',async(event)=>{
      event.preventDefault();
      submitButton.disabled=true;
      setFormStatus('Adding task...');
      const data=new FormData(form);
      try{
        const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lane:data.get('lane'),title:data.get('title'),note:data.get('note'),company:data.get('company')})});
        const result=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(result.error||'The task could not be added');
        rememberOwnedTask(result.task&&result.task.id,result.delete_token);
        const createdTask=result.task;
        const selectedLane=laneSelect.value;
        form.reset();
        laneSelect.value=selectedLane;
        dialog.close();
        await loadPublicTasks();
        showToast('Task added to the board.','Undo',async()=>{await removeOwnedTask(createdTask.id,true);showToast('Task removed from the board.')});
      }catch(error){setFormStatus(error.message||'The task could not be added',true)}finally{submitButton.disabled=false}
    });
    tick();updateCounts();loadPublicTasks().catch(()=>{});setInterval(tick,30000);setInterval(()=>{if(!dialog.open)location.reload()},300000);
  </script>
</body>
</html>`;

fs.writeFileSync(outPath, html);
console.log(`Progress board: ${total} tasks, ${done} done, ${doing} in progress, ${blocked} blocked.`);
console.log(`Wrote ${path.relative(root, outPath)} with ${changes.length} recent repository changes.`);
