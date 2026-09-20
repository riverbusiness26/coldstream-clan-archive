import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const shell = await readFile(new URL('../src/components/SiteShell.tsx', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/views/Economy.tsx', import.meta.url), 'utf8');
const routing = await readFile(new URL('../src/lib/routing.ts', import.meta.url), 'utf8');
const vite = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
const secretEntry = await readFile(new URL('../stores/index.html', import.meta.url), 'utf8');

test('the member Shillings page has an accessible coin link beside Join', () => { assert.match(app, /view === 'stores'/); assert.match(routing, /'stores'/); assert.match(shell, /Join<\/a><a className="hq-shillings-link" href="#\/stores" aria-label="Shillings"/); });
test('the header links to Coldstream TV immediately after Shillings', () => { assert.match(shell, /aria-label="Shillings"[\s\S]*<\/a><a className="hq-tv-link" href="https:\/\/tv\.coldstreamgaming\.com\/" aria-label="Coldstream TV"/); });
test('the direct stores entry is built as a noindex page', () => { assert.match(vite, /stores: resolve\(siteRoot, 'stores\/index\.html'\)/); assert.match(secretEntry, /name="robots" content="noindex, nofollow"/); assert.match(secretEntry, /src="\/src\/main\.tsx"/); });
test('economy page preserves the reviewed contract and accessible states', () => { for (const text of ["Quartermaster's Stores", 'Shillings', 'Engraved Frame', 'Claim daily issue', 'Your display case', 'Your collection', 'The ledger', 'aria-live="polite"', 'The result is unknown', 'Refresh Shillings', 'Retry with the same request']) assert.ok(page.includes(text), text); });
test('actions retain full retry context and only recycle uncertain request keys', () => { assert.match(page, /requestKeys\.current\.get\(id\) \?\? \(kind === 'equip' \? '' : createEconomyRequestKey\(kind\)\)/); assert.match(page, /setAction\(\{ key, kind, slug, slot, status: 'unknown'/); assert.match(page, /requestKeys\.current\.delete\(id\)/); });
test('known failures are definite and ledger pagination uses the oldest visible id', () => { assert.match(page, /ECONOMY_DAILY_ALREADY_CLAIMED/); assert.match(page, /snapshot\?\.ledger\.at\(-1\)\?\.id/); assert.match(page, /readEconomySelf\(supa, \{ ledgerBefore, ledgerLimit: 20 \}\)/); });
test('the Shillings page opts out of the generic two-column outer wrap', () => { assert.match(page, /className="economy-page wrap solo"/); });
