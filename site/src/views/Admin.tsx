import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaAward, FaClipboardCheck, FaHistory, FaImage, FaMedal, FaNewspaper, FaSearch, FaShieldAlt, FaUsers } from 'react-icons/fa';
import { supa, DEMO } from '../lib/supa';
import type { Me } from '../lib/auth';

type Tab = 'catalogue' | 'assignments' | 'members' | 'evidence' | 'audit' | 'news';
type ItemKind = 'rank' | 'medal';
interface PersonnelItem { id: string; kind: ItemKind; name: string; description: string | null; storage_key: string; image_mime: string; active: boolean; sort_order: number; created_at: string }
interface MemberRow { id: string; display_name: string; avatar_url: string | null; discord_id: string | null; role: string }
interface AssignmentRow { id: string; member_id: string; item_id: string; item_kind: ItemKind; assigned_by: string; assigned_at: string; note: string | null; removed_at: string | null }
interface AuditRow { id: number; actor_id: string | null; action: string; member_id: string | null; item_id: string | null; created_at: string }
interface NewsRow { id: string; title: string; body: string; author: string | null; created_at: string }

const PREVIEW_ITEMS: PersonnelItem[] = [
  { id: 'preview-rank', kind: 'rank', name: 'Rank artwork', description: 'Upload the approved insignia and place it in the rank ladder.', storage_key: '', image_mime: 'image/webp', active: true, sort_order: 0, created_at: new Date().toISOString() },
  { id: 'preview-medal', kind: 'medal', name: 'Medal artwork', description: 'Medals stay in the catalogue and can be assigned to more than one member.', storage_key: '', image_mime: 'image/webp', active: true, sort_order: 1, created_at: new Date().toISOString() },
];
const PREVIEW_MEMBERS: MemberRow[] = [{ id: 'preview-member', display_name: 'Discord Member', avatar_url: null, discord_id: 'preview', role: 'member' }];
const tabs: { id: Tab; label: string; icon: typeof FaImage }[] = [
  { id: 'catalogue', label: 'Catalogue', icon: FaImage },
  { id: 'assignments', label: 'Assignments', icon: FaAward },
  { id: 'members', label: 'Members', icon: FaUsers },
  { id: 'evidence', label: 'Evidence', icon: FaClipboardCheck },
  { id: 'audit', label: 'Audit log', icon: FaHistory },
  { id: 'news', label: 'News', icon: FaNewspaper },
];
const emptyNews = { id: null as string | null, title: '', body: '' };
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const labelAction = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function Admin({ me }: { me: Me | null }) {
  const canStaff = me?.role === 'moderator' || me?.role === 'admin';
  const canUpload = me?.role === 'admin';
  const [tab, setTab] = useState<Tab>('catalogue');
  const [items, setItems] = useState<PersonnelItem[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [catalogueFilter, setCatalogueFilter] = useState<'all' | ItemKind>('all');
  const [memberSearch, setMemberSearch] = useState('');
  const [assignMembers, setAssignMembers] = useState<string[]>([]);
  const [assignItem, setAssignItem] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemKind, setItemKind] = useState<ItemKind>('rank');
  const [itemDescription, setItemDescription] = useState('');
  const [itemFile, setItemFile] = useState<File | null>(null);
  const [news, setNews] = useState<NewsRow[]>([]);
  const [newsDraft, setNewsDraft] = useState(emptyNews);
  const [galleryPending, setGalleryPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // The message banner sits at the top of the board and the upload form is a
  // long way below it, so a failed upload looked like nothing happening at
  // all. That is how the audit trigger bug went unnoticed: the error was on
  // screen the whole time, just not on the part of the screen being used.
  useEffect(() => {
    if (!error && !done) return;
    document.querySelector('.command-message')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [error, done]);

  const load = useCallback(async () => {
    setError(null);
    if (!supa) {
      setItems(PREVIEW_ITEMS); setMembers(PREVIEW_MEMBERS); setAssignments([]); setAudit([]); setNews([]); setGalleryPending(0);
      return;
    }
    const [itemResult, memberResult, assignmentResult, auditResult, newsResult, galleryResult] = await Promise.all([
      supa.from('personnel_item').select('id,kind,name,description,storage_key,image_mime,active,sort_order,created_at').order('kind').order('sort_order').order('name'),
      supa.from('member').select('id,display_name,avatar_url,discord_id,role').order('display_name'),
      supa.from('personnel_assignment').select('id,member_id,item_id,item_kind,assigned_by,assigned_at,note,removed_at').is('removed_at', null).order('assigned_at', { ascending: false }),
      supa.from('personnel_audit').select('id,actor_id,action,member_id,item_id,created_at').order('created_at', { ascending: false }).limit(100),
      supa.from('news_item').select('id,title,body,author,created_at').order('created_at', { ascending: false }).limit(40),
      supa.from('gallery_item').select('id').eq('approved', false),
    ]);
    const firstError = itemResult.error || memberResult.error || assignmentResult.error || auditResult.error;
    if (firstError) { setError(/personnel_/i.test(firstError.message) ? 'The Command Board database migration has not been applied yet.' : firstError.message); return; }
    setItems((itemResult.data ?? []) as PersonnelItem[]); setMembers((memberResult.data ?? []) as MemberRow[]);
    setAssignments((assignmentResult.data ?? []) as AssignmentRow[]); setAudit((auditResult.data ?? []) as AuditRow[]);
    setNews((newsResult.data ?? []) as NewsRow[]); setGalleryPending(galleryResult.data?.length ?? 0);
  }, []);

  useEffect(() => { if (canStaff) load(); }, [canStaff, load]);
  useEffect(() => {
    if (!selectedItem && items[0]) setSelectedItem(items[0].id);
    if (!assignItem && items[0]) setAssignItem(items[0].id);
    if (!assignMembers.length && members[0]) setAssignMembers([members[0].id]);
  }, [items, members, selectedItem, assignItem, assignMembers.length]);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const currentItem = items.find((item) => item.id === selectedItem) ?? null;
  const visibleItems = items.filter((item) => catalogueFilter === 'all' || item.kind === catalogueFilter);
  const visibleMembers = members.filter((member) => member.display_name.toLowerCase().includes(memberSearch.toLowerCase()));
  const artworkUrl = (item: PersonnelItem) => !item.storage_key || !supa ? null : supa.storage.from('personnel-artwork').getPublicUrl(item.storage_key).data.publicUrl;

  async function confirmDiscordRole() {
    if (!supa) return true;
    const result = await supa.functions.invoke('discord-member-sync', { body: {} });
    if (result.error || result.data?.ok !== true) {
      setError(result.data?.error || 'Your current Discord role could not be confirmed.');
      return false;
    }
    return true;
  }

  async function uploadItem() {
    setError(null); setDone(null);
    if (!canUpload) { setError('Only admins can upload rank and medal artwork.'); return; }
    if (!itemName.trim()) { setError('Give the item a name.'); return; }
    if (!itemFile) { setError('Choose an image to upload.'); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(itemFile.type)) { setError('Use a PNG, JPEG or WebP image.'); return; }
    if (itemFile.size > 5 * 1024 * 1024) { setError('The image must be 5 MB or smaller.'); return; }
    if (!supa || !me) { setDone('Preview only. Nothing was uploaded.'); return; }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    const extension = itemFile.type === 'image/png' ? 'png' : itemFile.type === 'image/jpeg' ? 'jpg' : 'webp';
    const storageKey = `${me.id}/${crypto.randomUUID()}.${extension}`;
    const upload = await supa.storage.from('personnel-artwork').upload(storageKey, itemFile, { contentType: itemFile.type, upsert: false });
    if (upload.error) { setBusy(false); setError(upload.error.message); return; }
    const insert = await supa.from('personnel_item').insert({ kind: itemKind, name: itemName.trim(), description: itemDescription.trim() || null, storage_key: storageKey, image_mime: itemFile.type }).select('id').single();
    if (insert.error) { await supa.storage.from('personnel-artwork').remove([storageKey]); setBusy(false); setError(insert.error.message); return; }
    setBusy(false); setItemName(''); setItemDescription(''); setItemFile(null); setSelectedItem(insert.data.id); setDone('Artwork added to the catalogue.'); await load();
  }

  async function toggleItem(item: PersonnelItem) {
    setError(null); setDone(null);
    if (!canUpload) { setError('Only admins can change catalogue items.'); return; }
    if (!supa) { setDone('Preview only. Nothing was changed.'); return; }
    if (!await confirmDiscordRole()) return;
    const result = await supa.from('personnel_item').update({ active: !item.active, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (result.error) { setError(result.error.message); return; }
    setDone(item.active ? 'Item archived.' : 'Item restored.'); await load();
  }

  async function assign() {
    setError(null); setDone(null);
    if (!assignMembers.length || !assignItem) { setError('Choose at least one member and an item.'); return; }
    if (!supa) { setDone('Assignment preview complete. Nothing was saved.'); return; }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    const results = await Promise.all(assignMembers.map((memberId) => supa!.rpc('assign_personnel_item', { target_member: memberId, target_item: assignItem, assignment_note: assignNote.trim() || null })));
    setBusy(false);
    const failed = results.find((result) => result.error);
    if (failed?.error) { setError(failed.error.message); return; }
    setAssignNote(''); setDone(assignMembers.length === 1 ? 'Assignment saved.' : `Assignments saved for ${assignMembers.length} members.`); await load();
  }

  async function removeAssignment(id: string) {
    setError(null); setDone(null);
    if (!supa) { setDone('Removal preview complete. Nothing was saved.'); return; }
    if (!await confirmDiscordRole()) return;
    const result = await supa.rpc('remove_personnel_assignment', { target_assignment: id });
    if (result.error) { setError(result.error.message); return; }
    setDone(result.data ? 'Assignment removed.' : 'That assignment was already removed.'); await load();
  }

  async function saveNews() {
    setError(null); setDone(null);
    const title = newsDraft.title.trim(); const body = newsDraft.body.trim();
    if (!title || !body) { setError('Give the post a title and something to say.'); return; }
    if (!supa || !me) { setDone('Preview only. Nothing was posted.'); return; }
    setBusy(true);
    const result = newsDraft.id ? await supa.from('news_item').update({ title, body }).eq('id', newsDraft.id) : await supa.from('news_item').insert({ title, body, author: me.display_name, source_site: 'coldstreamgaming.com', posted_by: me.id });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setNewsDraft(emptyNews); setDone(newsDraft.id ? 'News post saved.' : 'News post published.'); await load();
  }

  async function removeNews(id: string) {
    setError(null); setDone(null);
    if (!supa) { setDone('Preview only. Nothing was removed.'); return; }
    const result = await supa.from('news_item').delete().eq('id', id).select('id');
    if (result.error) { setError(result.error.message); return; }
    if (!result.data?.length) { setError('The database did not allow that deletion.'); return; }
    if (newsDraft.id === id) setNewsDraft(emptyNews);
    setDone('News post removed.'); await load();
  }

  if (!canStaff) return <div className="wrap solo"><main><div className="module"><div className="mhead"><h3>Personnel Command Board</h3></div><div className="note">This part of the site is for moderators and admins. Sign in through Discord so the site can check your current role.</div></div></main></div>;

  return (
    <main className="command-board">
      <header className="command-head">
        <div><p className="command-kicker"><FaShieldAlt /> Coldstream personnel</p><h1>Command Board</h1><p>Manage rank and medal artwork, assign service records, and keep every change accountable.</p></div>
        <div className="command-session"><span>{me!.role}</span><b>{me!.display_name}</b><small>Role checked through Discord</small></div>
      </header>
      <nav className="command-tabs" aria-label="Command Board sections">
        {tabs.map((entry) => { const Icon = entry.icon; return <button key={entry.id} className={tab === entry.id ? 'active' : ''} onClick={() => { setTab(entry.id); setError(null); setDone(null); }}><Icon />{entry.label}{entry.id === 'evidence' && <small>Future</small>}</button>; })}
      </nav>
      {DEMO && <div className="command-banner"><b>Preview mode.</b> Sign in, uploads and assignments are simulated.</div>}
      {galleryPending !== null && galleryPending > 0 && <div className="command-banner"><b>{galleryPending}</b> gallery {galleryPending === 1 ? 'submission is' : 'submissions are'} waiting. <a href="#/gallery">Open the gallery.</a></div>}
      {error && <div className="command-message error" role="alert">{error}</div>}
      {done && <div className="command-message ok" role="status">{done}</div>}

      {tab === 'catalogue' && <section className="command-workspace">
        <div className="catalogue-list">
          <div className="command-section-head"><div><span>Artwork library</span><h2>Ranks and medals</h2></div><b>{items.length}</b></div>
          <div className="catalogue-filters"><button className={catalogueFilter === 'all' ? 'active' : ''} onClick={() => setCatalogueFilter('all')}>All</button><button className={catalogueFilter === 'rank' ? 'active' : ''} onClick={() => setCatalogueFilter('rank')}>Ranks</button><button className={catalogueFilter === 'medal' ? 'active' : ''} onClick={() => setCatalogueFilter('medal')}>Medals</button></div>
          <div className="catalogue-scroll">{visibleItems.length === 0 && <div className="command-empty">No artwork has been uploaded in this section yet.</div>}{visibleItems.map((item) => { const url = artworkUrl(item); return <button className={`catalogue-row ${selectedItem === item.id ? 'active' : ''}`} key={item.id} onClick={() => setSelectedItem(item.id)}><span className={`catalogue-thumb ${item.kind}`}>{url ? <img src={url} alt="" /> : item.kind === 'rank' ? <FaShieldAlt /> : <FaMedal />}</span><span><small>{item.kind}</small><b>{item.name}</b><em>{item.active ? 'Available' : 'Archived'}</em></span></button>; })}</div>
        </div>
        <div className="catalogue-detail">{currentItem ? <><div className="catalogue-art">{artworkUrl(currentItem) ? <img src={artworkUrl(currentItem)!} alt={`${currentItem.name} artwork`} /> : currentItem.kind === 'rank' ? <FaShieldAlt /> : <FaMedal />}</div><p className="command-kicker">{currentItem.kind}</p><h2>{currentItem.name}</h2><p>{currentItem.description || 'No description has been added.'}</p><dl className="catalogue-facts"><div><dt>Current holders</dt><dd>{assignments.filter((row) => row.item_id === currentItem.id).length}</dd></div><div><dt>Status</dt><dd>{currentItem.active ? 'Available' : 'Archived'}</dd></div><div><dt>Added</dt><dd>{date(currentItem.created_at)}</dd></div></dl>{canUpload && <button className="command-secondary" onClick={() => toggleItem(currentItem)}>{currentItem.active ? 'Archive item' : 'Restore item'}</button>}</> : <div className="command-empty">Select an item to inspect it.</div>}</div>
        <aside className="catalogue-upload"><div className="command-section-head"><div><span>Admin only</span><h2>Upload artwork</h2></div><FaImage /></div>{canUpload ? <div className="command-form"><label>Type<select value={itemKind} onChange={(event) => setItemKind(event.target.value as ItemKind)}><option value="rank">Rank</option><option value="medal">Medal</option></select></label><label>Name<input value={itemName} maxLength={80} onChange={(event) => setItemName(event.target.value)} placeholder="Item name" /></label><label>Description<textarea value={itemDescription} maxLength={500} onChange={(event) => setItemDescription(event.target.value)} placeholder="What this rank or medal represents" /></label><label className="command-file"><span>PNG, JPEG or WebP, up to 5 MB</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setItemFile(event.target.files?.[0] ?? null)} /></label><button className="command-primary" onClick={uploadItem} disabled={busy}>{busy ? 'Uploading' : 'Add to catalogue'}</button></div> : <div className="command-locked"><FaShieldAlt /><b>Admin access required</b><p>Moderators can assign existing artwork but cannot upload or replace image files.</p></div>}</aside>
      </section>}

      {tab === 'assignments' && <section className="command-panel-grid">
        <div className="command-card assign-card"><div className="command-section-head"><div><span>Service record</span><h2>Assign an item</h2></div><FaAward /></div><div className="command-form horizontal"><label>Members <small>Use Ctrl or Shift to select several.</small><select className="member-multi" multiple value={assignMembers} onChange={(event) => setAssignMembers(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>{members.map((member) => <option value={member.id} key={member.id}>{member.display_name}</option>)}</select></label><label>Rank or medal<select value={assignItem} onChange={(event) => setAssignItem(event.target.value)}>{items.filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.kind === 'rank' ? 'Rank' : 'Medal'}: {item.name}</option>)}</select></label><label>Note<input value={assignNote} maxLength={300} onChange={(event) => setAssignNote(event.target.value)} placeholder="Optional reason or event" /></label><button className="command-primary" onClick={assign} disabled={busy || !items.length || !members.length}>{busy ? 'Saving' : assignMembers.length > 1 ? `Assign to ${assignMembers.length} members` : 'Assign item'}</button></div></div>
        <div className="command-card"><div className="command-section-head"><div><span>Current</span><h2>Active assignments</h2></div><b>{assignments.length}</b></div><div className="assignment-list">{assignments.length === 0 && <div className="command-empty">No ranks or medals have been assigned yet.</div>}{assignments.map((row) => <article key={row.id}><span className={`assignment-mark ${row.item_kind}`}>{row.item_kind === 'rank' ? <FaShieldAlt /> : <FaMedal />}</span><div><b>{itemById.get(row.item_id)?.name ?? 'Unknown item'}</b><span>{memberById.get(row.member_id)?.display_name ?? 'Unknown member'} · {date(row.assigned_at)}</span>{row.note && <small>{row.note}</small>}</div><button onClick={() => removeAssignment(row.id)}>Remove</button></article>)}</div></div>
      </section>}

      {tab === 'members' && <section className="command-card"><div className="command-section-head"><div><span>Discord roster</span><h2>Members</h2></div><b>{members.length}</b></div><label className="command-search"><FaSearch /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search members" /></label><div className="member-command-list">{visibleMembers.map((member) => { const records = assignments.filter((row) => row.member_id === member.id); const rank = records.find((row) => row.item_kind === 'rank'); return <article key={member.id}><span className="member-avatar">{member.avatar_url ? <img src={member.avatar_url} alt="" /> : member.display_name.slice(0, 1).toUpperCase()}</span><div><b>{member.display_name}</b><span>{member.role} · {member.discord_id ? 'Discord linked' : 'Discord not linked'}</span></div><div className="member-record"><span>{rank ? itemById.get(rank.item_id)?.name : 'No rank'}</span><span>{records.filter((row) => row.item_kind === 'medal').length} medals</span></div><button onClick={() => { setAssignMembers([member.id]); setTab('assignments'); }}>Assign</button></article>; })}</div></section>}

      {tab === 'evidence' && <section className="command-card evidence-shell"><div className="command-section-head"><div><span>Future profile feature</span><h2>Evidence Queue</h2></div><span className="future-pill">Intake closed</span></div><div className="evidence-intro"><FaClipboardCheck /><div><h3>The foundation is in place</h3><p>Member submissions will land here for staff review. Nothing can be submitted yet, and no unverified claim will appear on a profile.</p></div></div><div className="evidence-types"><article><FaAward /><span>Event record</span><h3>Event kills</h3><p>Members will name the event, report the result and attach proof.</p></article><article><FaShieldAlt /><span>Server record</span><h3>Public server kills</h3><p>Claims will include the server, game and supporting screenshot.</p></article><article><FaImage /><span>Proof</span><h3>Screenshots</h3><p>Images will be stored separately from rank and medal artwork.</p></article></div><div className="evidence-flow"><span>Member submits</span><i /><span>Staff reviews</span><i /><span>Accepted record</span><i /><span>Player profile</span></div></section>}

      {tab === 'audit' && <section className="command-card"><div className="command-section-head"><div><span>Accountability</span><h2>Audit log</h2></div><b>{audit.length}</b></div><div className="audit-list">{audit.length === 0 && <div className="command-empty">Changes will appear here after the first catalogue upload or assignment.</div>}{audit.map((row) => <article key={row.id}><FaHistory /><div><b>{labelAction(row.action)}</b><span>{row.member_id ? memberById.get(row.member_id)?.display_name ?? 'Member' : 'Catalogue'}{row.item_id ? ` · ${itemById.get(row.item_id)?.name ?? 'Item'}` : ''}</span></div><time>{date(row.created_at)}</time></article>)}</div></section>}

      {tab === 'news' && <section className="command-panel-grid news-grid"><div className="command-card"><div className="command-section-head"><div><span>Front page</span><h2>{newsDraft.id ? 'Edit news' : 'Post news'}</h2></div><FaNewspaper /></div><div className="command-form"><label>Headline<input value={newsDraft.title} maxLength={140} onChange={(event) => setNewsDraft({ ...newsDraft, title: event.target.value })} /></label><label>Post<textarea value={newsDraft.body} maxLength={4000} onChange={(event) => setNewsDraft({ ...newsDraft, body: event.target.value })} /></label><button className="command-primary" onClick={saveNews} disabled={busy}>{busy ? 'Saving' : newsDraft.id ? 'Save changes' : 'Post it'}</button></div></div><div className="command-card"><div className="command-section-head"><div><span>Published</span><h2>News posts</h2></div><b>{news.length}</b></div><div className="news-command-list">{news.length === 0 && <div className="command-empty">No editable news posts yet.</div>}{news.map((row) => <article key={row.id}><b>{row.title}</b><span>{date(row.created_at)}{row.author ? ` · ${row.author}` : ''}</span><p>{row.body}</p><div className="news-actions"><button onClick={() => setNewsDraft({ id: row.id, title: row.title, body: row.body })}>Edit</button><button onClick={() => removeNews(row.id)}>Delete</button></div></article>)}</div></div></section>}
    </main>
  );
}
