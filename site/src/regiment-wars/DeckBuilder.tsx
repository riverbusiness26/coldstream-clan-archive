import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { FiArrowRight, FiCheck, FiGrid, FiChevronDown, FiChevronUp, FiInfo, FiMove, FiPlus, FiRotateCcw, FiX, FiHelpCircle } from 'react-icons/fi';
import { BY_ID, CARDS, ROLE_NAMES, SECTIONS, type Card } from './catalogue';
import { deckSlots, deckStamp, fillEmptySlots, fitsSlot, placeCard, removeCard, supportTip, tipsEnabled, TIPS_KEY } from './deckLayout';
import CardArtwork from './CardArtwork';
import type { Deck } from './store';
import './deckBuilder.css';

type Props = {
  deck: Deck; decks: Deck[]; owned: string[]; busy: boolean; initialCard?: string; battleInProgress: boolean;
  onSave: (deck: Deck) => Promise<boolean>; onSwitch: (id: string) => void;
  onInspect: (card: Card) => void; onPlay: () => void; onPacks: () => void;
};
type Drag = { id: string; x: number; y: number; startX: number; startY: number; active: boolean; stamp: string; pointer: number; target: HTMLElement };
type Drop = number | 'collection' | null;
const scrollToArea = (element: HTMLElement | null, block: ScrollLogicalPosition = 'start') => element?.scrollIntoView({ block, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

function MiniCard({ card }: { card: Card }) {
  return <span className="rw-mini-frame"><CardArtwork card={card} small /></span>;
}

export default function DeckBuilder({ deck, decks, owned, busy, initialCard, battleInProgress, onSave, onSwitch, onInspect, onPlay, onPacks }: Props) {
  const [selected, setSelected] = useState(initialCard && owned.includes(initialCard) ? initialCard : '');
  const [trayOpen, setTrayOpen] = useState(true);
  const [tips, setTips] = useState(() => { try { return tipsEnabled(localStorage.getItem(TIPS_KEY)); } catch { return true; } });
  const [targetSlot, setTargetSlot] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [rarity, setRarity] = useState('all');
  const [unused, setUnused] = useState(false);
  const [message, setMessage] = useState('Changes save automatically on this device.');
  const [undo, setUndo] = useState<{ before: string[]; after: string } | null>(null);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null);
  const [over, setOver] = useState<Drop>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const saving = useRef(false);
  const board = useRef<HTMLDivElement>(null);
  const library = useRef<HTMLElement>(null);
  const editor = useRef<HTMLElement>(null);
  const latest = useRef({ deck, busy }); latest.current = { deck, busy };
  const slots = deckSlots(deck.cards);
  const stamp = deckStamp(slots);
  const infantry = slots.slice(0, 10).filter(Boolean).length;
  const support = slots.slice(10).filter(Boolean).length;
  const ready = infantry === 10 && support === 5;
  const carried = ghost?.id || selected;
  const cardType = role;
  const visible = CARDS.filter(c => owned.includes(c.id) && (c.name + ' ' + c.trait + ' ' + ROLE_NAMES[c.role]).toLowerCase().includes(query.toLowerCase()) && (cardType === 'all' || (c.role === 'infantry' ? 'infantry' : 'support') === cardType) && (rarity === 'all' || c.rarity === rarity) && (!unused || !slots.includes(c.id)));
  function toggleTips() { const next = !tips; setTips(next); try { localStorage.setItem(TIPS_KEY, next ? 'on' : 'off'); } catch { /* The switch still works for this visit. */ } }
  function cancelDrag() {
    const current = drag.current;
    drag.current = null;
    if (current?.target.hasPointerCapture(current.pointer)) current.target.releasePointerCapture(current.pointer);
    setGhost(null); setOver(null);
  }
  useEffect(() => {
    setSelected(initialCard && owned.includes(initialCard) ? initialCard : '');
    setTargetSlot(null);
    if (initialCard && owned.includes(initialCard)) setMessage(`${BY_ID[initialCard].name} selected. Choose a highlighted position.`);
  }, [initialCard]);
  useEffect(() => {
    cancelDrag();
    if (undo && undo.after !== stamp) setUndo(null);
  }, [stamp]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (drag.current?.active) suppressClick.current = true;
      cancelDrag(); setSelected(''); setTargetSlot(null); setMessage('Selection cancelled. Your deck is unchanged.');
    };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); const current = drag.current; drag.current = null; if (current?.target.hasPointerCapture(current.pointer)) current.target.releasePointerCapture(current.pointer); };
  }, []);
  useEffect(() => {
    if (!ghost) return;
    let frame: number;
    const scroll = () => {
      const current = drag.current;
      if (!current?.active) return;
      const amount = current.y < 70 ? -10 : current.y > window.innerHeight - 70 ? 10 : 0;
      if (amount) { window.scrollBy(0, amount); setOver(dropAt(current.x, current.y)); }
      frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [!!ghost]);

  async function save(cards: string[], text: string, remember = true) {
    if (busy || saving.current) return;
    if (deckStamp(cards) === stamp) { setMessage('That card is already in this position.'); return; }
    saving.current = true;
    const before = [...deck.cards];
    try {
      if (await onSave({ ...deck, cards })) {
        setUndo(remember ? { before, after: deckStamp(cards) } : null);
        setSelected(''); setTargetSlot(null); setMessage(text + ' Saved.');
        return true;
      }
    } finally { saving.current = false; }
  }
  function place(id: string, slot: number) {
    if (!fitsSlot(id, slot)) { setSelected(id); setTargetSlot(null); setMessage(`${BY_ID[id].name} needs a ${BY_ID[id].role === 'infantry' ? 'front-row infantry' : 'back-row support'} position. Choose a highlighted position.`); return; }
    const previous = slots.indexOf(id);
    const displaced = slots[slot];
    const action = displaced && displaced !== id ? previous >= 0 ? `Swapped ${BY_ID[id].name} and ${BY_ID[displaced].name}.` : `${BY_ID[id].name} placed. ${BY_ID[displaced].name} returned to your collection.` : `${BY_ID[id].name} placed.`;
    void save(placeCard(deck.cards, id, slot, owned), action);
  }
  function choose(id: string) {
    if (busy) return;
    if (targetSlot !== null) { place(id, targetSlot); scrollToArea(board.current, 'nearest'); return; }
    setSelected(selected === id ? '' : id);
    setMessage(selected === id ? 'Selection cleared.' : `${BY_ID[id].name} selected. Choose a highlighted position, or drag the card there.`);
    scrollToArea(board.current, 'nearest');
  }
  function chooseSlot(slot: number) {
    if (selected) { place(selected, slot); return; }
    if (slots[slot]) { choose(slots[slot]); return; }
    setTrayOpen(true); setTargetSlot(slot); setRole(slot < 10 ? 'infantry' : 'support'); setQuery(''); setRarity('all'); setUnused(false);
    setMessage(`Choose a card for ${slot < 10 ? 'infantry ' + (slot + 1) : 'support ' + (slot - 9)}.`);
    requestAnimationFrame(() => scrollToArea(library.current, 'nearest'));
  }
  function dropAt(x: number, y: number): Drop {
    const element = document.elementFromPoint(x, y);
    const slot = element?.closest<HTMLElement>('[data-rw-drop-slot]');
    if (slot) return Number(slot.dataset.rwDropSlot);
    return element?.closest('[data-rw-drop-library]') ? 'collection' : null;
  }
  function pointerDown(event: ReactPointerEvent<HTMLElement>, id: string) {
    if (busy || event.button !== 0 || !event.isPrimary || (event.target as HTMLElement).closest('[data-no-drag]')) return;
    // Touch cards remain scrollable. Their separate grip opts into dragging.
    if (event.pointerType === 'touch' && !(event.target as HTMLElement).closest('[data-drag-grip]')) return;
    suppressClick.current = false;
    // Capture immediately so a fast first move cannot leave the card before capture.
    const captureTarget = (event.target as HTMLElement).closest<HTMLElement>('button') || event.currentTarget;
    captureTarget.setPointerCapture(event.pointerId);
    drag.current = { id, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, active: false, stamp, pointer: event.pointerId, target: captureTarget };
  }
  function pointerMove(event: ReactPointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    current.x = event.clientX; current.y = event.clientY;
    if (!current.active && Math.hypot(current.x - current.startX, current.y - current.startY) < 6) return;

    current.active = true; event.preventDefault();
    setGhost({ id: current.id, x: current.x, y: current.y });
    setOver(dropAt(current.x, current.y));
  }
  function pointerUp(event: ReactPointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const target = dropAt(event.clientX, event.clientY);
    cancelDrag();
    if (!current.active) return;
    suppressClick.current = true;
    if (current.stamp !== deckStamp(latest.current.deck.cards) || latest.current.busy) { setMessage('Your deck changed. Please pick up the card again.'); return; }
    if (typeof target === 'number') place(current.id, target);
    else if (target === 'collection' && slots.includes(current.id)) void save(removeCard(deck.cards, current.id), `${BY_ID[current.id].name} returned to your collection.`);
    else setMessage('Card returned. Drop on a highlighted position to place it.');
  }
  function cardEvents(id: string) { return { onPointerDown: (e: ReactPointerEvent<HTMLElement>) => pointerDown(e, id), onPointerMove: pointerMove, onPointerUp: pointerUp, onPointerCancel: () => { suppressClick.current = !!drag.current?.active; cancelDrag(); }, onLostPointerCapture: () => { if (drag.current) cancelDrag(); } }; }
  const clickGuard = (event: React.MouseEvent) => { if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } };
  const grip = (card: Card) => <button type="button" data-drag-grip className="rw-db-grip" aria-label={`Drag or select ${card.name}`} title="Drag to move; tap to select" disabled={busy} onClick={() => choose(card.id)}><FiMove /></button>;
  const slotView = (slot: number) => {
    const card = BY_ID[slots[slot]];
    const valid = !!carried && fitsSlot(carried, slot);
    const label = slot < 10 ? `Infantry ${slot + 1}` : `Support ${slot - 9}`;
    return <div key={slot} data-rw-drop-slot={slot} className={`rw-db-slot ${slot >= 10 ? 'support' : ''} ${card?.rarity || 'empty'} ${valid ? 'compatible' : ''} ${over === slot ? valid ? 'over' : 'invalid' : ''} ${selected === card?.id || targetSlot === slot ? 'selected' : ''}`} {...(card ? cardEvents(card.id) : {})}>
      <span className="rw-db-position">{label}</span>
      <button type="button" className="rw-db-card-main" disabled={busy} aria-label={`${label}: ${card?.name || 'empty'}${carried ? valid ? ', place selected card here' : ', incompatible with selected card' : ''}`} aria-pressed={!!card && selected === card.id || targetSlot === slot} onClick={() => chooseSlot(slot)}>
        {card ? <MiniCard card={card} /> : <span className="rw-db-empty"><FiPlus /><strong>Add {slot < 10 ? 'infantry' : 'support'}</strong><small>Drag a card here</small></span>}
      </button>
      {card && <div className="rw-db-card-tools">{grip(card)}<button type="button" data-no-drag aria-label={`Inspect ${card.name} in deck`} title="Card details" onClick={() => onInspect(card)}><FiInfo /></button><button type="button" data-no-drag disabled={busy} aria-label={`Remove ${card.name} from deck`} title="Return to collection" onClick={() => void save(removeCard(deck.cards, card.id), `${card.name} returned to your collection.`)}><FiX /></button></div>}
      {over === slot && <span className="rw-db-drop-label">{!valid ? 'Wrong row' : card && carried !== card.id ? slots.includes(carried) ? 'Swap cards' : 'Replace card' : 'Place card'}</span>}
    </div>;
  };


  return <section ref={editor} className={'rw-db ' + (ghost ? 'dragging' : '')} onPointerDownCapture={() => { suppressClick.current = false; }} onClickCapture={clickGuard} aria-label="Deck builder">
    <div className="rw-heading"><div><p className="rw-eyebrow">Your company. Your formation.</p><h2>Build your deck.</h2></div><button className="rw-button rw-db-tips-toggle" aria-pressed={tips} onClick={toggleTips}><FiHelpCircle />{tips ? 'Tips on' : 'Tips off'}</button></div>
    <div className="rw-db-toolbar"><label>My decks<select value={deck.id} disabled={busy} onChange={e => onSwitch(e.target.value)}>{decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Deck name<input key={deck.id + deck.name} defaultValue={deck.name} maxLength={40} disabled={busy} onBlur={e => { const name = e.target.value.trim(); if (!name) { e.target.value = deck.name; setMessage('Keep a name for your deck.'); } else if (name !== deck.name) void onSave({ ...deck, name }).then(ok => { if (ok) setMessage('Deck name saved.'); }); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label><button className="rw-button" disabled={busy || ready || !owned.length || deckStamp(fillEmptySlots(slots, owned)) === stamp} onClick={() => void save(fillEmptySlots(slots, owned), 'Empty positions filled from your collection.')}>Auto-fill deck</button><button className="rw-button" disabled={busy || !infantry && !support} onClick={() => void save(deckSlots([]), 'Deck cleared. All cards remain in your collection. Use Undo to restore it.')}>Clear deck</button><button className="rw-button" disabled={busy || !undo || undo.after !== stamp} onClick={() => undo && void save(undo.before, 'Last deck change undone.', false)}><FiRotateCcw /> Undo</button></div>
    {tips && <aside className="rw-db-coach" aria-label="Deck building tip"><FiInfo /><div><strong>{carried ? BY_ID[carried].name : 'Drag your cards up into the empty slots.'}</strong><p>{carried ? supportTip(carried) : 'Place 10 infantry in the upper row and any 5 support below them. Each support belongs to the infantry pair above it. You can also click a card, then click a slot.'}</p></div><button aria-label="Turn off deck tips" onClick={toggleTips}><FiX /></button></aside>}
    <div className="rw-db-status" role="status" aria-live="polite"><span>{busy ? 'Saving…' : message}</span>{(selected || targetSlot !== null) && <button className="rw-text-button" onClick={() => { setSelected(''); setTargetSlot(null); setMessage('Selection cleared.'); }}>Cancel selection <FiX /></button>}</div>
    <div className="rw-db-board-wrap" ref={board}>
      <div className="rw-db-board-heading"><h3>Your deck <small>{infantry + support}/15</small></h3><div><span className={infantry === 10 ? 'complete' : ''}>{infantry}/10 infantry</span><span className={support === 5 ? 'complete' : ''}>{support}/5 support</span></div></div>
      <div className="rw-db-board" aria-label="All 15 deck slots">{SECTIONS.map((name,col) => <section key={name} aria-label={name}><h4>{name}</h4><div className="rw-db-infantry-pair">{slotView(col*2)}{slotView(col*2+1)}</div><span className="rw-db-support-link" aria-hidden="true">↑ SUPPORTS THIS PAIR</span>{slotView(10+col)}</section>)}</div>
      <div className="rw-db-bottom"><span>{battleInProgress ? 'A battle is in progress. Deck changes apply to your next battle.' : ready ? 'All 15 cards placed. Your line is ready.' : 'Place ' + (10-infantry) + ' more infantry and ' + (5-support) + ' more support.'}</span><button className="rw-button gold" disabled={busy || !ready && !battleInProgress} onClick={onPlay}>{battleInProgress ? 'Resume battle' : 'Play against AI'} <FiArrowRight /></button></div>
    </div>
    <section className={'rw-db-library ' + (over === 'collection' ? 'over' : '')} data-rw-drop-library ref={library} aria-label="Your cards">
      <button className="rw-db-tray-toggle" aria-expanded={trayOpen} aria-controls="rw-owned-cards" onClick={() => setTrayOpen(!trayOpen)}><span><FiGrid /><strong>Your cards</strong><small>{owned.length} owned</small></span><span>{trayOpen ? 'Collapse cards' : 'Show cards'}{trayOpen ? <FiChevronDown /> : <FiChevronUp />}</span></button>
      <div id="rw-owned-cards" hidden={!trayOpen}>
        <div className="rw-db-tray-intro"><span><FiChevronUp /> Drag a card up to your deck, or click it and then a slot.</span><button className="rw-text-button" onClick={onPacks}>Get more cards <FiArrowRight /></button></div>
        <details className="rw-db-filters" open={!!query || role !== 'all' || rarity !== 'all' || unused || undefined}><summary>Find &amp; filter cards <span>{visible.length} shown</span></summary><div className="rw-db-browse-tools"><label className="rw-db-search">Find a card<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, role or ability" /></label><label>Card type<select value={role} onChange={e => setRole(e.target.value)}><option value="all">All types</option><option value="infantry">Infantry</option><option value="support">Support</option></select></label><label>Rarity<select value={rarity} onChange={e => setRarity(e.target.value)}><option value="all">All rarities</option><option value="common">Common</option><option value="rare">Rare</option><option value="legendary">Legendary</option></select></label><label className="rw-db-checkbox"><input type="checkbox" checked={unused} onChange={e => setUnused(e.target.checked)} /> Not in this deck</label><span className="rw-db-result-count">{visible.length} shown</span></div></details>
        <div className="rw-db-card-list">{visible.map(card => {
          const inDeck = slots.includes(card.id);
          return <div key={card.id} data-rw-card={card.id} className={'rw-db-library-card ' + card.rarity + (selected === card.id ? ' selected' : '') + (inDeck ? ' included' : '')} {...cardEvents(card.id)}>
            <button className="rw-db-card-main" type="button" disabled={busy} aria-label={'Select ' + card.name} aria-pressed={selected === card.id} onClick={() => choose(card.id)}><MiniCard card={card} /><strong className="rw-db-card-name">{card.name}</strong><span className="rw-db-pick-action">{inDeck ? <FiCheck /> : <FiChevronUp />}{inDeck ? 'In deck · move' : 'Drag up to place'}</span></button>
            <div className="rw-db-card-tools">{grip(card)}<span>{ROLE_NAMES[card.role]}</span><button type="button" data-no-drag aria-label={'Inspect ' + card.name + ' in collection'} title="Card details" onClick={() => onInspect(card)}><FiInfo /></button></div>
          </div>;
        })}</div>
        {!visible.length && <div className="rw-db-no-cards"><strong>{owned.length ? 'No matching cards' : 'Your first 15 cards are free'}</strong><p>{owned.length ? 'Clear the filters to see all your cards.' : 'Open the starter pack, then drag your new cards into the empty slots above.'}</p>{owned.length ? <button className="rw-button" onClick={() => { setQuery(''); setRole('all'); setRarity('all'); setUnused(false); }}>Clear filters</button> : <button className="rw-button gold" onClick={onPacks}>Open free starter <FiArrowRight /></button>}</div>}
      </div>
    </section>
    {tips && <details className="rw-db-help"><summary>Placement tips &amp; controls</summary><p>Drag onto an occupied slot to swap cards or replace it with a card from your collection. Drop a placed card back onto Your cards to remove it. Removing, replacing or clearing never costs cards. Undo reverses your last deck change.</p><p>A Sergeant protects its infantry pair; a Fifer improves its pair’s steady volley. Officers and Drummers unlock orders; Colour Sergeants protect the whole line’s morale.</p><p>On a phone, drag with the four-arrow handle, or tap a card and then a slot. Keyboard: Tab and Enter to select and place; Escape cancels.</p></details>}
    <p className="rw-db-art-note">Temporary portraits use your supplied reference. Inspect a card for its full stats and ability.</p>
    {ghost && createPortal(<div className="rw-root rw-db-ghost" aria-hidden="true" style={{left:Math.min(window.innerWidth-188,Math.max(8,ghost.x+14)),top:Math.min(window.innerHeight-290,Math.max(8,ghost.y-65))}}><MiniCard card={BY_ID[ghost.id]} /></div>,document.body)}
  </section>;
}
