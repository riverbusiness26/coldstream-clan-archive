import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const boardPath = path.join(root, 'progress', 'board.json');
const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const [command, ...args] = process.argv.slice(2);
const validStatuses = new Set(['todo', 'doing', 'blocked', 'done']);

function usage(message) {
  if (message) console.error(message);
  console.error('Usage:');
  console.error('  node scripts/task.mjs list');
  console.error('  node scripts/task.mjs add <lane> <title> [todo|doing|blocked|done]');
  console.error('  node scripts/task.mjs set <task-id> <todo|doing|blocked|done> [note]');
  console.error('  node scripts/task.mjs note <lane> <change report>');
  process.exit(1);
}

function lane(id) {
  const found = board.lanes.find((item) => item.id === id);
  if (!found) usage(`Unknown workstream: ${id}`);
  return found;
}

function save(laneId, text) {
  const now = new Date().toISOString();
  board.updatedAt = now;
  board.history ??= [];
  board.history.push({ at: now, lane: laneId, text });
  board.history = board.history.slice(-120);
  fs.writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`);
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'progress.mjs')], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (command === 'list') {
  for (const stream of board.lanes) {
    console.log(`\n${stream.label} (${stream.id})`);
    const tasks = board.tasks.filter((task) => task.lane === stream.id);
    if (!tasks.length) console.log('  No tasks.');
    for (const task of tasks) console.log(`  ${task.id}  ${task.status.padEnd(7)}  ${task.title}`);
  }
} else if (command === 'add') {
  const [laneId, title, status = 'todo'] = args;
  if (!laneId || !title || !validStatuses.has(status)) usage('Add needs a workstream, a quoted title and an optional valid status.');
  const stream = lane(laneId);
  const prefix = stream.code.toLowerCase().replace(/[^a-z0-9]/g, '');
  const next = Math.max(0, ...board.tasks.filter((task) => task.id.startsWith(`${prefix}-`)).map((task) => Number(task.id.split('-').at(-1)) || 0)) + 1;
  const id = `${prefix}-${next}`;
  const now = new Date().toISOString();
  board.tasks.push({ id, lane: laneId, title, status, priority: 'normal', note: '', updatedAt: now });
  save(laneId, `${title} added to ${stream.label}.`);
  console.log(`Added ${id}: ${title}`);
} else if (command === 'set') {
  const [id, status, ...noteParts] = args;
  if (!id || !validStatuses.has(status)) usage('Set needs a task id and a valid status.');
  const task = board.tasks.find((item) => item.id === id);
  if (!task) usage(`Unknown task: ${id}`);
  const before = task.status;
  task.status = status;
  if (noteParts.length) task.note = noteParts.join(' ');
  task.updatedAt = new Date().toISOString();
  save(task.lane, `${task.title} moved from ${before} to ${status}.`);
  console.log(`Updated ${id}: ${status}`);
} else if (command === 'note') {
  const [laneId, ...textParts] = args;
  if (!laneId || !textParts.length) usage('Note needs a workstream and a change report.');
  const stream = lane(laneId);
  const text = textParts.join(' ');
  save(laneId, text);
  console.log(`Reported in ${stream.label}: ${text}`);
} else {
  usage();
}
