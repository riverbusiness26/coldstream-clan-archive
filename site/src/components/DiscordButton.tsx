import { FaDiscord } from 'react-icons/fa';
import type { Me } from '../lib/auth';
import DiscordAvatar from './DiscordAvatar';

export default function DiscordButton({ me, signIn }: { me: Me | null; signIn: () => void }) {
  if (me) {
    return (
      <span className="discord-auth compact signed" title="Signed in through Discord">
        <DiscordAvatar url={me.avatar_url} name={me.display_name} className="savi" />
        <span>Signed in as <b>{me.display_name}</b></span>
      </span>
    );
  }
  return (
    <button className="discord-auth compact" onClick={signIn} aria-label="Sign in with Discord">
      <FaDiscord aria-hidden="true" />
      <span>Sign in with Discord</span>
    </button>
  );
}
