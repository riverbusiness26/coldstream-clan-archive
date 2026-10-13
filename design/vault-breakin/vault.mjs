import { TOOLS, escapeHtml as e, count, estimate, eligibility, activeUntil, errorText, createActionGate } from './model.mjs';

const money = value => Number(value ?? 0).toLocaleString('en-US');
const pct = value => `${(value * 100).toFixed(1)}%`;
const date = value => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Ready';
const icon = kind => `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7">${kind === 'key' ? '<circle cx="15" cy="16" r="8"/><path d="m21 22 17 17m-6-6 5-5m-11-1 5-5"/>' : kind === 'powder' ? '<path d="M15 12h18l4 24H11zM15 12V8h18v4M10 20h28M10 29h28M24 8V3"/>' : '<path d="M18 23c-17-15 17-8 8-21m-6 19c12-13 21 2 11 7M14 29h18l3 13H11z"/>'}</svg>`;
const vaultArt = () => `<div class="safe-scene" aria-hidden="true"><div class="safe-shadow"></div><div class="safe-body"><div class="safe-door"><span class="safe-plaque">COLDSTREAM<br><b>PAY CHEST</b></span><i class="hinge hinge-one"></i><i class="hinge hinge-two"></i><div class="safe-wheel"><span></span></div><div class="safe-lock"></div><span class="safe-serial">II · SECURED</span></div></div><div class="scene-rule"></div></div>`;

/** Portable view. Adapter: read() -> wallet; action(name,args) -> {snapshot,game,message}.
 * No singleton API imports. Call destroy() on route exit. Only server results resolve a live game.
 */
export function mountVault(root, adapter, { initialTargetId = null } = {}) {
  const gate = createActionGate(adapter);
  let wallet = null, targetId = initialTargetId, intel = null, loadout = [], query = '', busy = false, destroyed = false;
  let result = null, message = '', uncertain = false, phase = '', generation = 0, openDialog = null;
  let timer;
  const target = () => wallet?.leaderboard?.find(t => t.discordId === targetId);
  const status = () => root.querySelector('[data-status]');
  const now = () => Date.now();
  function focus(id) { root.querySelector(`[data-focus="${id}"]`)?.focus(); }
  function renderTargets() {
    const list = root.querySelector('[data-targets]');
    if (!list || !wallet) return;
    const members = wallet.leaderboard.filter(t => t.discordId !== wallet.profile.discordId && t.displayName.toLowerCase().includes(query.toLowerCase()));
    list.innerHTML = members.length ? members.map(t => `<button class="target-row ${t.discordId === targetId ? 'selected' : ''}" data-target="${e(t.discordId)}" aria-pressed="${t.discordId === targetId}" ${busy ? 'disabled' : ''}><span class="portrait">${e(t.displayName.slice(0, 1))}</span><span><b>${e(t.displayName)}</b><small>${e(wallet.armory.tiers[t.vaultLevel]?.name ?? 'Unknown tier')} · Renown ${e(t.renownLevel)}</small></span><span class="target-money">${money(t.chest)}<small>SHILLINGS</small></span></button>`).join('') : '<p class="empty">No matching members.</p>';
  }
  function render() {
    if (destroyed) return;
    if (!wallet) { root.innerHTML = `<section class="panel"><h1>Vault Break-in</h1><p role="status">${e(message || 'Opening the ledger…')}</p><button data-refresh>Try again</button></section>`; return; }
    const t = target(), odds = estimate(wallet, t, loadout, intel);
    const reason = eligibility(wallet, t, intel, now());
    const next = wallet.armory.nextVault, own = wallet.armory.card.vault;
    root.innerHTML = `<div class="page-title"><div><p class="eyebrow">THE QUARTERMASTER'S VAULTS</p><h1>A quiet hand.<br><em>A costly mistake.</em></h1><p>Fortify your Pay Chest. Or take your chances with someone else's.</p></div><div class="purse"><span>YOUR WALLET</span><strong>${money(wallet.profile.purse)} <small>s.</small></strong><button data-refresh ${busy ? 'disabled' : ''}>Refresh ledger ↻</button></div></div>
      <div class="vault-layout"><aside class="own-column"><section class="panel own-vault"><div class="panel-heading"><p class="eyebrow">YOUR PAY CHEST</p><span class="tier-label">LEVEL ${own.level} / ${wallet.armory.tiers.length - 1}</span></div>${vaultArt()}<h2>${e(own.name)}</h2><div class="tier-pips" aria-label="Vault level ${own.level} of ${wallet.armory.tiers.length - 1}">${wallet.armory.tiers.map((_, i) => `<i class="${i <= own.level ? 'filled' : ''}"></i>`).join('')}</div><div class="chest-value">${money(wallet.profile.chest)} <span>Shillings secured</span></div><div class="defences"><span>Guard dogs <b>${wallet.armory.defences.guardDogs}</b></span><span>Tripwires <b>${wallet.armory.defences.tripwires}</b></span></div>${next ? `<button class="primary upgrade" data-upgrade ${busy || uncertain || wallet.profile.purse + wallet.profile.chest < next.cost ? 'disabled' : ''}>Fortify your chest <span>${money(next.cost)} s.</span></button><p class="fine-print">Next: ${e(next.name)}. Paid from your chest first, then your wallet.</p>` : '<p class="fine-print">Fully fortified. Your vault is at its highest tier.</p>'}</section>
      <section class="panel notices"><p class="eyebrow">WATCH REPORT</p>${wallet.armory.vaultAlerts.length ? wallet.armory.vaultAlerts.map(a => `<p>${e(a.description)}<small>${e(date(a.createdAt))}</small></p>`).join('') : '<p>No recent break-ins at your chest.<small>Attempts against you will appear here.</small></p>'}<dl><div><dt>Next attempt</dt><dd data-cooldown>${e(activeUntil(wallet.cooldowns.vault) ? date(wallet.cooldowns.vault) : 'Ready')}</dd></div><div><dt>Guardhouse</dt><dd>${e(activeUntil(wallet.armory.jailUntil) ? `Until ${date(wallet.armory.jailUntil)}` : 'Clear')}</dd></div></dl></section></aside>
      <div class="job-column"><section class="panel targets"><div class="panel-heading"><div><p class="eyebrow">01 / CHOOSE A VAULT</p><h2>Who keeps a heavy chest?</h2></div><label class="search"><span class="sr-only">Find a member</span><input data-search type="search" placeholder="Find a member" value="${e(query)}" ${busy ? 'disabled' : ''}></label></div><div data-targets class="target-list"></div></section>
      <section class="panel plan"><p class="eyebrow">02 / PREPARE THE JOB</p><div class="job-heading"><h2>${e(t?.displayName ?? 'Choose a member above')}</h2><button data-scout data-focus="scout" ${!t || busy || uncertain || !count(wallet, 'spyglass') ? 'disabled' : ''}>Scout · 1 spyglass <small>(${count(wallet, 'spyglass')} owned)</small></button></div>
      <div class="intel ${intel ? 'scouted' : ''}">${intel ? `<b>Scout report</b><span>${intel.guardDogs} guard dog(s) · ${intel.tripwire ? 'Tripwire spotted' : 'No tripwire spotted'} · ${e(intel.chestBand)}</span><small>A snapshot, not a guarantee. Defenses can change before you attempt.</small>` : '<b>Defenses unknown</b><span>Scouting consumes a spyglass and reveals dogs, tripwires and reseal status.</span>'}</div>
      <fieldset class="kit"><legend>Choose your tools <span>One of each. Consumed on attempt.</span></legend>${TOOLS.map(tool => `<label class="tool ${loadout.includes(tool.slug) ? 'equipped' : ''}"><input type="checkbox" data-tool="${tool.slug}" ${loadout.includes(tool.slug) ? 'checked' : ''} ${busy || !count(wallet, tool.slug) ? 'disabled' : ''}>${icon(tool.icon)}<span><b>${tool.name}</b><small>${tool.description}</small></span><span class="qty">×${count(wallet, tool.slug)}</span></label>`).join('')}</fieldset>
      <div class="risk-strip"><div><span>${intel ? 'SCOUT-BASED ODDS' : 'PUBLIC-FACT ESTIMATE'}</span><strong>${odds ? pct(odds.chance) : '—'}</strong><meter min="0" max="1" value="${odds?.chance ?? 0}" aria-label="Estimated success probability"></meter><small>${intel?.tripwire ? 'Tripwire: guaranteed failure while armed.' : 'Most attempts fail. Hidden defenses may reduce these odds.'}</small></div><div><span>POTENTIAL HAUL</span><strong>${odds ? `${money(odds.low)}–${money(odds.high)}` : '—'} <small>s.</small></strong><small>On success. 5% of successes find a motherlode, up to ${money(odds?.motherlode)} s.</small></div></div>
      <div class="attempt-row"><div><b>${wallet.armory.rules.entry} s. entry · ${wallet.armory.rules.cooldownSeconds / 3600}h cooldown</b><small>Failure: up to 60 s. fine and 8h in the guardhouse. Tripwire: 24h.</small></div><button class="primary" data-attempt data-focus="attempt" ${busy || reason || uncertain ? 'disabled' : ''}>${busy ? 'Working…' : 'Review break-in'} <span>→</span></button></div>${reason ? `<p class="warning">${e(reason)}</p>` : ''}
      <div class="result ${phase}" data-result tabindex="-1" ${!phase && !result ? 'hidden' : ''}><div class="tumblers" aria-hidden="true"><i>Ⅰ</i><i>Ⅱ</i><i>Ⅲ</i></div><h3>${phase === 'turning' ? 'Turning the lock…' : result?.success ? result.motherlode ? 'The motherlode.' : 'The vault is open.' : result?.smoke ? 'Gone in smoke.' : 'The lock holds.'}</h3>${result ? `<p>${result.success ? `${money(result.amount)} s. taken. Entry already paid.` : `${money(result.fine)} s. fine. ${result.jailUntil ? `Guardhouse until ${e(date(result.jailUntil))}.` : 'No jail time.'}`}</p><small>${result.alarm ? 'The tripwire caught you. Smoke could not protect you.' : result.dog ? 'A guard dog defended this vault.' : 'Outcome confirmed by the adapter.'}</small>` : '<p>The result is being checked. Do not repeat the attempt.</p>'}</div>
      </section></div></div><p class="page-status" data-status role="status" aria-live="polite">${e(message)}</p>
      <section class="panel bottom-notes"><div><p class="eyebrow">THE REGIMENT LEDGER</p>${wallet.armory.feed.length ? wallet.armory.feed.slice(0, 4).map(f => `<p>${e(f.text)}</p>`).join('') : '<p>Quiet, for now. Confirmed attempts appear here.</p>'}</div><details><summary>Know the risk before you go</summary><p>Every attempt costs the entry fee and all selected tools, even if it fails. A successful vault is resealed for 24 hours. The ordinary fine is 12% of your remaining wallet, from 5 to 60 Shillings, capped by what you have left.</p><p>A smoke bomb prevents ordinary fines and jail, but cannot beat a tripwire. The pot is fictional currency only. The server decides the result; the animation does not.</p></details></section>`;
    renderTargets();
  }
  async function refresh() {
    if (busy || destroyed) return;
    busy = true; message = 'Refreshing the ledger…'; render();
    try {
      const next = await adapter.read();
      if (destroyed) return;
      if (!next?.profile || !next?.armory?.tiers || !Array.isArray(next.leaderboard)) throw new Error('Missing wallet fields');
      wallet = next; loadout = loadout.filter(t => count(wallet, t)); intel = null;
      message = uncertain ? 'Ledger refreshed. The last result is still unconfirmed. Check the transaction history before any new attempt.' : 'Ledger up to date.';
    } catch { message = 'Could not load the vault ledger. Try refreshing again.'; }
    finally { busy = false; render(); }
  }
  function confirm(kind) {
    if (busy || uncertain || openDialog || !wallet) return;
    const t = target(), next = wallet.armory.nextVault;
    if (kind === 'attempt' && (uncertain || eligibility(wallet, t, intel))) return;
    if (kind === 'upgrade' && !next) return;
    const dialog = document.createElement('dialog'); openDialog = dialog;
    dialog.className = 'vault-confirm';
    const body = kind === 'attempt' ? `<h2 id="confirm-title">Try ${e(t.displayName)}'s vault?</h2><p><b>${wallet.armory.rules.entry} Shillings</b> and ${loadout.length ? e(loadout.map(s => TOOLS.find(x => x.slug === s).name).join(', ')) : 'no tools'} will be spent.</p><p>Failure can add a fine and jail time. Scouting does not guarantee success.</p>` : kind === 'scout' ? `<h2 id="confirm-title">Scout this vault?</h2><p>This uses <b>one spyglass</b>. You will see a snapshot of ${e(t.displayName)}'s defenses.</p>` : `<h2 id="confirm-title">Fortify your Pay Chest?</h2><p>${e(next.name)} costs <b>${money(next.cost)} Shillings</b>, taken from your chest first and then your wallet.</p>`;
    dialog.innerHTML = `<p class="eyebrow">${adapter.previewOnly ? 'PREVIEW ONLY / NO REAL SHILLINGS' : 'CONFIRM COST'}</p>${body}<div class="dialog-buttons"><button data-cancel>Go back</button><button class="primary" data-commit>Confirm ${kind === 'attempt' ? 'break-in' : kind}</button></div>`;
    dialog.setAttribute('aria-labelledby', 'confirm-title'); root.append(dialog); dialog.showModal();
    dialog.querySelector('[data-cancel]').focus();
    const close = () => { dialog.close(); dialog.remove(); openDialog = null; focus(kind === 'scout' ? 'scout' : 'attempt'); };
    dialog.querySelector('[data-cancel]').onclick = close;
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.querySelector('[data-commit]').onclick = () => { close(); void act(kind); };
  }
  async function act(kind) {
    if (busy || destroyed) return;
    busy = true; const version = generation; const captured = target();
    result = null; phase = kind === 'attempt' ? 'turning' : ''; message = 'Waiting for confirmation…'; render();
    const started = performance.now();
    try {
      const response = await gate.run(kind === 'attempt' ? 'vault_crack' : kind === 'scout' ? 'vault_scout' : 'vault_upgrade', kind === 'upgrade' ? {} : { targetDiscordId: captured.discordId, ...(kind === 'attempt' ? { tools: [...loadout] } : {}) });
      if (destroyed || version !== generation) return;
      if (!response?.snapshot?.profile || (kind === 'attempt' && typeof response.game?.success !== 'boolean')) throw new Error('Unconfirmed response');
      wallet = response.snapshot;
      if (kind === 'attempt') {
        const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.max(0, 1500 - (performance.now() - started));
        await new Promise(resolve => setTimeout(resolve, delay));
        if (destroyed || version !== generation) return;
        result = response.game; phase = result.success ? 'won' : 'lost'; loadout = []; intel = null;
      } else if (kind === 'scout') intel = response.game?.intel ?? null;
      message = response.message || 'Confirmed.';
    } catch (error) {
      if (destroyed || version !== generation) return;
      message = errorText(error); phase = ''; intel = null;
      // Known validation errors did not spend; unknown transport errors MAY have spent.
      if (!['cooldown', 'jailed', 'resealed', 'target_poor', 'insufficient_funds', 'protected_member', 'self_target', 'not_owned', 'invalid_tools', 'vault_max'].includes(error.code)) uncertain = true;
    } finally {
      if (!destroyed && version === generation) { busy = false; render(); if (result) root.querySelector('[data-result]')?.focus(); else { status()?.setAttribute('tabindex', '-1'); status()?.focus(); } }
    }
  }
  const onClick = event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.hasAttribute('data-refresh')) void refresh();
    else if (button.dataset.target) { targetId = button.dataset.target; intel = null; result = null; phase = ''; render(); root.querySelector(`[data-target="${CSS.escape(targetId)}"]`)?.focus(); }
    else if (button.hasAttribute('data-attempt')) confirm('attempt');
    else if (button.hasAttribute('data-scout')) confirm('scout');
    else if (button.hasAttribute('data-upgrade')) confirm('upgrade');
  };
  const onInput = event => { if (event.target.hasAttribute('data-search')) { query = event.target.value; renderTargets(); } };
  const onChange = event => {
    const slug = event.target.dataset.tool; if (!slug || busy) return;
    loadout = event.target.checked ? [...new Set([...loadout, slug])] : loadout.filter(t => t !== slug);
    render(); root.querySelector(`[data-tool="${slug}"]`)?.focus();
  };
  root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange);
  // Update eligibility when cooldown expires, without constantly stealing focus/rebuilding the page.
  timer = setInterval(() => {
    if (busy || openDialog || !wallet) return;
    let changed = false;
    if (wallet.cooldowns.vault && !activeUntil(wallet.cooldowns.vault)) { wallet.cooldowns.vault = null; changed = true; }
    if (wallet.armory.jailUntil && !activeUntil(wallet.armory.jailUntil)) { wallet.armory.jailUntil = null; changed = true; }
    if (changed) render();
  }, 1000);
  void refresh();
  return { refresh, destroy() { destroyed = true; generation++; clearInterval(timer); openDialog?.close(); root.removeEventListener('click', onClick); root.removeEventListener('input', onInput); root.removeEventListener('change', onChange); root.replaceChildren(); } };
}
