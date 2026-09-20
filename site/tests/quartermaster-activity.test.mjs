import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const componentUrl = new URL('../src/components/QuartermasterActivityLevels.tsx', import.meta.url);
const require = createRequire(componentUrl);
const code = ts.transpileModule(readFileSync(componentUrl, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const exports = {};
new Function('exports', 'require', code)(exports, id => id.endsWith('.css') ? {} : require(id));
const Component = exports.default;
const fixture = {
  key: 'heists', label: 'Heists', level: 5, xp: 1030, levelStartXp: 1000, nextLevelXp: 1500,
  completed: 15, wins: 6, naturals: 0, activeDays: 5, currentRun: 2, bestRun: 3,
  todayCompleted: 1, dailyLimit: 3, xpPerAction: 50, firstDayBonus: 20,
  milestones: [{ days: 5, earned: true }, { days: 20, earned: false }],
  rewards: [{ level: 5, titleId: 'activity_heists_5', name: 'Wagon Watcher', earned: true }, { level: 10, titleId: 'activity_heists_10', name: 'Crew Veteran', earned: false }],
};

test('activity cards render server data, accessible XP bars, milestones and earned-title controls', () => {
  const html = renderToStaticMarkup(React.createElement(Component, { levels: [fixture], chooseTitle: () => {}, title: 'Wagon Watcher' }));
  for (const value of ['Level 5', '30 / 500 XP', 'aria-valuenow="30"', 'aria-valuemax="500"', 'role="progressbar"', '2 XP-earning completions left today', 'Equipped', 'Locked', '5 days', 'Next: Crew Veteran at level 10.']) assert.ok(html.includes(value), value);
  assert.match(html, /<details/); assert.match(html, /disabled=""/);
});

test('missing backend data is unavailable, never invented zero progress', () => {
  const html = renderToStaticMarkup(React.createElement(Component));
  assert.match(html, /not available from this game service yet/);
  assert.doesNotMatch(html, /Level 1|progressbar/);
});

test('read-only usage offers no equip controls and no raw HTML injection', () => {
  const html = renderToStaticMarkup(React.createElement(Component, { levels: [{ ...fixture, label: '<script>bad()</script>' }] }));
  assert.doesNotMatch(html, /<script>|Use title/);
  assert.match(html, /&lt;script&gt;/);
});

test('profile embeds all activity tracks and motion respects reduced-motion', () => {
  const profile = readFileSync(new URL('../src/components/QuartermasterBillet.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/quartermaster-activity.css', import.meta.url), 'utf8');
  assert.match(profile, /<QuartermasterActivityLevels levels=\{p.activityLevels\}/);
  assert.match(css, /prefers-reduced-motion:reduce/); assert.match(css, /max-width:600px/);
});
