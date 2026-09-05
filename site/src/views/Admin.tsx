import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaArrowsAltV, FaAward, FaBars, FaCalendarCheck, FaClipboardCheck, FaCog, FaFlag, FaHistory, FaHome, FaImage, FaMedal, FaSearch, FaShieldAlt, FaSignOutAlt, FaUsers } from 'react-icons/fa';
import { supa, DEMO } from '../lib/supa';
import type { Me } from '../lib/auth';
import DiscordAvatar from '../components/DiscordAvatar';

type Tab = 'overview' | 'catalogue' | 'detachments' | 'assignments' | 'members' | 'attendance' | 'evidence' | 'audit' | 'settings';
type ItemKind = 'rank' | 'medal';
interface PersonnelItem { id: string; kind: ItemKind; name: string; description: string | null; storage_key: string | null; image_mime: string | null; active: boolean; sort_order: number; created_at: string }
interface MemberRow { id: string; display_name: string; avatar_url: string | null; discord_id: string | null; role: string; company_id: string | null }
interface CompanyRow { id: string; name: string; tag: string | null; color: string | null; emblem_storage_key: string | null; emblem_image_mime: string | null; sort_order: number }
interface AssignmentRow { id: string; member_id: string; item_id: string; item_kind: ItemKind; assigned_by: string; assigned_at: string; note: string | null; removed_at: string | null }
interface AuditRow { id: number; actor_id: string | null; action: string; member_id: string | null; item_id: string | null; created_at: string }
interface EventRow { id: string; title: string; body: string | null; game: string | null; starts_at: string; duration_minutes: number; cancelled: boolean; event_type: string; deleted_at: string | null }
interface RsvpRow { event_id: string; member_id: string; status: string | null; attendance: 'attended' | 'no_show' | null }
interface PresenceRollRow { event_id: string; discord_id: string; samples: number; first_seen: string; last_seen: string }
interface PresenceWindowRow { event_id: string; samples_taken: number; people_seen: number; first_sample: string; last_sample: string }

const PREVIEW_ITEMS: PersonnelItem[] = [
  { id: 'preview-rank', kind: 'rank', name: 'Rank artwork', description: 'Upload the approved insignia and place it in the rank ladder.', storage_key: '', image_mime: 'image/webp', active: true, sort_order: 0, created_at: new Date().toISOString() },
  { id: 'preview-medal', kind: 'medal', name: 'Medal artwork', description: 'Medals stay in the catalogue and can be assigned to more than one member.', storage_key: '', image_mime: 'image/webp', active: true, sort_order: 1, created_at: new Date().toISOString() },
];
const PREVIEW_MEMBERS: MemberRow[] = [{ id: 'preview-member', display_name: 'Discord Member', avatar_url: null, discord_id: 'preview', role: 'member', company_id: null }];
const PREVIEW_COMPANIES: CompanyRow[] = [{ id: 'preview-company', name: '2nd Coldstream Guards', tag: '2ndCS', color: null, emblem_storage_key: null, emblem_image_mime: null, sort_order: 0 }];
const PREVIEW_EVENTS: EventRow[] = [{ id: 'preview-event', title: 'Friday Linebattle', body: 'Form up 15 minutes before the event.', game: 'Holdfast: Nations At War', starts_at: new Date(Date.now() + 86_400_000).toISOString(), duration_minutes: 90, cancelled: false, event_type: 'linebattle', deleted_at: null }];
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const dateTime = (value: string) => new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const dateInputValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const labelAction = (value: string) => value.replaceAll('_', ' ').replaceAll('.', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function Admin({ me, signOut }: { me: Me | null; signOut: () => void }) {
  const canStaff = me?.role === 'moderator' || me?.role === 'admin';
  const canUpload = me?.role === 'admin';
  const [tab, setTab] = useState<Tab>(() => {
    const saved = window.localStorage.getItem('coldstream-admin-section') as Tab | null;
    return saved && ['overview', 'catalogue', 'detachments', 'assignments', 'members', 'attendance', 'evidence', 'audit', 'settings'].includes(saved) ? saved : 'overview';
  });
  const [navOpen, setNavOpen] = useState(false);
  const [items, setItems] = useState<PersonnelItem[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [draggingItem, setDraggingItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  // Delete is two clicks, not a browser confirm dialog: it is irreversible and
  // the artwork does not come back.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [catalogueFilter, setCatalogueFilter] = useState<'all' | ItemKind>(() => (window.localStorage.getItem('coldstream-admin-catalogue-filter') as 'all' | ItemKind | null) ?? 'all');
  const [memberSearch, setMemberSearch] = useState(() => window.localStorage.getItem('coldstream-admin-member-search') ?? '');
  const [globalSearch, setGlobalSearch] = useState('');
  const [assignMembers, setAssignMembers] = useState<string[]>([]);
  const [assignItem, setAssignItem] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [detachmentDrafts, setDetachmentDrafts] = useState<Record<string, string>>({});
  const [companyEdit, setCompanyEdit] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyTag, setCompanyTag] = useState('');
  const [companyFile, setCompanyFile] = useState<File | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemKind, setItemKind] = useState<ItemKind>('rank');
  const [itemDescription, setItemDescription] = useState('');
  const [itemFile, setItemFile] = useState<File | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [presenceRoll, setPresenceRoll] = useState<PresenceRollRow[]>([]);
  const [presenceWindows, setPresenceWindows] = useState<PresenceWindowRow[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [editingEvent, setEditingEvent] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventBody, setEventBody] = useState('');
  const [eventGame, setEventGame] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('19:00');
  const [eventDuration, setEventDuration] = useState('90');
  const [eventKind, setEventKind] = useState('other');
  const [confirmEventDelete, setConfirmEventDelete] = useState(false);
  const [galleryPending, setGalleryPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => { window.localStorage.setItem('coldstream-admin-section', tab); }, [tab]);
  useEffect(() => { window.localStorage.setItem('coldstream-admin-catalogue-filter', catalogueFilter); }, [catalogueFilter]);
  useEffect(() => { window.localStorage.setItem('coldstream-admin-member-search', memberSearch); }, [memberSearch]);

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
      setItems(PREVIEW_ITEMS); setMembers(PREVIEW_MEMBERS); setCompanies(PREVIEW_COMPANIES); setAssignments([]); setAudit([]); setEvents(PREVIEW_EVENTS); setRsvps([]); setPresenceRoll([]); setPresenceWindows([]); setGalleryPending(0);
      return;
    }
    const [itemResult, memberResult, companyResult, assignmentResult, auditResult, galleryResult, eventResult] = await Promise.all([
      supa.from('personnel_item').select('id,kind,name,description,storage_key,image_mime,active,sort_order,created_at').order('kind').order('sort_order').order('name'),
      supa.from('member').select('id,display_name,avatar_url,discord_id,role,company_id').order('display_name'),
      supa.from('company').select('id,name,tag,color,emblem_storage_key,emblem_image_mime,sort_order').order('sort_order').order('name'),
      supa.from('personnel_assignment').select('id,member_id,item_id,item_kind,assigned_by,assigned_at,note,removed_at').is('removed_at', null).order('assigned_at', { ascending: false }),
      supa.from('personnel_audit').select('id,actor_id,action,member_id,item_id,created_at').order('created_at', { ascending: false }).limit(100),
      supa.from('gallery_item').select('id').eq('approved', false),
      supa.from('event').select('id,title,body,game,starts_at,duration_minutes,cancelled,event_type,deleted_at').eq('historic', false).is('deleted_at', null).order('starts_at', { ascending: false }).limit(50),
    ]);
    const firstError = itemResult.error || memberResult.error || companyResult.error || assignmentResult.error || auditResult.error || eventResult.error;
    if (firstError) { setError(/personnel_/i.test(firstError.message) ? 'The Command Board database migration has not been applied yet.' : firstError.message); return; }
    setItems((itemResult.data ?? []) as PersonnelItem[]); setMembers((memberResult.data ?? []) as MemberRow[]);
    setCompanies((companyResult.data ?? []) as CompanyRow[]);
    setDetachmentDrafts(Object.fromEntries(((memberResult.data ?? []) as MemberRow[]).map((member) => [member.id, member.company_id ?? ''])));
    setAssignments((assignmentResult.data ?? []) as AssignmentRow[]); setAudit((auditResult.data ?? []) as AuditRow[]);
    setGalleryPending(galleryResult.data?.length ?? 0);

    const loadedEvents = (eventResult.data ?? []) as EventRow[];
    setEvents(loadedEvents);
    const eventIds = loadedEvents.map((event) => event.id);
    if (eventIds.length === 0) {
      setRsvps([]); setPresenceRoll([]); setPresenceWindows([]);
      return;
    }
    const [rsvpResult, rollResult, windowResult] = await Promise.all([
      supa.from('event_rsvp').select('event_id,member_id,status,attendance').in('event_id', eventIds),
      supa.from('event_presence_roll').select('event_id,discord_id,samples,first_seen,last_seen').in('event_id', eventIds),
      supa.from('event_presence_window').select('event_id,samples_taken,people_seen,first_sample,last_sample').in('event_id', eventIds),
    ]);
    const attendanceError = rsvpResult.error || rollResult.error || windowResult.error;
    if (attendanceError) { setError('Attendance records could not be opened.'); return; }
    setRsvps((rsvpResult.data ?? []) as RsvpRow[]);
    setPresenceRoll((rollResult.data ?? []) as PresenceRollRow[]);
    setPresenceWindows((windowResult.data ?? []) as PresenceWindowRow[]);
  }, []);

  useEffect(() => { if (canStaff) load(); }, [canStaff, load]);
  useEffect(() => {
    if (!selectedItem && items[0]) setSelectedItem(items[0].id);
    if (!assignItem && items[0]) setAssignItem(items[0].id);
    if (!assignMembers.length && members[0]) setAssignMembers([members[0].id]);
    if (!selectedEvent && events[0]) setSelectedEvent(events[0].id);
  }, [items, members, events, selectedItem, assignItem, assignMembers.length, selectedEvent]);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const currentItem = items.find((item) => item.id === selectedItem) ?? null;
  useEffect(() => { setConfirmDelete(null); setReplacementFile(null); }, [selectedItem]);
  useEffect(() => { setEditingEvent(false); setConfirmEventDelete(false); }, [selectedEvent]);
  const visibleItems = items.filter((item) => catalogueFilter === 'all' || item.kind === catalogueFilter);
  const visibleMembers = members.filter((member) => member.display_name.toLowerCase().includes(memberSearch.toLowerCase()));
  const artworkUrl = (item: PersonnelItem) => !item.storage_key || !supa ? null : supa.storage.from('personnel-artwork').getPublicUrl(item.storage_key).data.publicUrl;
  const companyArtworkUrl = (company: CompanyRow) => !company.emblem_storage_key || !supa ? null : supa.storage.from('personnel-artwork').getPublicUrl(company.emblem_storage_key).data.publicUrl;
  const currentEvent = events.find((event) => event.id === selectedEvent) ?? null;
  const currentRsvps = rsvps.filter((row) => row.event_id === selectedEvent);
  const currentPresence = presenceRoll.filter((row) => row.event_id === selectedEvent);
  const currentWindow = presenceWindows.find((row) => row.event_id === selectedEvent) ?? null;
  const trackedMinutes = currentWindow
    ? Math.max(0, Math.round((new Date(currentWindow.last_sample).getTime() - new Date(currentWindow.first_sample).getTime()) / 60_000))
    : 0;
  const presenceByDiscord = new Map(currentPresence.map((row) => [row.discord_id, row]));
  const rsvpByMember = new Map(currentRsvps.map((row) => [row.member_id, row]));
  const attendanceMembers = members
    .filter((member) => rsvpByMember.has(member.id) || Boolean(member.discord_id && presenceByDiscord.has(member.discord_id)))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  const unlinkedPresence = currentPresence.filter((row) => !members.some((member) => member.discord_id === row.discord_id));
  const globalResults = globalSearch.trim().length < 2 ? [] : [
    ...members.filter((member) => member.display_name.toLowerCase().includes(globalSearch.trim().toLowerCase())).slice(0, 4).map((member) => ({ id: member.id, kind: 'Member', label: member.display_name, tab: 'members' as Tab })),
    ...items.filter((item) => item.name.toLowerCase().includes(globalSearch.trim().toLowerCase())).slice(0, 4).map((item) => ({ id: item.id, kind: item.kind === 'rank' ? 'Rank' : 'Medal', label: item.name, tab: 'catalogue' as Tab })),
    ...events.filter((event) => event.title.toLowerCase().includes(globalSearch.trim().toLowerCase())).slice(0, 4).map((event) => ({ id: event.id, kind: 'Event', label: event.title, tab: 'attendance' as Tab })),
  ].slice(0, 8);
  const attendanceReviewCount = events.filter((event) => !event.cancelled && new Date(event.starts_at).getTime() < Date.now() && rsvps.some((row) => row.event_id === event.id && !row.attendance)).length;
  const upcomingEventCount = events.filter((event) => !event.cancelled && new Date(event.starts_at).getTime() >= Date.now()).length;

  function openTab(next: Tab) {
    setTab(next);
    setNavOpen(false);
    setError(null);
    setDone(null);
  }

  function openEventEditor() {
    if (!currentEvent) return;
    const localStart = new Date(currentEvent.starts_at);
    localStart.setMinutes(localStart.getMinutes() - localStart.getTimezoneOffset());
    setEventTitle(currentEvent.title);
    setEventBody(currentEvent.body ?? '');
    setEventGame(currentEvent.game ?? '');
    const localValue = localStart.toISOString().slice(0, 16);
    setEventDate(localValue.slice(0, 10));
    setEventTime(localValue.slice(11, 16));
    setEventDuration(String(currentEvent.duration_minutes));
    setEventKind(currentEvent.event_type);
    setConfirmEventDelete(false);
    setCreatingEvent(false);
    setEditingEvent(true);
  }

  function openEventCreator() {
    setEventTitle('');
    setEventBody('');
    setEventGame('Holdfast: Nations At War');
    setEventDate('');
    setEventTime('19:00');
    setEventDuration('90');
    setEventKind('linebattle');
    setConfirmEventDelete(false);
    setEditingEvent(false);
    setCreatingEvent(true);
  }

  function eventFormError() {
    if (!eventTitle.trim()) return 'Give the event a title.';
    if (!eventDate) return 'Choose the event date.';
    if (!eventTime) return 'Choose the start time.';
    if (Number.isNaN(new Date(`${eventDate}T${eventTime}`).getTime())) return 'Choose a valid event date and start time.';
    const duration = Number(eventDuration);
    if (!Number.isInteger(duration) || duration < 15 || duration > 1440) return 'Duration must be between 15 and 1440 minutes.';
    return null;
  }

  function chooseEventDay(day: 'today' | 'tomorrow' | 'friday' | 'saturday') {
    const chosen = new Date();
    chosen.setHours(12, 0, 0, 0);
    if (day === 'tomorrow') chosen.setDate(chosen.getDate() + 1);
    if (day === 'friday' || day === 'saturday') {
      const target = day === 'friday' ? 5 : 6;
      const daysAhead = (target - chosen.getDay() + 7) % 7;
      chosen.setDate(chosen.getDate() + daysAhead);
    }
    setEventDate(dateInputValue(chosen));
  }

  const eventStartValue = eventDate && eventTime ? `${eventDate}T${eventTime}` : '';
  const eventStartPreview = eventStartValue && !Number.isNaN(new Date(eventStartValue).getTime())
    ? new Date(eventStartValue).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : null;

  async function createEvent() {
    setError(null); setDone(null);
    const validationError = eventFormError();
    if (validationError) { setError(validationError); return; }
    const duration = Number(eventDuration);
    if (!supa) {
      const id = `preview-${Date.now()}`;
      setEvents((current) => [{ id, title: eventTitle.trim(), body: eventBody.trim() || null, game: eventGame.trim() || null, starts_at: new Date(eventStartValue).toISOString(), duration_minutes: duration, cancelled: false, event_type: eventKind, deleted_at: null }, ...current]);
      setSelectedEvent(id);
      setCreatingEvent(false);
      setDone('Preview only. The event was not posted to Discord.');
      return;
    }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    const result = await supa.rpc('create_managed_event', {
      event_title: eventTitle.trim(),
      event_body: eventBody.trim() || null,
      event_game: eventGame.trim() || null,
      event_starts_at: new Date(eventStartValue).toISOString(),
      event_duration_minutes: duration,
      event_kind: eventKind,
    });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setCreatingEvent(false);
    setSelectedEvent(result.data as string);
    setDone('Event created. Its #staffchat Discord post is queued.');
    await load();
  }

  async function saveEvent() {
    setError(null); setDone(null);
    if (!currentEvent) return;
    const validationError = eventFormError();
    if (validationError) { setError(validationError); return; }
    const duration = Number(eventDuration);
    if (!supa) { setDone('Preview only. The event was not changed.'); setEditingEvent(false); return; }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    const result = await supa.rpc('manage_event', {
      target_event: currentEvent.id,
      operation: 'edit',
      event_title: eventTitle.trim(),
      event_body: eventBody.trim() || null,
      event_game: eventGame.trim() || null,
      event_starts_at: new Date(eventStartValue).toISOString(),
      event_duration_minutes: duration,
      event_kind: eventKind,
    });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setEditingEvent(false);
    setDone('Event saved. The Discord post is queued to update.');
    await load();
  }

  async function removeEvent() {
    setError(null); setDone(null);
    if (!currentEvent || !confirmEventDelete) return;
    if (!supa) { setEvents((current) => current.filter((event) => event.id !== currentEvent.id)); setDone('Preview only. The event was removed from this preview.'); return; }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    const result = await supa.rpc('manage_event', {
      target_event: currentEvent.id,
      operation: 'delete',
      event_title: null,
      event_body: null,
      event_game: null,
      event_starts_at: null,
      event_duration_minutes: null,
      event_kind: null,
    });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setEvents((current) => current.filter((event) => event.id !== currentEvent.id));
    setSelectedEvent('');
    setConfirmEventDelete(false);
    setDone('Event removed. The Discord posts are queued for removal.');
  }

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

  async function replaceItemArtwork(item: PersonnelItem) {
    setError(null); setDone(null);
    if (!canUpload) { setError('Only admins can replace rank and medal artwork.'); return; }
    if (!replacementFile) { setError('Choose the replacement image first.'); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(replacementFile.type)) { setError('Use a PNG, JPEG or WebP image.'); return; }
    if (replacementFile.size > 5 * 1024 * 1024) { setError('The image must be 5 MB or smaller.'); return; }
    if (!supa || !me) { setDone('Replacement preview complete. Nothing was changed.'); return; }
    if (!await confirmDiscordRole()) return;

    const db = supa;
    const extension = replacementFile.type === 'image/png' ? 'png' : replacementFile.type === 'image/jpeg' ? 'jpg' : 'webp';
    const storageKey = `${me.id}/${crypto.randomUUID()}.${extension}`;
    setBusy(true);
    const upload = await db.storage.from('personnel-artwork').upload(storageKey, replacementFile, { contentType: replacementFile.type, upsert: false });
    if (upload.error) { setBusy(false); setError(upload.error.message); return; }
    const update = await db.from('personnel_item').update({ storage_key: storageKey, image_mime: replacementFile.type, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (update.error) {
      await db.storage.from('personnel-artwork').remove([storageKey]);
      setBusy(false); setError(update.error.message); return;
    }
    if (item.storage_key) await db.storage.from('personnel-artwork').remove([item.storage_key]);
    setBusy(false); setReplacementFile(null); setDone(`${item.name} artwork replaced.`); await load();
  }

  async function reorderItem(sourceId: string, targetId: string) {
    setDraggingItem(null); setDragOverItem(null); setError(null); setDone(null);
    if (!canUpload || sourceId === targetId) return;
    const source = items.find((item) => item.id === sourceId);
    const target = items.find((item) => item.id === targetId);
    if (!source || !target || source.kind !== target.kind) { setError('Ranks can only be moved among ranks, and medals among medals.'); return; }
    const ordered = items.filter((item) => item.kind === source.kind);
    const sourceIndex = ordered.findIndex((item) => item.id === sourceId);
    const targetIndex = ordered.findIndex((item) => item.id === targetId);
    const [moved] = ordered.splice(sourceIndex, 1);
    ordered.splice(targetIndex, 0, moved);
    if (!supa) { setItems((current) => current.map((item) => item.kind === source.kind ? { ...item, sort_order: ordered.findIndex((row) => row.id === item.id) * 10 } : item)); setDone('Order preview complete. Nothing was saved.'); return; }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    const result = await supa.rpc('reorder_personnel_items', { ordered_items: ordered.map((item) => item.id) });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setDone(`${source.kind === 'rank' ? 'Rank' : 'Medal'} order saved.`); await load();
  }

  function nudgeItem(itemId: string, direction: -1 | 1) {
    const item = items.find((row) => row.id === itemId);
    if (!item) return;
    const ordered = items.filter((row) => row.kind === item.kind);
    const itemIndex = ordered.findIndex((row) => row.id === itemId);
    const target = ordered[itemIndex + direction];
    if (target) reorderItem(itemId, target.id);
  }

  async function removeItem(item: PersonnelItem) {
    setError(null); setDone(null);
    if (!canUpload) { setError('Only admins can delete catalogue items.'); return; }
    // A held item cannot be deleted without silently rewriting somebody's
    // service record, and the database would refuse it anyway: assignments
    // reference the item. Archiving keeps the record and hides the item.
    const holders = assignments.filter((row) => row.item_id === item.id).length;
    if (holders > 0) {
      setConfirmDelete(null);
      setError(`This ${item.kind} is held by ${holders} member${holders === 1 ? '' : 's'}. Remove those assignments first, or archive it instead to keep the record.`);
      return;
    }
    if (confirmDelete !== item.id) { setConfirmDelete(item.id); return; }
    if (!supa) { setConfirmDelete(null); setDone('Preview only. Nothing was deleted.'); return; }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    // The row first. If it will not go, the image is still attached to
    // something rather than orphaned in the bucket.
    const removed = await supa.from('personnel_item').delete().eq('id', item.id);
    if (removed.error) { setBusy(false); setConfirmDelete(null); setError(removed.error.message); return; }
    if (item.storage_key) await supa.storage.from('personnel-artwork').remove([item.storage_key]);
    setBusy(false); setConfirmDelete(null); setSelectedItem(null);
    setDone(`${item.name} was deleted.`); await load();
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

  async function saveMemberDetachment(memberId: string) {
    setError(null); setDone(null);
    const companyId = detachmentDrafts[memberId] ?? '';
    if (!supa) { setDone('Detachment preview complete. Nothing was saved.'); return; }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    const result = await supa.rpc('set_member_file', {
      target_member: memberId,
      new_status: null,
      new_company: companyId || null,
      new_notes: null,
      clear_company: !companyId,
    });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setDone(companyId ? 'Detachment assigned.' : 'Detachment cleared.');
    await load();
  }

  async function setAttendance(memberId: string, outcome: RsvpRow['attendance']) {
    setError(null); setDone(null);
    if (!selectedEvent) { setError('Choose an event first.'); return; }
    if (!supa) { setDone('Attendance preview complete. Nothing was saved.'); return; }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    const result = await supa.rpc('mark_attendance', { target_event: selectedEvent, target_member: memberId, outcome });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setDone(outcome === 'attended' ? 'Marked attended.' : outcome === 'no_show' ? 'Marked no-show.' : 'Attendance mark cleared.');
    await load();
  }

  function openCompanyEditor(id: string) {
    const company = companies.find((row) => row.id === id);
    setCompanyEdit(id);
    setCompanyName(company?.name ?? '');
    setCompanyTag(company?.tag ?? '');
    setCompanyFile(null);
  }

  async function saveCompany() {
    setError(null); setDone(null);
    if (!canUpload) { setError('Only admins can change detachments or their emblems.'); return; }
    if (!companyName.trim()) { setError('Give the detachment a name.'); return; }
    if (companyFile && !['image/png', 'image/jpeg', 'image/webp'].includes(companyFile.type)) { setError('Use a PNG, JPEG or WebP emblem.'); return; }
    if (companyFile && companyFile.size > 5 * 1024 * 1024) { setError('The emblem must be 5 MB or smaller.'); return; }
    if (!supa) { setDone('Detachment preview complete. Nothing was saved.'); return; }
    if (!await confirmDiscordRole()) return;

    const db = supa;
    const existing = companies.find((row) => row.id === companyEdit);
    let newStorageKey: string | null = null;
    setBusy(true);
    if (companyFile) {
      const extension = companyFile.type === 'image/png' ? 'png' : companyFile.type === 'image/jpeg' ? 'jpg' : 'webp';
      newStorageKey = `detachments/${crypto.randomUUID()}.${extension}`;
      const upload = await db.storage.from('personnel-artwork').upload(newStorageKey, companyFile, { contentType: companyFile.type, upsert: false });
      if (upload.error) { setBusy(false); setError(upload.error.message); return; }
    }

    const payload: Record<string, string | null> = {
      name: companyName.trim(),
      tag: companyTag.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (newStorageKey && companyFile) {
      payload.emblem_storage_key = newStorageKey;
      payload.emblem_image_mime = companyFile.type;
    }
    const result = existing
      ? await db.from('company').update(payload).eq('id', existing.id).select('id').single()
      : await db.from('company').insert(payload).select('id').single();
    if (result.error) {
      if (newStorageKey) await db.storage.from('personnel-artwork').remove([newStorageKey]);
      setBusy(false); setError(result.error.message); return;
    }
    if (newStorageKey && existing?.emblem_storage_key) await db.storage.from('personnel-artwork').remove([existing.emblem_storage_key]);
    setBusy(false); setCompanyEdit(result.data.id); setCompanyFile(null);
    setDone(existing ? 'Detachment saved.' : 'Detachment added.');
    await load();
  }

  if (!canStaff) return <div className="wrap solo"><main><div className="module"><div className="mhead"><h3>Admin Panel</h3></div><div className="note">This part of the site is for moderators and admins. Sign in through Discord so the site can check your current role.</div></div></main></div>;

  const eventScheduleFields = <fieldset className="event-schedule">
    <legend>Schedule</legend>
    <div className="event-day-shortcuts" aria-label="Quick event dates">
      <button type="button" onClick={() => chooseEventDay('today')}>Today</button>
      <button type="button" onClick={() => chooseEventDay('tomorrow')}>Tomorrow</button>
      <button type="button" onClick={() => chooseEventDay('friday')}>Friday</button>
      <button type="button" onClick={() => chooseEventDay('saturday')}>Saturday</button>
    </div>
    <div className="event-date-time-fields">
      <label>Event date<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label>
      <label>Start time<input type="time" value={eventTime} step="900" onChange={(event) => setEventTime(event.target.value)} /></label>
    </div>
    <p className={eventStartPreview ? 'event-time-preview ready' : 'event-time-preview'}>{eventStartPreview ? `Starts ${eventStartPreview}` : 'Choose a date. Times use this device’s local timezone.'}</p>
  </fieldset>;

  return (
    <main className={`command-board ${navOpen ? 'nav-open' : ''}`}>
      <button className="admin-menu-button" onClick={() => setNavOpen((open) => !open)} aria-expanded={navOpen}><FaBars /> Menu</button>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand"><FaShieldAlt /><div><span>2nd Coldstream</span><b>Admin Panel</b></div></div>
          <nav aria-label="Admin Panel sections">
            <button className={tab === 'overview' ? 'active' : ''} onClick={() => openTab('overview')}><FaHome /><span>Overview</span><small>{attendanceReviewCount}</small></button>
            <button className={tab === 'members' || tab === 'assignments' ? 'active' : ''} onClick={() => openTab('members')}><FaUsers /><span>Members</span></button>
            <button className={tab === 'evidence' ? 'active' : ''} onClick={() => openTab('evidence')}><FaClipboardCheck /><span>Stat Tracking</span><small>0</small></button>
            <button className={tab === 'attendance' ? 'active' : ''} onClick={() => openTab('attendance')}><FaCalendarCheck /><span>Events</span>{attendanceReviewCount > 0 && <small>{attendanceReviewCount}</small>}</button>
            <p>Regiment</p>
            <button className={tab === 'catalogue' || tab === 'detachments' ? 'active' : ''} onClick={() => openTab('catalogue')}><FaAward /><span>Ranks, Medals & Detachments</span></button>
            <p>More</p>
            <button className={tab === 'audit' ? 'active' : ''} onClick={() => openTab('audit')}><FaHistory /><span>Audit Log</span></button>
            <button className={tab === 'settings' ? 'active' : ''} onClick={() => openTab('settings')}><FaCog /><span>Settings</span></button>
          </nav>
          <div className="admin-sidebar-account"><DiscordAvatar url={me!.avatar_url} name={me!.display_name} className="member-avatar" /><div><b>{me!.display_name}</b><span>{me!.role}</span></div><button onClick={signOut} aria-label="Sign out"><FaSignOutAlt /></button></div>
        </aside>
        <div className="admin-main">
      <header className="command-head">
        <div><p className="command-kicker"><FaShieldAlt /> Coldstream personnel</p><h1>Admin Panel</h1><p>Review what needs attention, manage members, and keep regiment records in one place.</p></div>
        <div className="command-session"><span>{me!.role}</span><b>{me!.display_name}</b><small>Role checked through Discord</small></div>
      </header>
      <div className="admin-global-search"><label><FaSearch /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search members, ranks, medals and events" /></label>{globalSearch.trim().length >= 2 && <div className="admin-search-results">{globalResults.length === 0 ? <span>No matching records</span> : globalResults.map((result) => <button key={`${result.kind}-${result.id}`} onClick={() => { if (result.tab === 'members') setMemberSearch(result.label); if (result.tab === 'catalogue') setSelectedItem(result.id); if (result.tab === 'attendance') setSelectedEvent(result.id); setGlobalSearch(''); openTab(result.tab); }}><small>{result.kind}</small><b>{result.label}</b></button>)}</div>}</div>
      {DEMO && <div className="command-banner"><b>Preview mode.</b> Sign in, uploads and assignments are simulated.</div>}
      {galleryPending !== null && galleryPending > 0 && <div className="command-banner"><b>{galleryPending}</b> gallery {galleryPending === 1 ? 'submission is' : 'submissions are'} waiting. <a href="#/gallery">Open the gallery.</a></div>}
      {error && <div className="command-message error" role="alert">{error}</div>}
      {done && <div className="command-message ok" role="status">{done}</div>}

      {tab === 'overview' && <section className="admin-overview">
        <div className="admin-welcome"><div><span>Daily command view</span><h2>What needs attention</h2><p>The three queues staff use most are kept first. Open a queue to continue the work.</p></div><FaShieldAlt /></div>
        <div className="admin-attention-grid">
          <article><header><FaClipboardCheck /><span>Stat submissions</span><b>0</b></header><h3>No connected reports yet</h3><p>The Discord report intake is the next build phase. It will appear here oldest first.</p><button onClick={() => openTab('evidence')}>Open Stat Tracking</button></article>
          <article><header><FaUsers /><span>New volunteers</span><b>0</b></header><h3>Enlistment is not connected</h3><p>Accepted recruits will appear here as Volunteer, assigned to Line Infantry until acknowledged.</p><button onClick={() => openTab('members')}>Open Members</button></article>
          <article><header><FaCalendarCheck /><span>Attendance review</span><b>{attendanceReviewCount}</b></header><h3>{attendanceReviewCount ? `${attendanceReviewCount} event${attendanceReviewCount === 1 ? '' : 's'} may need review` : 'Nothing waiting'}</h3><p>Events with unresolved attendance appear here after they end.</p><button onClick={() => openTab('attendance')}>Open Events</button></article>
        </div>
        <div className="admin-summary-grid"><article><span>Members</span><b>{members.length}</b><small>Discord roster records</small></article><article><span>Ranks & medals</span><b>{items.length}</b><small>{items.filter((item) => item.active).length} available</small></article><article><span>Detachments</span><b>{companies.length}</b><small>Regiment structure</small></article><article><span>Upcoming events</span><b>{upcomingEventCount}</b><small>Current calendar</small></article></div>
      </section>}

      {(tab === 'catalogue' || tab === 'detachments') && <nav className="admin-subnav" aria-label="Regiment tools"><button className={tab === 'catalogue' ? 'active' : ''} onClick={() => openTab('catalogue')}>Ranks & medals</button><button className={tab === 'detachments' ? 'active' : ''} onClick={() => openTab('detachments')}>Detachments</button></nav>}

      {tab === 'catalogue' && <section className="command-workspace">
        <div className="catalogue-list">
          <div className="command-section-head"><div><span>Artwork library</span><h2>Ranks and medals</h2></div><b>{items.length}</b></div>
          <div className="catalogue-filters"><button className={catalogueFilter === 'all' ? 'active' : ''} onClick={() => setCatalogueFilter('all')}>All</button><button className={catalogueFilter === 'rank' ? 'active' : ''} onClick={() => setCatalogueFilter('rank')}>Ranks</button><button className={catalogueFilter === 'medal' ? 'active' : ''} onClick={() => setCatalogueFilter('medal')}>Medals</button></div>
          {canUpload && <p className="catalogue-order-note"><FaArrowsAltV /><span><b>Reorder the display.</b> Grab any Drag handle, or use the arrow buttons on smaller screens.</span></p>}
          <div className="catalogue-scroll">{visibleItems.length === 0 && <div className="command-empty">No artwork has been uploaded in this section yet.</div>}{visibleItems.map((item) => {
            const url = artworkUrl(item);
            const kindItems = items.filter((row) => row.kind === item.kind);
            const kindIndex = kindItems.findIndex((row) => row.id === item.id);
            return <div
              className={`catalogue-row ${selectedItem === item.id ? 'active' : ''} ${draggingItem === item.id ? 'dragging' : ''} ${dragOverItem === item.id && draggingItem !== item.id ? 'drop-target' : ''}`}
              key={item.id}
              draggable={canUpload}
              onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); setDraggingItem(item.id); }}
              onDragEnd={() => { setDraggingItem(null); setDragOverItem(null); }}
              onDragEnter={() => { if (canUpload && draggingItem && draggingItem !== item.id) setDragOverItem(item.id); }}
              onDragOver={(event) => { if (canUpload) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
              onDrop={(event) => { event.preventDefault(); if (draggingItem) reorderItem(draggingItem, item.id); }}
              title={canUpload ? `Drag ${item.name} to reorder` : undefined}
            >{canUpload && <span className="catalogue-grip" aria-hidden="true"><FaArrowsAltV /><b>Drag</b></span>}<button className="catalogue-row-main" type="button" aria-pressed={selectedItem === item.id} onClick={() => setSelectedItem(item.id)}><span className={`catalogue-thumb ${item.kind}`}>{url ? <img src={url} alt="" /> : item.kind === 'rank' ? <FaShieldAlt /> : <FaMedal />}</span><span className="catalogue-row-copy"><small>{item.kind}</small><b>{item.name}</b><em>{item.active ? 'Available' : 'Archived'}</em></span></button>{canUpload && <span className="catalogue-nudge"><button type="button" disabled={busy || kindIndex === 0} aria-label={`Move ${item.name} up`} onClick={() => nudgeItem(item.id, -1)}>↑</button><button type="button" disabled={busy || kindIndex === kindItems.length - 1} aria-label={`Move ${item.name} down`} onClick={() => nudgeItem(item.id, 1)}>↓</button></span>}</div>;
          })}</div>
        </div>
        <div className="catalogue-detail">{currentItem ? <>
          <div className="catalogue-art">{artworkUrl(currentItem) ? <img src={artworkUrl(currentItem)!} alt={`${currentItem.name} artwork`} /> : currentItem.kind === 'rank' ? <FaShieldAlt /> : <FaMedal />}</div>
          <p className="command-kicker">{currentItem.kind}</p><h2>{currentItem.name}</h2><p>{currentItem.description || 'No description has been added.'}</p>
          <dl className="catalogue-facts"><div><dt>Current holders</dt><dd>{assignments.filter((row) => row.item_id === currentItem.id).length}</dd></div><div><dt>Status</dt><dd>{currentItem.active ? 'Available' : 'Archived'}</dd></div><div><dt>Added</dt><dd>{date(currentItem.created_at)}</dd></div></dl>
          {canUpload && <div className="catalogue-replace"><label>Replace artwork<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setReplacementFile(event.target.files?.[0] ?? null)} /></label><button className="command-secondary" disabled={busy || !replacementFile} onClick={() => replaceItemArtwork(currentItem)}>{busy ? 'Replacing' : 'Replace image'}</button><small>The current image stays in place unless the replacement saves successfully.</small></div>}
          {canUpload && <div className="catalogue-actions"><button className="command-secondary" onClick={() => toggleItem(currentItem)}>{currentItem.active ? 'Archive item' : 'Restore item'}</button>{confirmDelete === currentItem.id ? <><button className="command-danger" disabled={busy} onClick={() => removeItem(currentItem)}>{busy ? 'Deleting' : 'Confirm delete'}</button><button className="command-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button></> : <button className="command-danger ghost" onClick={() => removeItem(currentItem)}>Delete item</button>}</div>}
          {confirmDelete === currentItem.id && <p className="catalogue-warning">This removes the {currentItem.kind} and its artwork for good. Archive it instead if you only want it out of the way.</p>}
        </> : <div className="command-empty">Select an item to inspect it.</div>}</div>
        <aside className="catalogue-upload"><div className="command-section-head"><div><span>Admin only</span><h2>Upload artwork</h2></div><FaImage /></div>{canUpload ? <div className="command-form"><label>Type<select value={itemKind} onChange={(event) => setItemKind(event.target.value as ItemKind)}><option value="rank">Rank</option><option value="medal">Medal</option></select></label><label>Name<input value={itemName} maxLength={80} onChange={(event) => setItemName(event.target.value)} placeholder="Item name" /></label><label>Description<textarea value={itemDescription} maxLength={500} onChange={(event) => setItemDescription(event.target.value)} placeholder="What this rank or medal represents" /></label><label className="command-file"><span>PNG, JPEG or WebP, up to 5 MB</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setItemFile(event.target.files?.[0] ?? null)} /></label><button className="command-primary" onClick={uploadItem} disabled={busy}>{busy ? 'Uploading' : 'Add to catalogue'}</button></div> : <div className="command-locked"><FaShieldAlt /><b>Admin access required</b><p>Moderators can assign existing artwork but cannot upload or replace image files.</p></div>}</aside>
      </section>}

      {tab === 'assignments' && <section className="command-panel-grid">
        <div className="command-card assign-card"><div className="command-section-head"><div><span>Service record</span><h2>Assign an item</h2></div><button className="command-secondary" onClick={() => openTab('members')}>Back to members</button></div><div className="command-form horizontal"><label>Members <small>Use Ctrl or Shift to select several.</small><select className="member-multi" multiple value={assignMembers} onChange={(event) => setAssignMembers(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>{members.map((member) => <option value={member.id} key={member.id}>{member.display_name}</option>)}</select></label><label>Rank or medal<select value={assignItem} onChange={(event) => setAssignItem(event.target.value)}>{items.filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.kind === 'rank' ? 'Rank' : 'Medal'}: {item.name}</option>)}</select></label><label>Note<input value={assignNote} maxLength={300} onChange={(event) => setAssignNote(event.target.value)} placeholder="Optional reason or event" /></label><button className="command-primary" onClick={assign} disabled={busy || !items.length || !members.length}>{busy ? 'Saving' : assignMembers.length > 1 ? `Assign to ${assignMembers.length} members` : 'Assign item'}</button></div></div>
        <div className="command-card"><div className="command-section-head"><div><span>Current</span><h2>Active assignments</h2></div><b>{assignments.length}</b></div><div className="assignment-list">{assignments.length === 0 && <div className="command-empty">No ranks or medals have been assigned yet.</div>}{assignments.map((row) => <article key={row.id}><span className={`assignment-mark ${row.item_kind}`}>{row.item_kind === 'rank' ? <FaShieldAlt /> : <FaMedal />}</span><div><b>{itemById.get(row.item_id)?.name ?? 'Unknown item'}</b><span>{memberById.get(row.member_id)?.display_name ?? 'Unknown member'} · {date(row.assigned_at)}</span>{row.note && <small>{row.note}</small>}</div><button onClick={() => removeAssignment(row.id)}>Remove</button></article>)}</div></div>
      </section>}

      {(tab === 'members' || tab === 'detachments') && <section className={`command-panel-grid members-grid ${tab === 'detachments' ? 'detachment-only' : ''}`}>
        {tab === 'members' && <div className="command-card">
          <div className="command-section-head"><div><span>Discord roster</span><h2>Members</h2></div><b>{members.length}</b></div>
          <label className="command-search"><FaSearch /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search members" /></label>
          <div className="member-command-list">{visibleMembers.map((member) => {
            const records = assignments.filter((row) => row.member_id === member.id);
            const rank = records.find((row) => row.item_kind === 'rank');
            const currentCompany = member.company_id ? companyById.get(member.company_id) : null;
            return <article key={member.id}>
              <DiscordAvatar url={member.avatar_url} name={member.display_name} className="member-avatar" />
              <div className="member-summary"><b>{member.display_name}</b><span>{member.role} · {member.discord_id ? 'Discord linked' : 'Discord not linked'}</span><small>{currentCompany?.name ?? 'No detachment'}</small></div>
              <div className="member-record"><span>{rank ? itemById.get(rank.item_id)?.name : 'No rank'}</span><span>{records.filter((row) => row.item_kind === 'medal').length} medals</span>{rank && <button className="command-link-danger" type="button" onClick={() => removeAssignment(rank.id)} disabled={busy}>Remove rank</button>}</div>
              <div className="member-detachment-control">
                <select aria-label={`Detachment for ${member.display_name}`} value={detachmentDrafts[member.id] ?? ''} onChange={(event) => setDetachmentDrafts((current) => ({ ...current, [member.id]: event.target.value }))}>
                  <option value="">No detachment</option>
                  {companies.map((company) => <option value={company.id} key={company.id}>{company.name}{company.tag ? ` (${company.tag})` : ''}</option>)}
                </select>
                <button disabled={busy || (detachmentDrafts[member.id] ?? '') === (member.company_id ?? '')} onClick={() => saveMemberDetachment(member.id)}>Save detachment</button>
                <button onClick={() => { setAssignMembers([member.id]); setTab('assignments'); }}>Rank or medal</button>
              </div>
            </article>;
          })}</div>
        </div>}

        {tab === 'detachments' && <aside className="command-card detachment-card">
          <div className="command-section-head"><div><span>Unit structure</span><h2>Detachments</h2></div><FaFlag /></div>
          <div className="detachment-list">{companies.map((company) => {
            const emblem = companyArtworkUrl(company);
            return <button className={companyEdit === company.id ? 'active' : ''} key={company.id} onClick={() => openCompanyEditor(company.id)}>
              <span>{emblem ? <img src={emblem} alt="" /> : <FaShieldAlt />}</span>
              <div><b>{company.name}</b><small>{company.tag || 'No tag'} · {members.filter((member) => member.company_id === company.id).length} members</small></div>
            </button>;
          })}</div>
          {canUpload ? <div className="command-form detachment-form">
            <label>Detachment<select value={companyEdit} onChange={(event) => openCompanyEditor(event.target.value)}><option value="">Add a detachment</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label>
            <label>Name<input value={companyName} maxLength={80} onChange={(event) => setCompanyName(event.target.value)} placeholder="Detachment name" /></label>
            <label>Tag<input value={companyTag} maxLength={12} onChange={(event) => setCompanyTag(event.target.value)} placeholder="Optional short tag" /></label>
            <label className="command-file"><span>{companyEdit ? 'Leave empty to keep the current emblem.' : 'Optional emblem.'} PNG, JPEG or WebP, up to 5 MB</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setCompanyFile(event.target.files?.[0] ?? null)} /></label>
            <button className="command-primary" disabled={busy} onClick={saveCompany}>{busy ? 'Saving' : companyEdit ? 'Save detachment' : 'Add detachment'}</button>
          </div> : <div className="command-locked"><FaShieldAlt /><b>Admin access required</b><p>Moderators can assign an existing detachment. Admins manage the structure and emblems.</p></div>}
        </aside>}
      </section>}

      {tab === 'attendance' && <section className="command-panel-grid attendance-grid">
        <aside className="command-card attendance-events">
          <div className="command-section-head"><div><span>Event record</span><h2>Attendance</h2></div><div className="event-list-actions"><b>{events.length}</b><button className="command-primary" onClick={openEventCreator}>Add event</button></div></div>
          <div className="attendance-event-list">{events.length === 0 && <div className="command-empty">No events are on the calendar yet.</div>}{events.map((event) => <button className={selectedEvent === event.id && !creatingEvent ? 'active' : ''} key={event.id} onClick={() => { setCreatingEvent(false); setSelectedEvent(event.id); }}><time>{date(event.starts_at)}</time><div><b>{event.title}</b><small>{event.event_type} · {event.duration_minutes} minutes{event.cancelled ? ' · Cancelled' : ''}</small></div></button>)}</div>
        </aside>

        <div className="command-card attendance-review">
          <div className="command-section-head"><div><span>Event management</span><h2>{creatingEvent ? 'Add an event' : currentEvent?.title ?? 'Choose an event'}</h2></div>{currentEvent && !creatingEvent ? <div className="event-manage-actions"><button className="command-secondary" onClick={openEventEditor}>{editingEvent ? 'Reset form' : 'Edit event'}</button><button className="command-danger ghost" onClick={() => { setEditingEvent(false); setConfirmEventDelete(true); }}>Remove event</button></div> : <FaCalendarCheck />}</div>
          {creatingEvent && <div className="event-edit-form">
            <div className="command-section-head"><div><span>Posts in #staffchat</span><h3>Create event</h3></div></div>
            <div className="command-form event-form-grid">
              <label>Title<input value={eventTitle} maxLength={100} onChange={(event) => setEventTitle(event.target.value)} placeholder="Friday Linebattle" /></label>
              <label>Game<input value={eventGame} maxLength={80} onChange={(event) => setEventGame(event.target.value)} /></label>
              {eventScheduleFields}
              <label>Duration in minutes<input type="number" min="15" max="1440" value={eventDuration} onChange={(event) => setEventDuration(event.target.value)} /></label>
              <label>Event type<select value={eventKind} onChange={(event) => setEventKind(event.target.value)}><option value="linebattle">Linebattle</option><option value="training">Training</option><option value="social">Social</option><option value="campaign">Campaign</option><option value="other">Other</option></select></label>
              <label className="event-details-field">Details<textarea value={eventBody} maxLength={500} onChange={(event) => setEventBody(event.target.value)} placeholder="Maps, rules, or other notes" /></label>
              <div className="event-form-actions"><button className="command-primary" disabled={busy} onClick={createEvent}>{busy ? 'Creating' : 'Create event'}</button><button className="command-secondary" disabled={busy} onClick={() => setCreatingEvent(false)}>Cancel</button></div>
            </div>
          </div>}
          {editingEvent && currentEvent && <div className="event-edit-form">
            <div className="command-section-head"><div><span>Discord synchronized</span><h3>Edit event</h3></div></div>
            <div className="command-form event-form-grid">
              <label>Title<input value={eventTitle} maxLength={100} onChange={(event) => setEventTitle(event.target.value)} /></label>
              <label>Game<input value={eventGame} maxLength={80} onChange={(event) => setEventGame(event.target.value)} placeholder="Holdfast: Nations At War" /></label>
              {eventScheduleFields}
              <label>Duration in minutes<input type="number" min="15" max="1440" value={eventDuration} onChange={(event) => setEventDuration(event.target.value)} /></label>
              <label>Event type<select value={eventKind} onChange={(event) => setEventKind(event.target.value)}><option value="linebattle">Linebattle</option><option value="training">Training</option><option value="social">Social</option><option value="campaign">Campaign</option><option value="other">Other</option></select></label>
              <label className="event-details-field">Details<textarea value={eventBody} maxLength={500} onChange={(event) => setEventBody(event.target.value)} placeholder="Maps, rules, or other notes" /></label>
              <div className="event-form-actions"><button className="command-primary" disabled={busy} onClick={saveEvent}>{busy ? 'Saving' : 'Save changes'}</button><button className="command-secondary" disabled={busy} onClick={() => setEditingEvent(false)}>Cancel</button></div>
            </div>
          </div>}
          {confirmEventDelete && currentEvent && <div className="event-delete-confirm" role="alertdialog" aria-labelledby="event-delete-title"><FaCalendarCheck /><div><h3 id="event-delete-title">Remove {currentEvent.title}?</h3><p>This removes the event from the website and tells the Discord bot to delete its public and staff posts. Attendance records remain in the audit trail.</p></div><div><button className="command-danger" disabled={busy} onClick={removeEvent}>{busy ? 'Removing' : 'Confirm removal'}</button><button className="command-secondary" disabled={busy} onClick={() => setConfirmEventDelete(false)}>Keep event</button></div></div>}
          {currentEvent && <div className="attendance-summary">
            <div><small>Starts</small><b>{dateTime(currentEvent.starts_at)}</b></div>
            <div><small>Tracked time</small><b>{currentWindow ? trackedMinutes > 0 ? `${trackedMinutes} minutes` : 'Just started' : 'Not started'}</b></div>
            <div><small>People seen</small><b>{currentWindow?.people_seen ?? 0}</b></div>
            <div><small>Confirmed</small><b>{currentRsvps.filter((row) => row.attendance === 'attended').length}</b></div>
          </div>}
          {currentEvent && attendanceMembers.length === 0 && unlinkedPresence.length === 0 && <div className="command-empty">No RSVPs or voice activity was recorded for this event.</div>}
          <div className="attendance-roll">{attendanceMembers.map((member) => {
            const rsvp = rsvpByMember.get(member.id);
            const presence = member.discord_id ? presenceByDiscord.get(member.discord_id) : null;
            const coverage = presence && currentWindow?.samples_taken ? Math.min(100, Math.round((presence.samples / currentWindow.samples_taken) * 100)) : 0;
            const rsvpLabel = rsvp?.status === 'going' ? 'Attending' : rsvp?.status === 'maybe' ? 'Maybe' : rsvp?.status === 'out' ? 'Not attending' : 'No reply';
            const voiceSummary = !presence
              ? 'Not detected in voice during this event'
              : trackedMinutes < 1
                ? 'Detected in voice when tracking started'
                : coverage >= 95
                  ? `In voice for the full ${trackedMinutes}-minute tracking window`
                  : `In voice for about ${Math.max(1, Math.round(trackedMinutes * coverage / 100))} of ${trackedMinutes} tracked minutes`;
            return <article key={member.id}>
              <DiscordAvatar url={member.avatar_url} name={member.display_name} className="member-avatar" />
              <div><b>{member.display_name}</b><span>RSVP: {rsvpLabel}</span><small>{voiceSummary}</small></div>
              <div className="attendance-actions" aria-label={`Attendance for ${member.display_name}`}>
                <button className={rsvp?.attendance === 'attended' ? 'active attended' : ''} disabled={busy} onClick={() => setAttendance(member.id, 'attended')}>Attended</button>
                <button className={rsvp?.attendance === 'no_show' ? 'active no-show' : ''} disabled={busy} onClick={() => setAttendance(member.id, 'no_show')}>No-show</button>
                <button disabled={busy || !rsvp?.attendance} onClick={() => setAttendance(member.id, null)}>Clear</button>
              </div>
            </article>;
          })}</div>
          {unlinkedPresence.length > 0 && <div className="attendance-unlinked"><span>Not linked to a website member</span>{unlinkedPresence.map((row) => <div key={row.discord_id}><b>Discord {row.discord_id}</b><small>{row.samples} voice samples</small></div>)}</div>}
        </div>
      </section>}

      {tab === 'evidence' && <section className="command-card evidence-shell"><div className="command-section-head"><div><span>Discord report review</span><h2>Stat Tracking</h2></div><span className="future-pill">Intake not connected</span></div><div className="evidence-intro"><FaClipboardCheck /><div><h3>The review workspace is ready for the next phase</h3><p>Reports will arrive here oldest first after a member submits up to 30 rounds and the required screenshots through Discord.</p><small>Competitive · Public Linebattle · Public Server</small></div></div><div className="evidence-types"><article><FaAward /><span>Four recorded stats</span><h3>Kills & deaths</h3><p>Each round records kills and deaths as separate values.</p></article><article><FaShieldAlt /><span>Leaderboard results</span><h3>MVP & Top 5</h3><p>MVP means the player finished #1 on the leaderboard. Top 5 is recorded separately.</p></article><article><FaImage /><span>Required proof</span><h3>One image per round</h3><p>Staff approve or reject the entire report. Approved proof images are then deleted.</p></article></div><div className="evidence-flow"><span>Discord submission</span><i /><span>Oldest-first review</span><i /><span>Approve or reject</span><i /><span>Stats updated</span></div></section>}

      {tab === 'audit' && <section className="command-card"><div className="command-section-head"><div><span>Accountability</span><h2>Audit log</h2></div><b>{audit.length}</b></div><div className="audit-list">{audit.length === 0 && <div className="command-empty">Changes will appear here after the first catalogue upload or assignment.</div>}{audit.map((row) => <article key={row.id}><FaHistory /><div><b>{labelAction(row.action)}</b><span>{row.member_id ? memberById.get(row.member_id)?.display_name ?? 'Member' : 'Catalogue'}{row.item_id ? ` · ${itemById.get(row.item_id)?.name ?? 'Item'}` : ''}</span></div><time>{date(row.created_at)}</time></article>)}</div></section>}

      {tab === 'settings' && <section className="command-card settings-shell"><div className="command-section-head"><div><span>System controls</span><h2>Settings</h2></div><FaCog /></div>{canUpload ? <div className="command-empty">Discord role mappings, scheduled sync and event defaults will live here as each integration is connected.</div> : <div className="command-locked"><FaShieldAlt /><b>Admin access required</b><p>You can see that Settings exists, but only admins can change system-wide controls.</p></div>}</section>}

        </div>
      </div>
    </main>
  );
}
