import { useState } from 'react';
import type { Me } from '../lib/auth';
import Admin from './Admin';
import JukeboxAdmin from '../components/JukeboxAdmin';
import '../jukebox-admin.css';

// Keep the separately maintained staff tools intact while adding music management.
export default function AdminWorkspace({ me, signOut }: { me: Me | null; signOut: () => void }) {
  const [music, setMusic] = useState(false);
  return <>
    {me?.role === 'admin' && <nav className="jukebox-admin-nav" aria-label="Admin workspace">
      <button aria-pressed={!music} onClick={() => setMusic(false)}>Staff tools</button>
      <button aria-pressed={music} onClick={() => setMusic(true)}>Jukebox music</button>
    </nav>}
    {music && me?.role === 'admin' ? <JukeboxAdmin role={me.role}/> : <Admin me={me} signOut={signOut}/>}
  </>;
}
