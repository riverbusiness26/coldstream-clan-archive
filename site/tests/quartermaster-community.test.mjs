import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const community = await readFile(new URL('../src/components/QuartermasterCommunity.tsx', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/views/Quartermaster.tsx', import.meta.url), 'utf8');
const migration = await readFile(new URL('../db/0061_quartermaster_chat.sql', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/economy.css', import.meta.url), 'utf8');

test('Shillings exposes member chat, player profiles and Discord avatars', () => {
  assert.match(page, /QuartermasterCommunity/);
  assert.match(page, /DiscordAvatar/);
  assert.match(community, /Mess Chat/);
  assert.match(community, /Chat & players/);
  assert.match(community, /Private messages are still WIP/);
  assert.match(community, /#\/member\//);
});

test('Mess Chat is member-gated, rate limited and retained for thirty days', () => {
  assert.match(migration, /revoke all on public\.quartermaster_chat_message from anon/i);
  assert.match(migration, /current_member_id\(\) is not null/i);
  assert.match(migration, /author_id = current_member_id\(\)/i);
  assert.match(migration, /interval '10 seconds'/i);
  assert.match(migration, /interval '30 days'/i);
  assert.match(migration, /offset 500/i);
});

test('Mess Chat is a viewport-fixed toggle on desktop and mobile', () => {
  assert.match(community, /createPortal\(widget, document\.body\)/);
  assert.match(community, /aria-label=\{open \? 'Close Mess Chat' : 'Open Mess Chat'\}/);
  assert.match(community, /event\.key === 'Escape'/);
  assert.match(styles, /\.qm-community-widget\{position:fixed;z-index:119;inset:0;pointer-events:none\}/);
  assert.match(styles, /\.qm-community-launcher\{position:fixed/);
  assert.match(styles, /\.qm-community-drawer\{position:fixed/);
  assert.match(styles, /\.qm-community-drawer\{right:14px;bottom:max\(70px/);
});
