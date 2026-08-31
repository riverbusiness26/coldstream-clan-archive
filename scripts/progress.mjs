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
  <article class="lane" data-lane="${escapeHtml(lane.id)}" data-status="${total ? 'active' : 'empty'}">
    <header class="lane-head">
      <span class="lane-code">${escapeHtml(lane.code)}</span>
      <span class="lane-title"><b>${escapeHtml(lane.label)}</b><small>${escapeHtml(lane.description)}</small></span>
      <span class="lane-count"><b>${done}/${total}</b><small>complete</small></span>
    </header>
    <div class="rail" aria-label="${progress}% complete"><i style="width:${progress}%"></i></div>
    <ul class="tasks">${items}</ul>
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
    .seal{width:74px;height:74px;display:grid;place-items:center;border:1px solid var(--hair);background:rgba(10,12,13,.48);position:relative}.seal:after{content:'';position:absolute;inset:5px;border:1px solid rgba(197,208,216,.12)}.seal img{width:58px;height:58px;object-fit:contain}
    .eyebrow,.label{font-size:10px;line-height:1;letter-spacing:.24em;text-transform:uppercase;color:var(--brass)}h1{margin:5px 0 2px;font:600 clamp(30px,3.1vw,52px)/.95 var(--display);letter-spacing:.025em}.subtitle{margin:0;color:var(--muted);font-size:13px}
    .clock{text-align:right;font-variant-numeric:tabular-nums}.clock b{display:block;font:500 clamp(24px,2.2vw,38px)/1 var(--display);color:var(--frost)}.clock span{display:block;margin-top:7px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
    .summary{display:grid;grid-template-columns:minmax(240px,1.4fr) repeat(4,minmax(105px,.6fr));gap:1px;margin-top:18px;background:var(--line);border:1px solid var(--hair)}.metric{background:linear-gradient(103deg,rgba(255,255,255,.018),transparent 38%),rgba(27,31,34,.97);min-height:102px;padding:18px 20px;display:flex;flex-direction:column;justify-content:space-between}.metric b{font:500 34px/1 var(--display);color:var(--ink)}.metric small{font-size:9px;letter-spacing:.17em;text-transform:uppercase;color:var(--faint)}.metric.major{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:18px}.ring{--p:${completion};width:66px;height:66px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--brass) calc(var(--p)*1%),var(--hair) 0);position:relative}.ring:before{content:'';position:absolute;inset:6px;border-radius:50%;background:var(--panel)}.ring b{position:relative;font:500 20px/1 var(--display);color:var(--brass)}.major-copy b{font-size:19px}.major-copy small{display:block;margin-top:7px;line-height:1.5}.metric.blocked b{color:var(--frost)}
    .work{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,24%);gap:18px;margin-top:18px}.board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-content:start}.lane{background:linear-gradient(107deg,rgba(197,208,216,.018),transparent 42%),rgba(27,31,34,.97);border:1px solid var(--hair);min-width:0}.lane[data-status=empty]{background:rgba(27,31,34,.68)}.lane-head{display:grid;grid-template-columns:46px 1fr auto;gap:12px;align-items:center;padding:15px 16px 13px}.lane-code{width:44px;height:40px;display:grid;place-items:center;border:1px solid var(--hair);font-size:10px;letter-spacing:.12em;color:var(--frost);background:rgba(26,39,64,.42)}.lane-title{min-width:0}.lane-title b{display:block;font:600 22px/1 var(--display);color:var(--ink)}.lane-title small{display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:var(--faint)}.lane-count{text-align:right}.lane-count b{display:block;font:500 18px/1 var(--display);color:var(--brass)}.lane-count small{display:block;margin-top:3px;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}.rail{height:2px;background:var(--line)}.rail i{display:block;height:100%;background:var(--brass)}
    .tasks{list-style:none;padding:0;margin:0}.task{display:grid;grid-template-columns:12px 1fr auto;gap:11px;align-items:center;padding:13px 16px;border-top:1px solid var(--hair)}.task-state{width:8px;height:8px;border:1px solid var(--faint);transform:rotate(45deg)}.task-doing .task-state{border-color:var(--brass);background:var(--brass);box-shadow:0 0 0 3px rgba(176,141,87,.1)}.task-blocked .task-state{border-color:var(--frost);background:repeating-linear-gradient(45deg,var(--navy) 0,var(--navy) 2px,var(--frost) 2px,var(--frost) 3px)}.task-done .task-state{border-color:var(--frost);background:var(--frost)}.task-copy{min-width:0}.task-copy b{display:block;font-size:12px;font-weight:500}.task-copy small{display:block;margin-top:4px;font-size:10px;line-height:1.45;color:var(--faint)}.task-label{font-size:8px;letter-spacing:.13em;text-transform:uppercase;color:var(--faint)}.task-doing .task-label{color:var(--brass)}.task-blocked .task-label{color:var(--frost)}.lane-empty{padding:18px 16px 20px;border-top:1px solid var(--hair);color:var(--faint)}.lane-empty b{display:block;font:500 15px/1.2 var(--display);color:var(--muted)}.lane-empty span{display:block;margin-top:5px;font-size:10px;line-height:1.5}
    .side{background:linear-gradient(110deg,rgba(197,208,216,.018),transparent 45%),rgba(27,31,34,.97);border:1px solid var(--hair);align-self:start;position:sticky;top:18px}.side-head{padding:17px 18px 14px;border-bottom:1px solid var(--hair)}.side-head h2{margin:5px 0 0;font:600 24px/1 var(--display)}.activity{list-style:none;margin:0;padding:0 18px;max-height:520px;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--hair) transparent}.activity li{display:grid;grid-template-columns:10px 1fr;gap:12px;padding:13px 0;border-bottom:1px solid var(--hair)}.activity li:last-child{border-bottom:0}.activity-mark{width:7px;height:7px;margin-top:5px;border:1px solid var(--brass);transform:rotate(45deg)}.activity-mark.change{border-color:var(--frost)}.activity b{display:block;font-size:11px;font-weight:500;line-height:1.35}.activity small{display:block;margin-top:5px;font-size:8px;line-height:1.4;letter-spacing:.05em;text-transform:uppercase;color:var(--faint)}
    .update{margin-top:18px;border:1px solid var(--hair);background:rgba(26,39,64,.22)}.update summary{cursor:pointer;list-style:none;padding:14px 18px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--frost);touch-action:manipulation}.update summary::-webkit-details-marker{display:none}.update summary:after{content:'+';float:right;font-size:16px;line-height:.6}.update[open] summary:after{content:'−'}.update-body{padding:0 18px 17px;border-top:1px solid var(--hair)}.update-body p{font-size:11px;line-height:1.6;color:var(--muted)}.commands{display:grid;gap:7px}.command{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;background:rgba(10,12,13,.6);border:1px solid var(--hair);font-size:10px;color:var(--muted)}.command b{color:var(--ink);font-weight:500}.foot{display:flex;justify-content:space-between;gap:16px;margin-top:15px;padding-top:14px;border-top:1px solid var(--hair);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
    .filters{display:none}
    @media (min-width:1400px){.board{grid-template-columns:repeat(3,minmax(0,1fr))}.work{grid-template-columns:minmax(0,1fr) minmax(330px,22%)}}
    @media (max-width:980px){.work{grid-template-columns:1fr}.side{position:static}.summary{grid-template-columns:repeat(4,1fr)}.metric.major{grid-column:1/-1}.board{grid-template-columns:1fr 1fr}}
    @media (max-width:660px){.shell{padding:14px}.top{grid-template-columns:auto 1fr}.seal{width:58px;height:58px}.seal img{width:44px;height:44px}.clock{grid-column:1/-1;display:flex;justify-content:space-between;text-align:left;padding-top:12px;border-top:1px solid var(--line)}.summary{grid-template-columns:1fr 1fr}.metric.major{grid-column:1/-1}.board{grid-template-columns:1fr}.work{gap:12px}.foot{flex-direction:column}.subtitle{font-size:11px}}
    @media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  </style>
</head>
<body>
  <div class="shell">
    <header class="top">
      <div class="seal"><img src="/logo.png?v=2" alt="Coldstream Gaming"></div>
      <div><span class="eyebrow">Operations record · live board</span><h1>${escapeHtml(board.title)}</h1><p class="subtitle">Established. Welcoming. Built to last.</p></div>
      <div class="clock"><b id="clock">00:00</b><span id="date">Central time</span></div>
    </header>
    <section class="summary" aria-label="Board summary">
      <div class="metric major"><span class="ring"><b>${completion}%</b></span><span class="major-copy"><small>Overall progress</small><b>${done} of ${total} tasks complete</b><small>Progress is calculated from the task record, never typed in by hand.</small></span></div>
      <div class="metric"><small>In progress</small><b>${doing}</b></div>
      <div class="metric"><small>Queued</small><b>${queued}</b></div>
      <div class="metric blocked"><small>Blocked</small><b>${blocked}</b></div>
      <div class="metric"><small>Workstreams</small><b>${board.lanes.length}</b></div>
    </section>
    <main class="work">
      <section class="board" aria-label="Workstreams">${lanes}</section>
      <aside class="side">
        <header class="side-head"><span class="label">Automatic record</span><h2>Recent changes</h2></header>
        <ol class="activity">${activity || '<li><span>No changes recorded yet.</span></li>'}</ol>
        <details class="update"><summary>Update this board</summary><div class="update-body"><p>Tell Codex what changed in plain language. It will update the task record, rebuild this page and put the change into the activity log.</p><div class="commands"><span class="command"><b>Add work</b>“Add landing copy editor to Website”</span><span class="command"><b>Move work</b>“Mark web-1 done”</span><span class="command"><b>Report work</b>“Log that the Discord bot was deployed”</span></div></div></details>
      </aside>
    </main>
    <footer class="foot"><span>Coldstream Gaming · Established 2011</span><span>Board refreshes every five minutes · Last task update <time datetime="${escapeHtml(board.updatedAt)}">${escapeHtml(board.updatedAt)}</time></span></footer>
  </div>
  <script>
    const stamp = ${JSON.stringify(board.updatedAt)};
    const fmt = new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'});
    const day = new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',month:'short',day:'numeric'});
    function tick(){const now=new Date();document.querySelector('#clock').textContent=fmt.format(now);document.querySelector('#date').textContent=day.format(now)+' · Central';}
    document.querySelectorAll('time').forEach((el)=>{const d=new Date(el.dateTime);if(!Number.isNaN(d.valueOf()))el.textContent=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(d)});
    tick();setInterval(tick,30000);setTimeout(()=>location.reload(),300000);
  </script>
</body>
</html>`;

fs.writeFileSync(outPath, html);
console.log(`Progress board: ${total} tasks, ${done} done, ${doing} in progress, ${blocked} blocked.`);
console.log(`Wrote ${path.relative(root, outPath)} with ${changes.length} recent repository changes.`);
