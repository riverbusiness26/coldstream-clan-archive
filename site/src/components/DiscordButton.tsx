import { FaDiscord } from 'react-icons/fa';
import type { Me } from '../lib/auth';

export default function DiscordButton({ me, signIn }: { me: Me | null; signIn: () => void }) {
  if (me) {
    return (
      <span className="discord-auth compact signed" title="Signed in through Discord">
        {me.avatar_url
          ? <img className="savi" src={me.avatar_url} alt="" />
          : <FaDiscord aria-hidden="true" />}
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
