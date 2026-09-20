import { useEffect, useRef, useState } from 'react';
import { applyAction, freshSave, readSave, SAVE_KEY, type Action, type Save } from './store';
export function useGame() {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [state, setState] = useState<Save>(() => { try { return readSave(localStorage.getItem(SAVE_KEY)); } catch { return freshSave(); } });
  const current = useRef(state); const locked = useRef(false); const broken = useRef(false);
  useEffect(() => {
    const refresh = () => { try { const next = readSave(localStorage.getItem(SAVE_KEY)); current.current = next; setState(next); broken.current = false; } catch { broken.current = true; setError('Your preview save is unreadable. Export it for recovery or reset this preview in the Field Manual. Nothing has been overwritten.'); } };
    refresh(); const change = (e: StorageEvent) => { if (e.key === SAVE_KEY) refresh(); }; window.addEventListener('storage', change); return () => window.removeEventListener('storage', change);
  }, []);
  async function act(action: Action): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true; setBusy(true); setError('');
    try {
      if (broken.current) throw new Error('Recover or reset the unreadable preview before continuing.');
      const write = () => {
        const latest = readSave(localStorage.getItem(SAVE_KEY));
        if (latest.revision !== current.current.revision) { current.current = latest; setState(latest); throw new Error('Another tab updated your game. The latest save is loaded; try that action again.'); }
        const next = applyAction(latest, action);
        localStorage.setItem(SAVE_KEY, JSON.stringify(next)); current.current = next; setState(next);
      };
      if (navigator.locks) await navigator.locks.request(SAVE_KEY, write); else write();
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'The preview could not save. Check browser storage and try again.'); return false; }
    finally { locked.current = false; setBusy(false); }
  }
  async function reset() {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try {
      const write = () => { const next = freshSave(); localStorage.setItem(SAVE_KEY, JSON.stringify(next)); current.current = next; broken.current = false; setState(next); setError(''); };
      if (navigator.locks) await navigator.locks.request(SAVE_KEY, write); else write();
    } catch { setError('Browser storage is unavailable. The preview could not reset.'); }
    finally { locked.current = false; setBusy(false); }
  }
  return { state, act, reset, busy, error, setError };
}
