import { FaDiscord } from 'react-icons/fa';

export default function DiscordAvatar({ url, name, className = '' }: { url: string | null; name: string; className?: string }) {
  return (
    <span className={`discord-avatar ${className}`.trim()} title={`${name}'s Discord avatar`}>
      <FaDiscord aria-hidden="true" />
      {url && <img key={url} src={url} alt="" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />}
    </span>
  );
}
