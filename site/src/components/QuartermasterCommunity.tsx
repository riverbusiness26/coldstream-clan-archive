import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { FiMessageCircle, FiSend, FiUsers, FiX } from 'react-icons/fi';
import DiscordAvatar from './DiscordAvatar';
import { supa } from '../lib/supa';
import { useOnlineDiscordIds } from '../lib/sitePresence';
import type { QuartermasterSnapshot } from '../lib/quartermaster';
import type { QuartermasterDirectory, QuartermasterMember } from '../lib/quartermasterMembers';

type ChatAuthor = Pick<QuartermasterMember, 'id' | 'display_name' | 'avatar_url' | 'discord_id'>;
type ChatMessage = { id: string; author_id: string; body: string; created_at: string; author: ChatAuthor | ChatAuthor[] | null };
const authorOf = (value: ChatMessage['author']) => Array.isArray(value) ? value[0] ?? null : value;

export default function QuartermasterCommunity({ snapshot, directory }: { snapshot: QuartermasterSnapshot; directory: QuartermasterDirectory }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'players'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [unread, setUnread] = useState(0);
  const self = directory[snapshot.profile.discordId];
  const onlineDiscordIds = useOnlineDiscordIds();

  const load = useCallback(async () => {
    if (!supa || !self) return;
    setLoading(true);
    const { data, error: loadError } = await supa.from('quartermaster_chat_message')
      .select('id,author_id,body,created_at,author:member!quartermaster_chat_message_author_id_fkey(id,display_name,avatar_url,discord_id)')
      .order('created_at', { ascending: false }).limit(100);
    setLoading(false);
    if (loadError) { setError('Mess Chat is unavailable right now.'); return; }
    setMessages(((data ?? []) as unknown as ChatMessage[]).reverse());
  }, [self]);

  useEffect(() => {
    if (!supa || !self) return;
    void load();
    const channel = supa.channel('quartermaster-mess-chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quartermaster_chat_message' }, () => {
        if (!open) setUnread(value => value + 1);
        void load();
      }).subscribe();
    return () => { void supa?.removeChannel(channel); };
  }, [load, open, self]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!supa || !self || !body.trim() || sending) return;
    setSending(true); setError('');
    const { error: sendError } = await supa.from('quartermaster_chat_message').insert({ author_id: self.id, body: body.trim() });
    setSending(false);
    if (sendError) { setError(sendError.message.includes('Slow down') ? 'Give the conversation a few seconds before sending again.' : 'That message could not be sent.'); return; }
    setBody('');
    await load();
  }

  async function remove(id: string) {
    if (!supa) return;
    const { error: removeError } = await supa.from('quartermaster_chat_message').delete().eq('id', id);
    if (removeError) setError('That message could not be removed.');
    else await load();
  }

  const players = [...snapshot.leaderboard].sort((a, b) => a.displayName.localeCompare(b.displayName));
  const widget = <div className="qm-community-widget" data-open={open ? 'true' : 'false'}>
    <button className={`qm-community-launcher${open ? ' is-open' : ''}`} aria-label={open ? 'Close Mess Chat' : 'Open Mess Chat'} aria-expanded={open} aria-controls="qm-community-drawer" onClick={() => { setOpen(value => !value); setUnread(0); }}>{open ? <FiX /> : <FiMessageCircle />}<span>{open ? 'Close Mess' : 'Mess Chat'}</span>{unread > 0 && !open && <b>{Math.min(unread, 9)}{unread > 9 ? '+' : ''}</b>}</button>
    {open && <aside className="qm-community-drawer" id="qm-community-drawer" aria-label="Shillings social room">
      <header><div><p className="qm-eyebrow">The company mess</p><h2>Chat & players</h2></div><button aria-label="Close chat" onClick={() => setOpen(false)}><FiX /></button></header>
      <nav aria-label="Social room sections"><button className={view === 'chat' ? 'active' : ''} aria-pressed={view === 'chat'} onClick={() => setView('chat')}><FiMessageCircle /> Chat</button><button className={view === 'players' ? 'active' : ''} aria-pressed={view === 'players'} onClick={() => setView('players')}><FiUsers /> Players <small>{players.length}</small></button></nav>
      {view === 'chat' && <div className="qm-community-chat">
        <div className="qm-chat-lines" aria-live="polite">{loading && !messages.length ? <p className="qm-chat-empty">Opening the Mess Chat…</p> : !supa ? <p className="qm-chat-empty">Chat connects when you open the live Shillings page as a signed-in member.</p> : !self ? <p className="qm-chat-empty">Connecting your Discord profile…</p> : messages.length ? messages.map(message => { const author = authorOf(message.author); return <article key={message.id}><a href={author ? `#/member/${encodeURIComponent(author.id)}` : '#/stores'}><DiscordAvatar url={author?.avatar_url ?? null} name={author?.display_name ?? 'Member'} /></a><div><span><strong>{author?.display_name ?? 'Member'}</strong><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>{message.author_id === self.id && <button onClick={() => void remove(message.id)} aria-label="Remove your message"><FiX /></button>}</span><p>{message.body}</p></div></article>; }) : <p className="qm-chat-empty">No messages yet. Pull up a chair.</p>}</div>
        <form onSubmit={send}><label htmlFor="qm-chat-message">Message the mess</label><div><input id="qm-chat-message" value={body} onChange={event => setBody(event.target.value)} maxLength={500} placeholder="Write a message" disabled={!supa || !self || sending} /><button aria-label="Send message" disabled={!body.trim() || !supa || !self || sending}><FiSend /></button></div>{error && <p role="alert">{error}</p>}<small>{body.length}/500 · members only</small></form>
      </div>}
      {view === 'players' && <div className="qm-community-players">{players.map(player => { const member = directory[player.discordId]; const online = onlineDiscordIds.has(player.discordId); return <a key={player.discordId} href={member ? `#/member/${encodeURIComponent(member.id)}` : '#/stores'} aria-label={`Open ${player.displayName}'s profile`} data-online={online ? 'true' : 'false'}><DiscordAvatar url={member?.avatar_url ?? null} name={player.displayName} /><span><strong>{online && <i className="qm-online-dot" role="img" aria-label={`${player.displayName} is online on the site`} title="Online on the site" />}{player.displayName}</strong><small>{player.title}</small></span></a>; })}</div>}
      <footer><span>Community chat and profiles are live.</span><small>Private messages are still WIP.</small></footer>
    </aside>}
  </div>;
  return typeof document === 'undefined' ? null : createPortal(widget, document.body);
}
