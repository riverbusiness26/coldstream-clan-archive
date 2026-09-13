import { recurringEventStarts, type EventRepeat } from '../lib/eventRecurrence';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaArrowsAltV, FaAward, FaBars, FaCalendarCheck, FaChevronLeft, FaChevronRight, FaClipboardCheck, FaCog, FaFlag, FaHistory, FaHome, FaImage, FaMedal, FaSearch, FaShieldAlt, FaSignOutAlt, FaUsers } from 'react-icons/fa';
import { supa, DEMO } from '../lib/supa';
import type { Me } from '../lib/auth';
import { loadAdminSections, mergeDetachmentDrafts, parseRoundCount, readAdminRows } from '../lib/adminData';
import DiscordAvatar from '../components/DiscordAvatar';
import ArtworkPicker from '../components/ArtworkPicker';
import WeeklyReview from '../components/WeeklyReview';
import { reviewWeeklyContent } from '../lib/adminWeekly';
import DetachmentEmblem from '../components/DetachmentEmblem';
import { CALENDAR_TIME_ZONE, addCalendarDays, chicagoDateKey, chicagoDateTimeCandidates, chicagoDateTimeInput, chicagoDateTimeToIso, type ChicagoTimeOccurrence } from '../lib/calendarTime';
import '../admin-redesign.css';
type Tab = 'overview' | 'catalogue' | 'detachments' | 'assignments' | 'members' | 'attendance' | 'evidence' | 'gallery' | 'weekly' | 'audit' | 'settings';
type ItemKind = 'rank' | 'medal';
interface PersonnelItem { id: string; kind: ItemKind; name: string; description: string | null; storage_key: string | null; image_mime: string | null; active: boolean; sort_order: number; created_at: string }
interface MemberRow { id: string; display_name: string; avatar_url: string | null; discord_id: string | null; role: string; company_id: string | null; status: string; notes: string | null; joined_year: number | null; enlisted_at: string | null; discharged_at: string | null; steam_id64: string | null }
interface CompanyRow { id: string; name: string; tag: string | null; color: string | null; emblem_storage_key: string | null; emblem_image_mime: string | null; sort_order: number }
interface AssignmentRow { id: string; member_id: string; item_id: string; item_kind: ItemKind; assigned_by: string; assigned_at: string; note: string | null; removed_at: string | null }
interface AuditRow { id: number; actor_id: string | null; action: string; member_id: string | null; item_id: string | null; detail: Record<string, unknown> | null; created_at: string }
interface EventRow { series_id?: string | null; series_position?: number | null; id: string; title: string; body: string | null; game: string | null; starts_at: string; duration_minutes: number; cancelled: boolean; event_type: string; deleted_at: string | null }
interface RsvpRow { event_id: string; member_id: string; status: string | null; attendance: 'attended' | 'no_show' | null }
interface PresenceRollRow { event_id: string; discord_id: string; samples: number; first_seen: string; last_seen: string }
interface PresenceWindowRow { event_id: string; samples_taken: number; people_seen: number; first_sample: string; last_sample: string }
interface StatProofRow { id: string; storage_key: string; content_type: string; deleted_at: string | null }
interface StatRoundRow { round_number: number; kills: number; deaths: number; is_mvp: boolean; is_top5: boolean; stat_proof?: StatProofRow[] }
interface StatSubmissionRow { id: string; submitter_id: string; category: string; event_name: string | null; status: string; created_at: string; stat_round?: StatRoundRow[] }
interface WeeklySubmissionRow { id: string; submitter_id: string; url: string; provider: string; title: string; description: string | null; status: string; rejection_reason: string | null; submitted_at: string; approved_at: string | null; }
interface GallerySubmissionRow { id: string; storage_key: string | null; media_type: 'image' | 'video'; video_id: string | null; external_url: string | null; caption: string | null; created_at: string; approved: boolean; uploader?: { display_name: string } | { display_name: string }[] | null; }
  const statCategoryLabel = (category: string) => ({ public_linebattle: 'Linebattle Stats', public_server: 'Public Servers', competitive: 'Competitive' } as Record<string, string>)[category] || category.replaceAll('_', ' ');
  const PREVIEW_ITEMS: PersonnelItem[] = [
  { id: 'preview-rank', kind: 'rank', name: 'Rank artwork', description: 'Upload the approved insignia and place it in the rank ladder.', storage_key: '', image_mime: 'image/webp', active: true, sort_order: 0, created_at: new Date().toISOString() },
  { id: 'preview-medal', kind: 'medal', name: 'Medal artwork', description: 'Medals stay in the catalogue and can be assigned to more than one member.', storage_key: '', image_mime: 'image/webp', active: true, sort_order: 1, created_at: new Date().toISOString() },
];
const PREVIEW_MEMBERS: MemberRow[] = [{ id: 'preview-member', display_name: 'Discord Member', avatar_url: null, discord_id: 'preview', role: 'member', company_id: null, status: 'active', notes: null, joined_year: null, enlisted_at: null, discharged_at: null, steam_id64: null }];
const PREVIEW_COMPANIES: CompanyRow[] = [{ id: 'preview-company', name: '2nd Coldstream Guards', tag: '2ndCS', color: null, emblem_storage_key: null, emblem_image_mime: null, sort_order: 0 }];
const PREVIEW_EVENTS: EventRow[] = [{ id: 'preview-event', title: 'Example Linebattle', body: 'Form up 15 minutes before the event.', game: 'Holdfast: Nations At War', starts_at: new Date(Date.now() + 86_400_000).toISOString(), duration_minutes: 90, cancelled: false, event_type: 'linebattle', deleted_at: null }];
const PREVIEW_STAT_SUBMISSIONS: StatSubmissionRow[] = [{ id: 'preview-report', submitter_id: 'preview-member', category: 'public_linebattle', event_name: 'Example report: Linebattle', status: 'submitted', created_at: new Date().toISOString(), stat_round: [{ round_number: 1, kills: 0, deaths: 0, is_mvp: false, is_top5: false, stat_proof: [] }] }];
const SECTION_INFO: Record<Tab, { title: string; description: string }> = {
  overview: { title: 'Staff overview', description: 'Review the queues, manage member records and prepare for the next event.' },
  evidence: { title: 'Stat review', description: 'Open a report, inspect every round and its proof, then make one clear decision.' },
  gallery: { title: 'Gallery review', description: 'View member uploads before accepting them into the gallery.' },
  weekly: { title: 'Weekly content', description: 'Review features and manage the approved weekly rotation.' },
  members: { title: 'Member records', description: 'Ranks, medals, detachments and member details, all in one place.' },
  assignments: { title: 'Member records', description: 'Ranks, medals, detachments and member details, all in one place.' },
  catalogue: { title: 'Artwork library', description: 'Create and maintain reusable ranks and medals. Award them from Members.' },
  detachments: { title: 'Detachment library', description: 'Maintain detachment names and emblems. Manage membership from Members.' },
  attendance: { title: 'Events and attendance', description: 'Manage the calendar, review replies and inspect Discord voice-presence evidence.' },
  audit: { title: 'Audit log', description: 'The latest 75 recorded changes, with 25 entries per page.' },
  settings: { title: 'Settings', description: 'Staff permissions, access information and system configuration.' },
};
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const dateTime = (value: string) => new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const eventDateLabel = (value: string) => new Date(value).toLocaleDateString('en-US', { timeZone: CALENDAR_TIME_ZONE, year: 'numeric', month: 'short', day: 'numeric' });
const eventDateTimeLabel = (value: string) => new Date(value).toLocaleString('en-US', { timeZone: CALENDAR_TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const dateInputValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const labelAction = (value: string) => value.replaceAll('_', ' ').replaceAll('.', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const auditDetail = (detail: Record<string, unknown> | null) => {
  if (!detail) return '';
  const changed = Object.entries(detail)
    .filter(([key, value]) => key.endsWith('_changed') && value === true)
    .map(([key]) => key.replace(/_changed$/, '').replaceAll('_', ' '));
  if (changed.length) return `Changed ${changed.join(', ')}`;
  if (typeof detail.status === 'string') return `Status: ${detail.status}`;
  if (detail.removed === true) return 'Removed';
  if (detail.approved === true) return 'Approved';
  return '';
};
// The Discord bot samples voice presence every two minutes. Attendance time
// is deliberately derived from those samples only; there is no manual-hours
// field that could drift away from Discord evidence.
const VOICE_SAMPLE_MINUTES = 2;
const presenceHours = (samples: number) => Math.round((samples * VOICE_SAMPLE_MINUTES / 60) * 10) / 10;
function ProofThumbnail({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <span className="staff-proof-unavailable">Preview unavailable. Open the original to check the file.</span>
    : <img src={url} alt={title} loading="lazy" onError={() => setFailed(true)} />;
}
export default function Admin({ me, signOut }: { me: Me | null; signOut: () => void }) {
  const canStaff = me?.role === 'moderator' || me?.role === 'admin';
  const canUpload = me?.role === 'admin';
  const [tab, setTab] = useState<Tab>(() => {
    const saved = window.localStorage.getItem('coldstream-admin-section') as Tab | null;
    return saved === 'assignments' ? 'members' : saved && ['overview', 'catalogue', 'detachments', 'members', 'attendance', 'evidence', 'gallery', 'weekly', 'audit', 'settings'].includes(saved) ? saved : 'overview';
  });
  const [navOpen, setNavOpen] = useState(false);
  const [items, setItems] = useState<PersonnelItem[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [itemDetails, setItemDetails] = useState({ name: '', description: '' });
  const [draggingItem, setDraggingItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  // Delete is two clicks, not a browser confirm dialog: it is irreversible and
  // the artwork does not come back.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [catalogueFilter, setCatalogueFilter] = useState<'all' | ItemKind>(() => (window.localStorage.getItem('coldstream-admin-catalogue-filter') as 'all' | ItemKind | null) ?? 'all');
  const [memberSearch, setMemberSearch] = useState(() => window.localStorage.getItem('coldstream-admin-member-search') ?? '');
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [memberTools, setMemberTools] = useState<string | null>(null);
  const [memberDraft, setMemberDraft] = useState({ display_name: '', joined_year: '', status: 'active', notes: '', enlisted_at: '', discharged_at: '' });
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
  const [eventOccurrence, setEventOccurrence] = useState<ChicagoTimeOccurrence | ''>('');
  const [eventDuration, setEventDuration] = useState('90');
  const [eventKind, setEventKind] = useState('other');
  const [eventRepeat, setEventRepeat] = useState<EventRepeat>('none');
  const [eventRepeatCount, setEventRepeatCount] = useState('12');
  const seriesRequest = useRef<{ signature: string; id: string } | null>(null);
  const [confirmEventDelete, setConfirmEventDelete] = useState(false);
  const [galleryPending, setGalleryPending] = useState<number | null>(null);
  const [gallerySubmissions, setGallerySubmissions] = useState<GallerySubmissionRow[]>([]);
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [gallerySort, setGallerySort] = useState<'newest' | 'oldest'>('newest');
  const [statSubmissions, setStatSubmissions] = useState<StatSubmissionRow[]>([]);
  const [statStatusFilter, setStatStatusFilter] = useState<'all' | 'submitted' | 'approved' | 'rejected'>('submitted');
  const [statCategoryFilter, setStatCategoryFilter] = useState('all');
  const [statSort, setStatSort] = useState<'oldest' | 'newest'>('oldest');
  const [editingStatId, setEditingStatId] = useState<string | null>(null);
  const [selectedStatId, setSelectedStatId] = useState<string | null>(null);
  const [statSearch, setStatSearch] = useState('');
  const [confirmStatDelete, setConfirmStatDelete] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<{ url: string; title: string } | null>(null);
  const [proofFailed, setProofFailed] = useState(false);
  const proofDialog = useRef<HTMLDialogElement>(null);
  const [statRoundDrafts, setStatRoundDrafts] = useState<Record<string, { kills: string; deaths: string; is_mvp: boolean; is_top5: boolean }>>({});
  const [weeklySubmissions, setWeeklySubmissions] = useState<WeeklySubmissionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const [auditWarning, setAuditWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => { window.localStorage.setItem('coldstream-admin-section', tab); }, [tab]);
  useEffect(() => { window.localStorage.setItem('coldstream-admin-catalogue-filter', catalogueFilter); }, [catalogueFilter]);
  useEffect(() => { window.localStorage.setItem('coldstream-admin-member-search', memberSearch); }, [memberSearch]);
  useEffect(() => {
    setProofFailed(false);
    if (proofPreview && proofDialog.current && !proofDialog.current.open) proofDialog.current.showModal();
    if (!proofPreview && proofDialog.current?.open) proofDialog.current.close();
  }, [proofPreview]);
  // The message banner sits at the top of the board and the upload form is a
  // long way below it, so a failed upload looked like nothing happening at
  // all. That is how the audit trigger bug went unnoticed: the error was on
  // screen the whole time, just not on the part of the screen being used.
  useEffect(() => {
    if (!error && !done) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector('.command-message')?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'instant' : 'smooth' });
  }, [error, done]);
  const [loading, setLoading] = useState(false);
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const loadVersion = useRef(0);
  const loadedMembers = useRef<MemberRow[]>([]);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    if (!supa) {
      setItems(PREVIEW_ITEMS); setMembers(PREVIEW_MEMBERS); setCompanies(PREVIEW_COMPANIES); setAssignments([]); setAssignmentHistory([]); setAudit([]); setEvents(PREVIEW_EVENTS); setRsvps([]); setPresenceRoll([]); setPresenceWindows([]); setGalleryPending(0); setGallerySubmissions([]); setStatSubmissions(PREVIEW_STAT_SUBMISSIONS); setWeeklySubmissions([]);
      setLoading(false);
      return;
    }
    const db = supa;
    const current = () => version === loadVersion.current;
    const errors = await loadAdminSections([
      { name: 'Artwork', run: async () => {
        const result = await readAdminRows((from, to) => db.from('personnel_item').select('id,kind,name,description,storage_key,image_mime,active,sort_order,created_at').order('kind').order('sort_order').order('name').order('id').range(from, to));
        if (!result.error && current()) setItems(result.data as PersonnelItem[]);
        return result;
      } },
      { name: 'Members', run: async () => {
        const result = await readAdminRows((from, to) => db.from('member').select('id,display_name,avatar_url,discord_id,role,company_id,status,notes,joined_year,enlisted_at,discharged_at,steam_id64').order('display_name').order('id').range(from, to));
        if (!result.error && current()) {
          const next = result.data as MemberRow[];
          const previous = loadedMembers.current;
          setDetachmentDrafts((drafts) => mergeDetachmentDrafts(drafts, previous, next));
          loadedMembers.current = next;
          setMembers(next);
        }
        return result;
      } },
      { name: 'Detachments', run: async () => {
        const result = await readAdminRows((from, to) => db.from('company').select('id,name,tag,color,emblem_storage_key,emblem_image_mime,sort_order').order('sort_order').order('name').order('id').range(from, to));
        if (!result.error && current()) setCompanies(result.data as CompanyRow[]);
        return result;
      } },
      { name: 'Ranks and medals', run: async () => {
        const result = await readAdminRows((from, to) => db.from('personnel_assignment').select('id,member_id,item_id,item_kind,assigned_by,assigned_at,note,removed_at').order('assigned_at', { ascending: false }).order('id').range(from, to));
        if (!result.error && current()) {
          const rows = result.data as AssignmentRow[];
          setAssignmentHistory(rows); setAssignments(rows.filter((row) => !row.removed_at));
        }
        return result;
      } },
      { name: 'Audit log', run: async () => {
        const result = await db.from('personnel_audit').select('id,actor_id,action,member_id,item_id,detail,created_at').order('created_at', { ascending: false }).order('id').limit(75);
        if (!result.error && current()) setAudit((result.data ?? []) as AuditRow[]);
        return result;
      } },
      { name: 'Gallery', run: async () => {
        const result = await readAdminRows((from, to) => db.from('gallery_item').select('id,storage_key,media_type,video_id,external_url,caption,created_at,approved,uploader:member!uploader_id(display_name)').order('created_at', { ascending: false }).order('id').range(from, to));
        if (!result.error && current()) {
          const rows = result.data as GallerySubmissionRow[];
          setGallerySubmissions(rows); setGalleryPending(rows.filter((row) => !row.approved).length);
        }
        return result;
      } },
      { name: 'Stat reports', run: async () => {
        const result = await readAdminRows((from, to) => db.from('stat_submission').select('id,submitter_id,category,event_name,status,created_at,stat_round(round_number,kills,deaths,is_mvp,is_top5,stat_proof(id,storage_key,content_type,deleted_at))').order('created_at', { ascending: false }).order('id').range(from, to));
        if (!result.error && current()) setStatSubmissions((result.data as StatSubmissionRow[]).map((row) => ({ ...row, stat_round: row.stat_round?.slice().sort((a, b) => a.round_number - b.round_number) })));
        return result;
      } },
      { name: 'Weekly content', run: async () => {
        const result = await readAdminRows((from, to) => db.from('weekly_content_submission').select('id,submitter_id,url,provider,title,description,status,rejection_reason,submitted_at,approved_at').order('submitted_at', { ascending: false }).order('id').range(from, to));
        if (!result.error && current()) setWeeklySubmissions(result.data as WeeklySubmissionRow[]);
        return result;
      } },
      { name: 'Events', run: async () => {
        const result = await readAdminRows((from, to) => db.from('event').select('id,title,body,game,starts_at,duration_minutes,cancelled,event_type,deleted_at,series_id,series_position').eq('historic', false).is('deleted_at', null).order('starts_at', { ascending: false }).order('id').range(from, to));
        if (!result.error && current()) setEvents(result.data as EventRow[]);
        return result;
      } },
      { name: 'RSVPs', run: async () => {
        const result = await readAdminRows((from, to) => db.from('event_rsvp').select('event_id,member_id,status,attendance').order('event_id').order('member_id').range(from, to));
        if (!result.error && current()) setRsvps(result.data as RsvpRow[]);
        return result;
      } },
    ]);
    if (current()) { setLoadErrors(errors); setLoading(false); }
  }, []);
  useEffect(() => {
    if (canStaff) void load();
    return () => { loadVersion.current += 1; };
  }, [canStaff, load]);

  useEffect(() => {
    if (!canStaff || !supa) return;
    const refresh = () => { if (!actionLock.current && document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, [canStaff, load]);
  // Attendance belongs to the selected event, not a capped list of 50 events.
  useEffect(() => {
    if (!canStaff || !supa || !selectedEvent) return;
    const db = supa;
    let cancelled = false;
    setPresenceRoll([]); setPresenceWindows([]);
    void loadAdminSections([
      { name: 'Voice samples', run: async () => {
        const result = await readAdminRows((from, to) => db.from('event_presence_roll').select('event_id,discord_id,samples,first_seen,last_seen').eq('event_id', selectedEvent).order('discord_id').range(from, to));
        if (!result.error && !cancelled) setPresenceRoll(result.data as PresenceRollRow[]);
        return result;
      } },
      { name: 'Presence window', run: async () => {
        const result = await db.from('event_presence_window').select('event_id,samples_taken,people_seen,first_sample,last_sample').eq('event_id', selectedEvent);
        if (!result.error && !cancelled) setPresenceWindows((result.data ?? []) as PresenceWindowRow[]);
        return result;
      } },
    ]).then((errors) => {
      if (!cancelled) setLoadErrors((previous) => {
        const next = { ...previous };
        for (const key of ['Voice samples', 'Presence window']) delete next[key];
        return { ...next, ...errors };
      });
    });
    return () => { cancelled = true; };
  }, [canStaff, selectedEvent, events]);
  useEffect(() => {
    if (!items.some((item) => item.id === selectedItem)) setSelectedItem(items[0]?.id ?? null);
    if (!items.some((item) => item.id === assignItem && item.active)) setAssignItem(items.find((item) => item.active)?.id ?? '');
    if (!events.some((event) => event.id === selectedEvent)) setSelectedEvent(events[0]?.id ?? '');
  }, [items, members, events, selectedItem, assignItem, assignMembers.length, selectedEvent]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const currentItem = items.find((item) => item.id === selectedItem) ?? null;
  useEffect(() => { setItemDetails({ name: currentItem?.name ?? '', description: currentItem?.description ?? '' }); }, [selectedItem, currentItem?.name, currentItem?.description]);
  useEffect(() => { setConfirmDelete(null); setReplacementFile(null); }, [selectedItem]);
  useEffect(() => { setEditingEvent(false); setConfirmEventDelete(false); }, [selectedEvent]);
  const visibleItems = items.filter((item) => catalogueFilter === 'all' || item.kind === catalogueFilter);
  const visibleMembers = members.filter((member) => member.display_name.toLowerCase().includes(memberSearch.toLowerCase()));
  const visibleGallerySubmissions = useMemo(() => gallerySubmissions
    .filter((submission) => galleryFilter === 'all' || (galleryFilter === 'pending' ? !submission.approved : submission.approved))
    .slice()
    .sort((a, b) => gallerySort === 'newest'
      ? Date.parse(b.created_at) - Date.parse(a.created_at)
      : Date.parse(a.created_at) - Date.parse(b.created_at)), [galleryFilter, gallerySort, gallerySubmissions]);
  const editingMemberRecord = editingMember ? members.find((member) => member.id === editingMember) ?? null : null;
  const auditPageSize = 25;
  const auditPageCount = Math.max(1, Math.ceil(audit.length / auditPageSize));
  const auditPageRows = audit.slice((auditPage - 1) * auditPageSize, auditPage * auditPageSize);
  useEffect(() => { if (auditPage > auditPageCount) setAuditPage(auditPageCount); }, [auditPage, auditPageCount]);
  const artworkUrl = (item: PersonnelItem) => !item.storage_key || !supa ? null : supa.storage.from('personnel-artwork').getPublicUrl(item.storage_key).data.publicUrl;
  const statProofUrl = (proof: StatProofRow) => !supa ? null : supa.storage.from('stat-proof').getPublicUrl(proof.storage_key).data.publicUrl;
  const galleryMediaUrl = (row: GallerySubmissionRow) => row.external_url || (row.video_id ? `https://www.youtube.com/watch?v=${row.video_id}` : row.storage_key && supa ? supa.storage.from('gallery').getPublicUrl(row.storage_key).data.publicUrl : null);
  const galleryPreviewUrl = (row: GallerySubmissionRow) => row.video_id
    ? `https://img.youtube.com/vi/${row.video_id}/hqdefault.jpg`
    : row.media_type === 'image' && row.storage_key && supa
      ? supa.storage.from('gallery').getPublicUrl(row.storage_key).data.publicUrl
      : null;
  const companyArtworkUrl = (company: CompanyRow) => !company.emblem_storage_key || !supa ? null : supa.storage.from('personnel-artwork').getPublicUrl(company.emblem_storage_key).data.publicUrl;
  const currentEvent = events.find((event) => event.id === selectedEvent) ?? null;
  const currentRsvps = rsvps.filter((row) => row.event_id === selectedEvent);
  const currentPresence = presenceRoll.filter((row) => row.event_id === selectedEvent);
  const currentWindow = presenceWindows.find((row) => row.event_id === selectedEvent) ?? null;
  const eventVoiceHours = currentPresence.reduce((sum, row) => sum + presenceHours(row.samples), 0);
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
  const visibleStatSubmissions = useMemo(() => statSubmissions
    .filter((submission) => statStatusFilter === 'all' || submission.status === statStatusFilter)
    .filter((submission) => statCategoryFilter === 'all' || submission.category === statCategoryFilter)
    .filter((submission) => !statSearch.trim() || `${submission.event_name ?? ''} ${memberById.get(submission.submitter_id)?.display_name ?? ''}`.toLowerCase().includes(statSearch.trim().toLowerCase()))
    .sort((a, b) => {
      const difference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return statSort === 'oldest' ? difference : -difference;
    }), [statSubmissions, statStatusFilter, statCategoryFilter, statSort, statSearch, memberById]);
  const selectedStat = visibleStatSubmissions.find((submission) => submission.id === selectedStatId) ?? visibleStatSubmissions[0] ?? null;
  const selectedStatMember = selectedStat ? memberById.get(selectedStat.submitter_id) : null;
  const pendingStats = statSubmissions.filter((submission) => submission.status === 'submitted').length;
  const pendingWeekly = weeklySubmissions.filter((submission) => submission.status === 'pending').length;
  const pendingGallery = gallerySubmissions.filter((submission) => !submission.approved).length;
  const reviewTotal = pendingStats + pendingWeekly + pendingGallery;
  const sectionInfo = SECTION_INFO[tab];
  useEffect(() => { setEditingStatId(null); setConfirmStatDelete(null); }, [selectedStat?.id]);
  function openTab(next: Tab) {
    setTab(next);
    setNavOpen(false);
    setError(null);
    setDone(null);
  }
  function openEventEditor() {
    if (!currentEvent) return;
    let chicagoValue: string;
    let occurrence: ChicagoTimeOccurrence | '' = '';
    try {
      chicagoValue = chicagoDateTimeInput(currentEvent.starts_at);
      const candidates = chicagoDateTimeCandidates(chicagoValue);
      if (candidates.length > 1) {
        const minuteTimestamp = Math.floor(Date.parse(currentEvent.starts_at) / 60_000) * 60_000;
        occurrence = Date.parse(candidates[0]) === minuteTimestamp ? 'earlier' : 'later';
      }
    } catch {
      setError('This event has an invalid start timestamp. Its date could not be opened for editing.');
      return;
    }
    setEventTitle(currentEvent.title);
    setEventBody(currentEvent.body ?? '');
    setEventGame(currentEvent.game ?? '');
    setEventDate(chicagoValue.slice(0, 10));
    setEventTime(chicagoValue.slice(11, 16));
    setEventOccurrence(occurrence);
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
    setEventOccurrence('');
    setEventDuration('90');
    setEventKind('linebattle');
    setConfirmEventDelete(false);
    setEditingEvent(false);
    setEventRepeat('none');
    setEventRepeatCount('12');
    seriesRequest.current = null;
    setCreatingEvent(true);
  }
  function eventFormError() {
    if (!eventTitle.trim()) return 'Give the event a title.';
    if (!eventDate) return 'Choose the event date.';
    if (!eventTime) return 'Choose the start time.';
    if (eventTiming.error) return eventTiming.error;
    const duration = Number(eventDuration);
    if (!Number.isInteger(duration) || duration < 15 || duration > 1440) return 'Duration must be between 15 and 1440 minutes.';
    return null;
  }
  function chooseEventDay(day: 'today' | 'tomorrow' | 'friday' | 'saturday') {
    const today = chicagoDateKey(new Date());
    let daysAhead = day === 'tomorrow' ? 1 : 0;
    if (day === 'friday' || day === 'saturday') {
      const target = day === 'friday' ? 5 : 6;
      daysAhead = (target - new Date(`${today}T12:00:00Z`).getUTCDay() + 7) % 7;
    }
    setEventDate(addCalendarDays(today, daysAhead));
    setEventOccurrence('');
  }
  const eventStartValue = eventDate && eventTime ? `${eventDate}T${eventTime}` : '';
  const eventTiming = useMemo(() => {
    let ambiguous = false;
    if (!eventStartValue) return { iso: null, error: null, ambiguous };
    try {
      ambiguous = chicagoDateTimeCandidates(eventStartValue).length > 1;
      return { iso: chicagoDateTimeToIso(eventStartValue, eventOccurrence || undefined), error: null, ambiguous };
    } catch (cause) {
      return { iso: null, error: cause instanceof Error ? cause.message : 'Choose a valid Chicago date and start time.', ambiguous };
    }
  }, [eventStartValue, eventOccurrence]);
  const recurrence = useMemo(() => {
    if (!eventTiming.iso) return { starts: [] as string[], error: null as string | null };
    try { return { starts: recurringEventStarts(eventTiming.iso, eventRepeat, Number(eventRepeatCount)), error: null }; }
    catch (cause) { return { starts: [] as string[], error: cause instanceof Error ? cause.message : 'Check the repeat settings.' }; }
  }, [eventTiming.iso, eventRepeat, eventRepeatCount]);
  const eventStartPreview = eventTiming.iso ? eventDateTimeLabel(eventTiming.iso) : null;
  async function createEvent() {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    setError(null); setDone(null);
    const validationError = eventFormError();
    const startsAt = eventTiming.iso;
    if (validationError || !startsAt) { setError(validationError || 'Choose a valid Chicago date and start time.'); return; }
    if (recurrence.error) { setError(recurrence.error); return; }
    const duration = Number(eventDuration);
    if (!supa) {
      const id = `preview-${Date.now()}`;
      setEvents((current) => [...recurrence.starts.map((start, index) => ({ id: index === 0 ? id : `${id}-${index}`, title: eventTitle.trim(), body: eventBody.trim() || null, game: eventGame.trim() || null, starts_at: start, duration_minutes: duration, cancelled: false, event_type: eventKind, deleted_at: null })), ...current]);
      setSelectedEvent(id);
      setCreatingEvent(false);
      setDone('Preview only. The event was not posted to Discord.');
      return;
    }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    const details = {
      event_title: eventTitle.trim(),
      event_body: eventBody.trim() || null,
      event_game: eventGame.trim() || null,
      event_starts_at: startsAt,
      event_duration_minutes: duration,
      event_kind: eventKind,
    };
    const signature = JSON.stringify([details, eventRepeat, eventRepeatCount]);
    if (seriesRequest.current?.signature !== signature) seriesRequest.current = { signature, id: crypto.randomUUID() };
    const result = eventRepeat === 'none'
      ? await supa.rpc('create_website_event', details)
      : await supa.rpc('create_recurring_website_events', { ...details, request_id: seriesRequest.current.id, repeat_kind: eventRepeat, occurrence_count: Number(eventRepeatCount) });
    if (result.error) { setError(result.error.message); return; }
    setCreatingEvent(false);
    setSelectedEvent(Array.isArray(result.data) ? result.data[0] : result.data as string);
    setDone(eventRepeat === 'none' ? 'Event saved. Choose Post to Discord when it is ready to share.' : `${recurrence.starts.length} recurring events saved. Each occurrence can be edited or posted to Discord separately.`);
    await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function postSchedule() {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    if (busy) return;
    setError(null); setDone(null);
    if (!supa) { setDone('Preview only. No schedule posted.'); return; }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    try {
      const result = await supa.rpc('request_event_schedule');
      if (result.error) throw result.error;
      setDone('Schedule queued for staff chat. Coldstream Guard will update its schedule with current upcoming events.');
    } catch { setError('Schedule could not be queued. Check the database update and bot connection.'); }
    finally {  }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function postEventToDiscord() {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    if (!currentEvent || busy) return;
    setError(null); setDone(null);
    if (!supa) { setDone('Preview only. Nothing was posted.'); return; }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    try {
      const result = await supa.rpc('post_managed_event', { target_event: currentEvent.id });
      if (result.error) throw result.error;
      setDone('Discord post queued for staff chat. Repeated clicks do not create another post.');
    } catch { setError('Could not queue the Discord post. Confirm the optional event-post database update is installed.'); }
    finally {  }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function saveEvent() {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    setError(null); setDone(null);
    if (!currentEvent) return;
    const validationError = eventFormError();
    const startsAt = eventTiming.iso;
    if (validationError || !startsAt) { setError(validationError || 'Choose a valid Chicago date and start time.'); return; }
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
      event_starts_at: startsAt,
      event_duration_minutes: duration,
      event_kind: eventKind,
    });
    if (result.error) { setError(result.error.message); return; }
    setEditingEvent(false);
    setDone('Event saved. If already posted, its Discord message is queued to update.');
    await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function removeEvent() {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
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
    if (result.error) { setError(result.error.message); return; }
    setEvents((current) => current.filter((event) => event.id !== currentEvent.id));
    setSelectedEvent('');
    setConfirmEventDelete(false);
    setDone('Event removed. The Discord posts are queued for removal.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
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
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
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
    if (upload.error) {  setError(upload.error.message); return; }
    const insert = await supa.from('personnel_item').insert({ kind: itemKind, name: itemName.trim(), description: itemDescription.trim() || null, storage_key: storageKey, image_mime: itemFile.type }).select('id').single();
    if (insert.error) { await supa.storage.from('personnel-artwork').remove([storageKey]);  setError(insert.error.message); return; }
     setItemName(''); setItemDescription(''); setItemFile(null); setSelectedItem(insert.data.id); setDone('Artwork added to the catalogue.'); await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function toggleItem(item: PersonnelItem) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    setError(null); setDone(null);
    if (!canUpload) { setError('Only admins can change catalogue items.'); return; }
    if (!supa) { setDone('Preview only. Nothing was changed.'); return; }
    if (!await confirmDiscordRole()) return;
    const result = await supa.from('personnel_item').update({ active: !item.active, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (result.error) { setError(result.error.message); return; }
    setDone(item.active ? 'Item archived.' : 'Item restored.'); await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }

  async function saveItemDetails() {
    if (actionLock.current || !canUpload || !currentItem) return;
    if (!itemDetails.name.trim()) { setError('Give the artwork a name.'); return; }
    if (!supa) { setDone('Preview only. Artwork details were not saved.'); return; }
    actionLock.current = true; setBusy(true); setError(null); setDone(null);
    try {
      if (!await confirmDiscordRole()) return;
      const result = await supa.from('personnel_item').update({ name: itemDetails.name.trim(), description: itemDetails.description.trim() || null, updated_at: new Date().toISOString() }).eq('id', currentItem.id).select('id').single();
      if (result.error) throw new Error(result.error.message);
      setDone('Artwork name and description saved.'); await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Artwork details could not be saved.'); }
    finally { actionLock.current = false; setBusy(false); }
  }
  async function replaceItemArtwork(item: PersonnelItem) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
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
    if (upload.error) {  setError(upload.error.message); return; }
    const update = await db.from('personnel_item').update({ storage_key: storageKey, image_mime: replacementFile.type, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (update.error) {
      await db.storage.from('personnel-artwork').remove([storageKey]);
       setError(update.error.message); return;
    }
    if (item.storage_key) await db.storage.from('personnel-artwork').remove([item.storage_key]);
     setReplacementFile(null); setDone(`${item.name} artwork replaced.`); await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function reorderItem(sourceId: string, targetId: string) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
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
    if (result.error) { setError(result.error.message); return; }
    setDone(`${source.kind === 'rank' ? 'Rank' : 'Medal'} order saved.`); await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
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
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    setError(null); setDone(null);
    if (!canUpload) { setError('Only admins can delete catalogue items.'); return; }
    // A held item cannot be deleted without silently rewriting somebody's
    // service record, and the database would refuse it anyway: assignments
    // reference the item. Archiving keeps the record and hides the item.
    const activeHolders = assignments.filter((row) => row.item_id === item.id).length;
    const references = assignmentHistory.filter((row) => row.item_id === item.id).length;
    if (references > 0) {
      setConfirmDelete(null);
      setError(activeHolders > 0
        ? `This ${item.kind} is currently held by ${activeHolders} member${activeHolders === 1 ? '' : 's'}. Update those member records first, or archive the artwork to keep the service history.`
        : `This ${item.kind} is part of a member's service history. Archive the artwork instead of deleting that history.`);
      return;
    }
    if (confirmDelete !== item.id) { setConfirmDelete(item.id); return; }
    if (!supa) { setConfirmDelete(null); setDone('Preview only. Nothing was deleted.'); return; }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    // The row first. If it will not go, the image is still attached to
    // something rather than orphaned in the bucket.
    const removed = await supa.from('personnel_item').delete().eq('id', item.id);
    if (removed.error) {  setConfirmDelete(null); setError(removed.error.message); return; }
    if (item.storage_key) await supa.storage.from('personnel-artwork').remove([item.storage_key]);
     setConfirmDelete(null); setSelectedItem(null);
    setDone(`${item.name} was deleted.`); await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function assign() {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    setError(null); setDone(null);
    if (!assignMembers.length || !assignItem) { setError('Choose at least one member and an item.'); return; }
    if (!supa) { setDone('Rank or medal preview complete. Nothing was saved.'); return; }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    const results = await Promise.all(assignMembers.map(async (memberId) => {
      try { return await supa!.rpc('assign_personnel_item', { target_member: memberId, target_item: assignItem, assignment_note: assignNote.trim() || null }); }
      catch { return { error: { message: 'A member update could not be confirmed.' } }; }
    }));
    const failed = results.find((result) => result.error);
    if (failed?.error) { await load(); setError(`Some member updates failed: ${failed.error.message}. Successful changes are shown below; check them before retrying.`); return; }
    setAssignNote(''); setDone(assignMembers.length === 1 ? 'Member rank or medal saved.' : `Member records updated for ${assignMembers.length} members.`); await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function removeAssignment(id: string) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    setError(null); setDone(null);
    if (!supa) { setDone('Removal preview complete. Nothing was saved.'); return; }
    if (!await confirmDiscordRole()) return;
    const result = await supa.rpc('remove_personnel_assignment', { target_assignment: id });
    if (result.error) { setError(result.error.message); return; }
    setDone(result.data ? 'Member rank or medal removed. The service history is retained.' : 'That rank or medal was already removed.'); await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function recordStaffAudit(action: string, entity: string, entityId: string, memberId: string | null, detail: Record<string, unknown>) {
    if (!supa) return;
    try {
    const result = await supa.rpc('record_audit', {
      audit_action: action,
      audit_entity: entity,
      audit_entity_id: entityId,
      audit_member: memberId,
      audit_detail: detail,
    });
    if (result.error) setAuditWarning('The change was saved, but its audit entry failed. Tell an admin before making more changes.');
    } catch { setAuditWarning('The change was saved, but its audit entry could not be confirmed.'); }
  }
  async function reviewStatSubmission(id: string, status: 'approved' | 'rejected') {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    if (!supa) { setDone('Preview only. No submission was changed.'); return; }
    setBusy(true); setError(null);
    const result = await supa.from('stat_submission').update({ status, reviewed_by: me?.id ?? null, reviewed_at: new Date().toISOString() }).eq('id', id).select('id').single();
    if (result.error) { setError(result.error.message); return; }
    const submission = statSubmissions.find((row) => row.id === id);
    await recordStaffAudit('stat.review', 'stat_submission', id, submission?.submitter_id ?? null, { status });
    setDone(`Submission ${status}.`); await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function removeStatSubmission(id: string) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    if (!supa) { setDone('Preview only. Nothing was removed.'); return; }
    setBusy(true); const result = await supa.from('stat_submission').delete().eq('id', id).select('id').single();
    if (result.error) { setError(result.error.message); return; }
    const submission = statSubmissions.find((row) => row.id === id);
    await recordStaffAudit('stat.delete', 'stat_submission', id, submission?.submitter_id ?? null, { removed: true });
    setDone('Stat submission removed.'); await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  function beginStatEdit(submission: StatSubmissionRow) {
    setEditingStatId(submission.id);
    setStatRoundDrafts(Object.fromEntries((submission.stat_round ?? []).map((round) => [`${submission.id}:${round.round_number}`, { kills: String(round.kills), deaths: String(round.deaths), is_mvp: round.is_mvp, is_top5: round.is_top5 }])));
  }
  async function saveStatRound(submissionId: string, round: StatRoundRow) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    if (!supa) { setDone('Preview only. No round was changed.'); return; }
    const draft = statRoundDrafts[`${submissionId}:${round.round_number}`];
    if (!draft) return;
    const kills = parseRoundCount(draft.kills); const deaths = parseRoundCount(draft.deaths);
    if (kills === null || deaths === null) { setError('Kills and deaths must be whole numbers of zero or more.'); return; }
    setBusy(true); setError(null);
    const result = await supa.from('stat_round').update({ kills, deaths, is_mvp: draft.is_mvp, is_top5: draft.is_top5 }).eq('submission_id', submissionId).eq('round_number', round.round_number).select('id').single();
    if (result.error) { setError(result.error.message); return; }
    await recordStaffAudit('stat.round_edit', 'stat_submission', submissionId, statSubmissions.find((row) => row.id === submissionId)?.submitter_id ?? null, { round_number: round.round_number, kills, deaths, is_mvp: draft.is_mvp, is_top5: draft.is_top5 });
    setDone(`Round ${round.round_number} updated.`); await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function publishWeekly() {
    if (actionLock.current || !supa) return;
    actionLock.current = true; setBusy(true); setError(null); setDone(null);
    try {
      const result = await supa.rpc('deploy_weekly_content');
      if (result.error) throw new Error(result.error.message);
      setDone('Approved weekly content has been published.');
      await load();
    } catch { setError('Publication failed. Approved content is retained; retry when the connection is restored.'); }
    finally { actionLock.current = false; setBusy(false); }
  }
  async function reviewWeeklySubmission(id: string, status: 'approved' | 'rejected' | 'archived') {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    if (!supa) { setDone('Preview only. No submission was changed.'); return; }
    setBusy(true);
    if (!me) { setError('Sign in again before reviewing content.'); return; }
    const result = await reviewWeeklyContent(supa, id, status, me.id);
    const submission = weeklySubmissions.find((row) => row.id === id);
    await recordStaffAudit('weekly.review', 'weekly_content_submission', id, submission?.submitter_id ?? null, { status, ...(status === 'rejected' ? { removed: true } : {}) });
    if (result.publicationError) {
      await load();
      setError('Approved, but publication failed. The item is saved under Approved; use Retry publication before expecting it on the homepage.');
      return;
    }
    setDone(status === 'rejected' ? 'Weekly submission rejected and removed from the queue.' : status === 'approved' ? 'Weekly submission approved and published to the rotation.' : 'Weekly submission archived.'); await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function reviewGallerySubmission(id: string, approve: boolean) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    if (!supa) { setDone('Preview only. No gallery submission was changed.'); return; }
    setBusy(true); setError(null);
    if (approve) {
      const result = await supa.from('gallery_item').update({ approved: true }).eq('id', id).select('id').single();
      if (result.error) { setError(result.error.message); return; }
      const row = gallerySubmissions.find((submission) => submission.id === id);
      const uploader = Array.isArray(row?.uploader) ? row?.uploader[0] : row?.uploader;
      await recordStaffAudit('gallery.approve', 'gallery_item', id, null, { approved: true, uploader: uploader?.display_name ?? null });
      setDone('Gallery submission approved and added to the wall.');
    } else {
      const row = gallerySubmissions.find((submission) => submission.id === id);
      const result = await supa.from('gallery_item').delete().eq('id', id).select('id').single();
      if (!result.error && row?.storage_key) await supa.storage.from('gallery').remove([row.storage_key]);
      if (result.error) { setError(result.error.message); return; }
      const uploader = Array.isArray(row?.uploader) ? row?.uploader[0] : row?.uploader;
      await recordStaffAudit('gallery.delete', 'gallery_item', id, null, { removed: true, uploader: uploader?.display_name ?? null });
      setDone('Gallery submission removed.');
    }
    await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function saveMemberDetachment(memberId: string) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
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
    if (result.error) { setError(result.error.message); return; }
    setDone(companyId ? 'Detachment assigned.' : 'Detachment cleared.');
    await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  function openMemberEditor(member: MemberRow) {
    setEditingMember(member.id);
    setMemberDraft({
      display_name: member.display_name,
      joined_year: member.joined_year ? String(member.joined_year) : '',
      status: member.status || 'active',
      notes: member.notes || '',
      enlisted_at: member.enlisted_at ? dateInputValue(new Date(member.enlisted_at)) : '',
      discharged_at: member.discharged_at ? dateInputValue(new Date(member.discharged_at)) : '',
    });
  }
  async function saveMemberEditor(memberId: string) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    setError(null); setDone(null);
    if (!supa) { setDone('Member editor preview complete. Nothing was saved.'); return; }
    if (!await confirmDiscordRole()) return;
    const year = memberDraft.joined_year.trim() ? Number(memberDraft.joined_year) : null;
    if (year === null && members.find((member) => member.id === memberId)?.joined_year) { setError('Joined year cannot be cleared by the current member service. Enter a year to save this record.'); return; }
    if (year !== null && (!Number.isInteger(year) || year < 2011 || year > new Date().getFullYear())) { setError('Enter a valid joined year.'); return; }
    if (memberDraft.enlisted_at && memberDraft.discharged_at && memberDraft.discharged_at < memberDraft.enlisted_at) { setError('Discharge date cannot be before enlistment date.'); return; }
    setBusy(true);
    const result = await supa.rpc('set_member_file', {
      target_member: memberId,
      new_status: memberDraft.status,
      new_company: null,
      new_notes: memberDraft.notes.trim() || null,
      clear_company: false,
      new_display_name: memberDraft.display_name.trim(),
      new_joined_year: year,
      new_enlisted_at: memberDraft.enlisted_at ? `${memberDraft.enlisted_at}T12:00:00.000Z` : null,
      new_discharged_at: memberDraft.discharged_at ? `${memberDraft.discharged_at}T12:00:00.000Z` : null,
      clear_notes: !memberDraft.notes.trim(),
      clear_enlisted_at: !memberDraft.enlisted_at,
      clear_discharged_at: !memberDraft.discharged_at,
    });
    if (result.error) { setError(result.error.message); return; }
    setEditingMember(null);
    setDone('Member record updated and added to the audit log.');
    await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function setAttendance(memberId: string, outcome: RsvpRow['attendance']) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
    setError(null); setDone(null);
    if (!selectedEvent) { setError('Choose an event first.'); return; }
    if (!supa) { setDone('Attendance preview complete. Nothing was saved.'); return; }
    if (!await confirmDiscordRole()) return;
    setBusy(true);
    const result = await supa.rpc('mark_attendance', { target_event: selectedEvent, target_member: memberId, outcome });
    if (result.error) { setError(result.error.message); return; }
    setDone(outcome === 'attended' ? 'Marked attended.' : outcome === 'no_show' ? 'Marked no-show.' : 'Attendance mark cleared.');
    await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  function openCompanyEditor(id: string) {
    const company = companies.find((row) => row.id === id);
    setCompanyEdit(id);
    setCompanyName(company?.name ?? '');
    setCompanyTag(company?.tag ?? '');
    setCompanyFile(null);
  }
  async function saveCompany() {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null); setDone(null);
    try {
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
      if (upload.error) {  setError(upload.error.message); return; }
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
       setError(result.error.message); return;
    }
    if (newStorageKey && existing?.emblem_storage_key) await db.storage.from('personnel-artwork').remove([existing.emblem_storage_key]);
     setCompanyEdit(result.data.id); setCompanyFile(null);
    setDone(existing ? 'Detachment saved.' : 'Detachment added.');
    await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request could not be completed. Refresh records before retrying.');
    } finally { actionLock.current = false; setBusy(false); }
  }
  if (!canStaff) return <div className="wrap solo"><main><div className="module"><div className="mhead"><h3>Admin Panel</h3></div><div className="note">This part of the site is for moderators and admins. Sign in through Discord so the site can check your current role.</div></div></main></div>;
  const eventScheduleFields = <fieldset className="event-schedule">
    <legend>Event date and time</legend>
    <div className="event-date-time-fields">
      <label>Event date<input type="date" value={eventDate} aria-describedby="event-time-guidance" onChange={(event) => { setEventDate(event.target.value); setEventOccurrence(''); }} /></label>
      <label>Start time (Chicago)<input type="time" value={eventTime} step="900" aria-describedby="event-time-guidance" aria-invalid={Boolean(eventTiming.error)} onChange={(event) => { setEventTime(event.target.value); setEventOccurrence(''); }} /></label>
    </div>
    {eventTiming.ambiguous && <label>Which occurrence?<select value={eventOccurrence} onChange={(event) => setEventOccurrence(event.target.value as ChicagoTimeOccurrence | '')}><option value="">Choose which time</option><option value="earlier">First occurrence (CDT, before clocks move back)</option><option value="later">Second occurrence (CST, after clocks move back)</option></select></label>}
    <p id="event-time-guidance" role="status" className={eventStartPreview ? 'event-time-preview ready' : 'event-time-preview'}>{eventTiming.error || (eventStartPreview ? `Starts ${eventStartPreview}` : 'Choose a date. All event times use Chicago (Central Time), including daylight saving.')}</p>
  </fieldset>;
  return (
    <main className={`command-board staff-workspace ${navOpen ? 'nav-open' : ''}`}>
      <button className="admin-menu-button" onClick={() => setNavOpen((open) => !open)} aria-expanded={navOpen}><FaBars /> Menu</button>
      {navOpen && <button className="staff-nav-backdrop" aria-label="Close staff navigation" onClick={() => setNavOpen(false)} />}
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <button className="admin-sidebar-toggle" type="button" onClick={() => setNavOpen(false)} aria-label="Hide admin sidebar"><FaChevronLeft /></button>
          <div className="admin-sidebar-brand"><FaShieldAlt /><div><span>Coldstream Gaming</span><b>Staff workspace</b></div></div>
          <nav aria-label="Admin Panel sections">
            <button className={tab === 'overview' ? 'active' : ''} aria-current={tab === 'overview' ? 'page' : undefined} onClick={() => openTab('overview')}><FaHome /><span>Overview</span>{reviewTotal > 0 && <small>{reviewTotal}</small>}</button>
            <p>Review inbox</p>
            <button className={tab === 'evidence' ? 'active' : ''} aria-current={tab === 'evidence' ? 'page' : undefined} onClick={() => openTab('evidence')}><FaClipboardCheck /><span>Stat reports</span><small>{pendingStats}</small></button>
            <button className={tab === 'gallery' ? 'active' : ''} aria-current={tab === 'gallery' ? 'page' : undefined} onClick={() => openTab('gallery')}><FaImage /><span>Gallery</span><small>{pendingGallery}</small></button>
            <button className={tab === 'weekly' ? 'active' : ''} aria-current={tab === 'weekly' ? 'page' : undefined} onClick={() => openTab('weekly')}><FaImage /><span>Weekly content</span><small>{pendingWeekly}</small></button>
            <p>People and records</p>
            <button className={tab === 'members' || tab === 'assignments' ? 'active' : ''} onClick={() => openTab('members')}><FaUsers /><span>Members</span></button>
            <button className={tab === 'attendance' ? 'active' : ''} onClick={() => openTab('attendance')}><FaCalendarCheck /><span>Events and attendance</span>{attendanceReviewCount > 0 && <small>{attendanceReviewCount}</small>}</button>
            <button className={tab === 'catalogue' || tab === 'detachments' ? 'active' : ''} onClick={() => openTab('catalogue')}><FaAward /><span>Artwork library</span></button>
            <p>Administration</p>
            <button className={tab === 'audit' ? 'active' : ''} onClick={() => openTab('audit')}><FaHistory /><span>Audit Log</span></button>
            <button className={tab === 'settings' ? 'active' : ''} onClick={() => openTab('settings')}><FaCog /><span>Settings</span></button>
          </nav>
          <div className="admin-sidebar-account"><DiscordAvatar url={me!.avatar_url} name={me!.display_name} className="member-avatar" /><div><b>{me!.display_name}</b><span>{me!.role}</span></div><button onClick={signOut} aria-label="Sign out"><FaSignOutAlt /></button></div>
        </aside>
      <div className="admin-main">
      <header className="command-head">
        <div><p className="command-kicker">Staff workspace / {sectionInfo.title}</p><h1>{sectionInfo.title}</h1><p>{sectionInfo.description}</p></div>
        <button className="command-secondary staff-refresh" type="button" disabled={busy || loading} onClick={() => { void load(); }}>{loading ? 'Loading records…' : 'Refresh records'}</button>
      </header>
      <div className="admin-global-search"><label><FaSearch /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search members, ranks, medals and events" /></label>{globalSearch.trim().length >= 2 && <div className="admin-search-results">{globalResults.length === 0 ? <span>No matching records</span> : globalResults.map((result) => <button key={`${result.kind}-${result.id}`} onClick={() => { if (result.tab === 'members') setMemberSearch(result.label); if (result.tab === 'catalogue') setSelectedItem(result.id); if (result.tab === 'attendance') setSelectedEvent(result.id); setGlobalSearch(''); openTab(result.tab); }}><small>{result.kind}</small><b>{result.label}</b></button>)}</div>}</div>
      {DEMO && <div className="command-banner"><b>Local preview.</b> Example records only. No live member, upload or review is changed.</div>}
      {galleryPending !== null && galleryPending > 0 && tab === 'overview' && <div className="command-banner"><b>{galleryPending}</b> gallery {galleryPending === 1 ? 'submission is' : 'submissions are'} waiting. <button className="staff-inline-link" onClick={() => openTab('gallery')}>Review gallery</button></div>}
      {loading && <div role="status" className="command-banner">Loading records. Counts may be incomplete until this finishes.</div>}
      {Object.keys(loadErrors).length > 0 && <div className="command-message error" role="alert"><b>Some records could not be refreshed. Their counts may be incomplete or out of date.</b>{Object.entries(loadErrors).map(([name, message]) => <p key={name}>{name}: {message}</p>)}<button type="button" disabled={loading || busy} onClick={() => void load()}>Retry loading</button></div>}
      {auditWarning && <div className="command-message error" role="alert">{auditWarning}</div>}
      {error && <div className="command-message error" role="alert">{error}</div>}
      {done && <div className="command-message ok" role="status">{done}</div>}
      {tab === 'gallery' && <section className="command-card evidence-shell"><div className="command-section-head"><div><span>Member content review</span><h2>Gallery submissions</h2></div><span className="future-pill">{gallerySubmissions.filter((submission) => !submission.approved).length} pending · {gallerySubmissions.filter((submission) => submission.approved).length} approved</span></div><div className="catalogue-filters" role="group" aria-label="Gallery submission filters"><button className={galleryFilter === 'pending' ? 'active' : ''} onClick={() => setGalleryFilter('pending')}>Pending</button><button className={galleryFilter === 'approved' ? 'active' : ''} onClick={() => setGalleryFilter('approved')}>Approved</button><button className={galleryFilter === 'all' ? 'active' : ''} onClick={() => setGalleryFilter('all')}>All</button><select className="admin-sort" value={gallerySort} onChange={(event) => setGallerySort(event.target.value as 'newest' | 'oldest')} aria-label="Sort gallery submissions"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>{visibleGallerySubmissions.length === 0 ? <div className="command-empty">No gallery submissions in this view.</div> : <div className="stat-review-list">{visibleGallerySubmissions.map((submission) => { const href = galleryMediaUrl(submission); const preview = galleryPreviewUrl(submission); const author = Array.isArray(submission.uploader) ? submission.uploader[0]?.display_name : submission.uploader?.display_name; return <article className="stat-review-row gallery-review-row" key={submission.id}>{preview && (submission.media_type === 'image' || submission.video_id) ? <img className="gallery-review-preview" src={preview} alt="" loading="lazy" /> : <span className="gallery-review-preview gallery-review-placeholder" aria-hidden="true">{submission.media_type === 'video' ? '▶' : '▧'}</span>}<div><b>{submission.caption || (submission.media_type === 'video' ? 'Video submission' : 'Screenshot submission')}</b><span>{author || 'Member'} · {submission.media_type} · {dateTime(submission.created_at)}</span>{href ? <a href={href} target="_blank" rel="noopener noreferrer">Open {submission.media_type === 'video' ? 'video' : 'image'}</a> : <small>Media file is unavailable.</small>}</div><small>{submission.approved ? 'approved' : 'pending'}</small>{submission.approved ? <button className="command-danger ghost" type="button" disabled={busy} onClick={() => reviewGallerySubmission(submission.id, false)}>Remove</button> : <><button className="command-primary" type="button" disabled={busy} onClick={() => reviewGallerySubmission(submission.id, true)}>Approve</button><button className="command-danger ghost" type="button" disabled={busy} onClick={() => reviewGallerySubmission(submission.id, false)}>Remove</button></>}</article>; })}</div>}</section>}
      {tab === 'overview' && <section className="admin-overview">
        <div className="admin-welcome"><div><span>Review inbox</span><h2>What needs attention</h2><p>Review submissions, check attendance and keep member records current. Counts reflect the records loaded in this workspace.</p></div><FaShieldAlt /></div>
        <div className="admin-attention-grid">
          <article><header><FaClipboardCheck /><span>Stat reports</span><b>{pendingStats}</b></header><h3>{pendingStats ? 'Reports waiting for review' : 'Stat inbox is clear'}</h3><p>Inspect each round and its proof before accepted results reach the leaderboard.</p><button onClick={() => openTab('evidence')}>Review stat reports</button></article>
          <article><header><FaImage /><span>Gallery</span><b>{pendingGallery}</b></header><h3>{pendingGallery ? 'Media waiting for review' : 'Gallery inbox is clear'}</h3><p>Open submitted images and videos before they appear in the gallery.</p><button onClick={() => openTab('gallery')}>Review gallery</button></article>
          <article><header><FaImage /><span>Weekly content</span><b>{pendingWeekly}</b></header><h3>{pendingWeekly ? 'Features waiting for review' : 'Weekly inbox is clear'}</h3><p>Review the next community highlights and manage approved features.</p><button onClick={() => openTab('weekly')}>Review weekly content</button></article>
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
          {canUpload && <details className="artwork-metadata-editor"><summary>Edit name and description</summary><div className="command-form"><label>Name<input value={itemDetails.name} maxLength={100} onChange={(event) => setItemDetails((draft) => ({ ...draft, name: event.target.value }))} /></label><label>Description<textarea value={itemDetails.description} maxLength={1000} onChange={(event) => setItemDetails((draft) => ({ ...draft, description: event.target.value }))} /></label><button type="button" className="command-primary" disabled={busy || !itemDetails.name.trim()} onClick={() => void saveItemDetails()}>Save artwork details</button></div></details>}
          <dl className="catalogue-facts"><div><dt>Current holders</dt><dd>{assignments.filter((row) => row.item_id === currentItem.id).length}</dd></div><div><dt>Status</dt><dd>{currentItem.active ? 'Available' : 'Archived'}</dd></div><div><dt>Added</dt><dd>{date(currentItem.created_at)}</dd></div></dl>
          {canUpload && <div className="catalogue-replace"><ArtworkPicker key={currentItem.id} file={replacementFile} onChange={setReplacementFile} disabled={busy} /><button className="command-secondary" disabled={busy || !replacementFile} onClick={() => replaceItemArtwork(currentItem)}>{busy ? 'Replacing' : 'Replace image'}</button><small>The current image stays in place unless the replacement saves successfully.</small></div>}
          {canUpload && <div className="catalogue-actions"><button className="command-secondary" onClick={() => toggleItem(currentItem)}>{currentItem.active ? 'Archive item' : 'Restore item'}</button>{confirmDelete === currentItem.id ? <><button className="command-danger" disabled={busy} onClick={() => removeItem(currentItem)}>{busy ? 'Deleting' : 'Confirm delete'}</button><button className="command-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button></> : <button className="command-danger ghost" onClick={() => removeItem(currentItem)}>Delete item</button>}</div>}
          {confirmDelete === currentItem.id && <p className="catalogue-warning">This removes the {currentItem.kind} and its artwork for good. Archive it instead if you only want it out of the way.</p>}
        </> : <div className="command-empty">Select an item to inspect it.</div>}</div>
        <aside className="catalogue-upload"><div className="command-section-head"><div><span>Admin only</span><h2>Upload artwork</h2></div><FaImage /></div>{canUpload ? <div className="command-form"><label>Type<select value={itemKind} onChange={(event) => setItemKind(event.target.value as ItemKind)}><option value="rank">Rank</option><option value="medal">Medal</option></select></label><label>Name<input value={itemName} maxLength={80} onChange={(event) => setItemName(event.target.value)} placeholder="Item name" /></label><label>Description<textarea value={itemDescription} maxLength={500} onChange={(event) => setItemDescription(event.target.value)} placeholder="What this rank or medal represents" /></label><ArtworkPicker file={itemFile} onChange={setItemFile} disabled={busy} /><button className="command-primary" onClick={uploadItem} disabled={busy || !itemFile}>{busy ? 'Uploading' : 'Add to catalogue'}</button></div> : <div className="command-locked"><FaShieldAlt /><b>Admin access required</b><p>Moderators can assign existing artwork but cannot upload or replace image files.</p></div>}</aside>
      </section>}
      {(tab === 'members' || tab === 'detachments') && <section className={`command-panel-grid members-grid ${tab === 'detachments' ? 'detachment-only' : ''}`}>
        {tab === 'members' && <div className="command-card">
          <div className="command-section-head"><div><span>Discord roster</span><h2>Members</h2></div><b>{members.length}</b></div>
          <label className="command-search"><FaSearch /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search members" /></label>
          {assignMembers.length > 0 && <div className="member-inline-assign command-form horizontal"><p className="staff-member-selection">{assignMembers.length} selected: {assignMembers.map((id) => memberById.get(id)?.display_name ?? 'Member').join(', ')}</p><label>Rank or medal<select value={assignItem} onChange={(event) => setAssignItem(event.target.value)}>{items.filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.kind === 'rank' ? 'Rank' : 'Medal'}: {item.name}</option>)}</select></label><label>Note<input value={assignNote} maxLength={300} onChange={(event) => setAssignNote(event.target.value)} placeholder="Optional note" /></label><button className="command-primary" onClick={assign} disabled={busy || !assignItem}>{busy ? 'Saving' : itemById.get(assignItem)?.kind === 'rank' ? 'Set selected rank' : 'Award selected medal'}</button><button className="command-secondary" onClick={() => setAssignMembers([])}>Clear selection</button></div>}
          {!visibleMembers.length && <p className="command-empty">No members match this name.</p>}
          <div className="member-command-list">{visibleMembers.map((member) => {
            const records = assignments.filter((row) => row.member_id === member.id);
            const rank = records.find((row) => row.item_kind === 'rank');
            const memberMedals = records.filter((row) => row.item_kind === 'medal');
            const currentCompany = member.company_id ? companyById.get(member.company_id) : null;
            return <article key={member.id}>
              <label className="staff-member-select"><input type="checkbox" aria-label={`Select ${member.display_name} for a rank or medal`} checked={assignMembers.includes(member.id)} onChange={(event) => setAssignMembers((current) => event.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id))} /></label>
              <a className="member-profile-link" href={supa ? `#/member/${encodeURIComponent(member.id)}` : '#/design/profile'}><DiscordAvatar url={member.avatar_url} name={member.display_name} className="member-avatar" /><div className="member-summary"><b>{member.display_name}</b><span>{member.role} · {member.discord_id ? 'Discord linked' : 'Discord not linked'}</span><small>{currentCompany?.name ?? 'No detachment'}</small></div></a>
              <div className="member-record"><span>{rank ? itemById.get(rank.item_id)?.name : 'No rank'}</span><span>{records.filter((row) => row.item_kind === 'medal').length} medals</span>{rank && memberTools === member.id && <button className="command-link-danger" type="button" onClick={() => removeAssignment(rank.id)} disabled={busy}>Remove rank</button>}</div>
              {memberTools === member.id && memberMedals.length > 0 && <details className="staff-member-medals"><summary>Manage {memberMedals.length} medals</summary>{memberMedals.map((record) => <div key={record.id}><span>{itemById.get(record.item_id)?.name ?? 'Medal'}<small>{date(record.assigned_at)}</small></span><button className="command-link-danger" disabled={busy} onClick={() => removeAssignment(record.id)}>Remove medal</button></div>)}</details>}
              <button className="command-secondary member-manage-button" type="button" aria-expanded={memberTools === member.id} onClick={() => setMemberTools(memberTools === member.id ? null : member.id)}>{memberTools === member.id ? 'Close tools' : 'Manage member'}</button>
              {memberTools === member.id && <div className="member-detachment-control">
                <select aria-label={`Detachment for ${member.display_name}`} value={detachmentDrafts[member.id] ?? ''} onChange={(event) => setDetachmentDrafts((current) => ({ ...current, [member.id]: event.target.value }))}>
                  <option value="">No detachment</option>
                  {companies.map((company) => <option value={company.id} key={company.id}>{company.name}{company.tag ? ` (${company.tag})` : ''}</option>)}
                </select>
                <button disabled={busy || (detachmentDrafts[member.id] ?? '') === (member.company_id ?? '')} onClick={() => saveMemberDetachment(member.id)}>Save detachment</button>
                <button onClick={() => { setAssignMembers([member.id]); if (!assignItem && items[0]) setAssignItem(items[0].id); }}>Rank or medal</button>
                <button onClick={() => openMemberEditor(member)}>{editingMember === member.id ? 'Editing record' : 'Edit member'}</button>
              </div>}
            </article>;
          })}</div>
          {editingMemberRecord && <div className="member-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setEditingMember(null); }}><div className="member-editor command-form" role="dialog" aria-modal="true" aria-labelledby="member-editor-title">
            <div className="member-editor-head"><div><span>Staff edit</span><h3 id="member-editor-title">{editingMemberRecord.display_name}</h3></div><button className="command-secondary" type="button" onClick={() => setEditingMember(null)} disabled={busy}>Close</button></div>
            <label>Display name<input autoFocus value={memberDraft.display_name} maxLength={100} onChange={(event) => setMemberDraft((draft) => ({ ...draft, display_name: event.target.value }))} /></label>
            <label>Joined year<input type="number" min="2011" max={new Date().getFullYear()} value={memberDraft.joined_year} onChange={(event) => setMemberDraft((draft) => ({ ...draft, joined_year: event.target.value }))} /></label>
            <label>Status<select value={memberDraft.status} onChange={(event) => setMemberDraft((draft) => ({ ...draft, status: event.target.value }))}><option value="applicant">Applicant</option><option value="active">Active</option><option value="reserve">Reserve</option><option value="discharged">Discharged</option><option value="banned">Banned</option></select></label>
            <label>Enlistment date<input type="date" value={memberDraft.enlisted_at} onChange={(event) => setMemberDraft((draft) => ({ ...draft, enlisted_at: event.target.value }))} /></label>
            <label>Discharge date<input type="date" value={memberDraft.discharged_at} onChange={(event) => setMemberDraft((draft) => ({ ...draft, discharged_at: event.target.value }))} /></label>
            <label>Service notes<textarea maxLength={1000} value={memberDraft.notes} onChange={(event) => setMemberDraft((draft) => ({ ...draft, notes: event.target.value }))} placeholder="Internal service notes" /></label>
            {error && <p role="alert" className="command-message error">{error}</p>}
            <div className="member-editor-readonly"><span>Discord ID <b>{editingMemberRecord.discord_id || 'Not linked'}</b></span><span>Role <b>{editingMemberRecord.role}</b></span><span>Avatar <b>{editingMemberRecord.avatar_url ? 'Synced from Discord' : 'Not available'}</b></span><small>Discord identity fields are controlled by the member sync.</small></div>
            <div className="event-form-actions"><button className="command-primary" disabled={busy || !memberDraft.display_name.trim()} onClick={() => saveMemberEditor(editingMemberRecord.id)}>{busy ? 'Saving' : 'Save member record'}</button><button className="command-secondary" disabled={busy} onClick={() => setEditingMember(null)}>Cancel</button></div>
          </div></div>}
        </div>}
        {tab === 'detachments' && <aside className="command-card detachment-card">
          <div className="command-section-head"><div><span>Unit structure</span><h2>Detachments</h2></div><FaFlag /></div>
          <div className="detachment-list">{companies.map((company) => {
            const emblem = companyArtworkUrl(company);
            return <button className={companyEdit === company.id ? 'active' : ''} key={company.id} onClick={() => openCompanyEditor(company.id)}>
              <span><DetachmentEmblem name={company.name} src={emblem} alt={`${company.name} emblem`} /></span>
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
          <div className="attendance-event-list">{events.length === 0 && <div className="command-empty">No events are on the calendar yet.</div>}{events.map((event) => <button className={selectedEvent === event.id && !creatingEvent ? 'active' : ''} key={event.id} onClick={() => { setCreatingEvent(false); setSelectedEvent(event.id); }}><time>{eventDateLabel(event.starts_at)}</time><div><b>{event.title}</b><small>{event.event_type} · {event.duration_minutes} minutes{event.cancelled ? ' · Cancelled' : ''}{event.series_id ? ` · Recurring #${event.series_position}` : ''}</small></div></button>)}</div>
        </aside>
        <div className="command-card attendance-review">
          <div className="command-section-head"><div><span>Event management</span><h2>{creatingEvent ? 'Add an event' : currentEvent?.title ?? 'Choose an event'}</h2></div>{currentEvent && !creatingEvent ? <div className="event-manage-actions"><button className="command-secondary" onClick={openEventEditor}>{editingEvent ? 'Reset form' : 'Edit event'}</button><button className="command-danger ghost" onClick={() => { setEditingEvent(false); setConfirmEventDelete(true); }}>Remove event</button></div> : <FaCalendarCheck />}</div>
          <button className="command-secondary" disabled={busy} onClick={postSchedule}>Post or update Discord schedule</button>
          {currentEvent && !creatingEvent && !currentEvent.cancelled && <button className="command-secondary" disabled={busy} onClick={postEventToDiscord}>Post to Discord</button>}
          {creatingEvent && <div className="event-edit-form">
            <div className="command-section-head"><div><span>Calendar event</span><h3>Create event</h3></div></div>
            <div className="command-form event-form-grid">
              <label>Title<input value={eventTitle} maxLength={100} onChange={(event) => setEventTitle(event.target.value)} placeholder="Friday Linebattle" /></label>
              <label>Game<input value={eventGame} maxLength={80} onChange={(event) => setEventGame(event.target.value)} /></label>
              {eventScheduleFields}
              <label>Repeats<select value={eventRepeat} onChange={(event) => setEventRepeat(event.target.value as EventRepeat)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
              {eventRepeat !== 'none' && <><label>Number of occurrences<input type="number" min="2" max="104" step="1" value={eventRepeatCount} onChange={(event) => setEventRepeatCount(event.target.value)} /><small>Includes the first event. Between 2 and 104.</small></label><div className="event-details-field" aria-live="polite">{recurrence.error ? <p role="alert">{recurrence.error}</p> : recurrence.starts.length > 0 && <><strong>{recurrence.starts.length} events · Ends {eventDateTimeLabel(recurrence.starts[recurrence.starts.length - 1])}</strong><p>{recurrence.starts.slice(0, 3).map(eventDateTimeLabel).join(' · ')}{recurrence.starts.length > 3 ? ' …' : ''}</p></>}<p>Repeats at the same Chicago time. Monthly dates use the last day of shorter months. Repeated fall-back times use the second occurrence; missing spring-forward times must be rescheduled.</p><p>Each occurrence has its own RSVP and attendance records. Edit or remove occurrences individually. Use Post to Discord or the schedule button after saving.</p></div></>}
              <label>Duration in minutes<input type="number" min="15" max="1440" value={eventDuration} onChange={(event) => setEventDuration(event.target.value)} /></label>
              <label>Event type<select value={eventKind} onChange={(event) => setEventKind(event.target.value)}><option value="public_server">Public Server</option><option value="linebattle">Linebattle Event</option><option value="competitive">Competitive</option></select></label>
              <label className="event-details-field">Details<textarea value={eventBody} maxLength={500} onChange={(event) => setEventBody(event.target.value)} placeholder="Maps, rules, or other notes" /></label>
              <div className="event-form-actions"><button className="command-primary" disabled={busy} onClick={createEvent}>{busy ? 'Creating' : eventRepeat === 'none' ? 'Create event' : 'Create recurring events'}</button><button className="command-secondary" disabled={busy} onClick={() => setCreatingEvent(false)}>Cancel</button></div>
            </div>
          </div>}
          {currentEvent?.series_id && !creatingEvent && <p>Recurring event, occurrence {currentEvent.series_position}. Changes here affect only this occurrence.</p>}
          {editingEvent && currentEvent && <div className="event-edit-form">
            <div className="command-section-head"><div><span>Discord synchronized</span><h3>Edit event</h3></div></div>
            <div className="command-form event-form-grid">
              <label>Title<input value={eventTitle} maxLength={100} onChange={(event) => setEventTitle(event.target.value)} /></label>
              <label>Game<input value={eventGame} maxLength={80} onChange={(event) => setEventGame(event.target.value)} placeholder="Holdfast: Nations At War" /></label>
              {eventScheduleFields}
              <label>Duration in minutes<input type="number" min="15" max="1440" value={eventDuration} onChange={(event) => setEventDuration(event.target.value)} /></label>
              <label>Event type<select value={eventKind} onChange={(event) => setEventKind(event.target.value)}><option value="public_server">Public Server</option><option value="linebattle">Linebattle Event</option><option value="competitive">Competitive</option></select></label>
              <label className="event-details-field">Details<textarea value={eventBody} maxLength={500} onChange={(event) => setEventBody(event.target.value)} placeholder="Maps, rules, or other notes" /></label>
              <div className="event-form-actions"><button className="command-primary" disabled={busy} onClick={saveEvent}>{busy ? 'Saving' : 'Save changes'}</button><button className="command-secondary" disabled={busy} onClick={() => setEditingEvent(false)}>Cancel</button></div>
            </div>
          </div>}
          {confirmEventDelete && currentEvent && <div className="event-delete-confirm" role="alertdialog" aria-labelledby="event-delete-title"><FaCalendarCheck /><div><h3 id="event-delete-title">Remove {currentEvent.title}?</h3><p>This removes the event from the website and tells the Discord bot to delete its public and staff posts. Attendance records remain in the audit trail.</p></div><div><button className="command-danger" disabled={busy} onClick={removeEvent}>{busy ? 'Removing' : 'Confirm removal'}</button><button className="command-secondary" disabled={busy} onClick={() => setConfirmEventDelete(false)}>Keep event</button></div></div>}
          {currentEvent && <div className="attendance-summary">
            <div><small>Starts (Chicago)</small><b>{eventDateTimeLabel(currentEvent.starts_at)}</b></div>
            <div><small>Tracked time</small><b>{currentWindow ? trackedMinutes > 0 ? `${trackedMinutes} minutes` : 'Just started' : 'Not started'}</b></div>
            <div><small>People seen</small><b>{currentWindow?.people_seen ?? 0}</b></div>
            <div><small>Voice hours</small><b>{eventVoiceHours ? `${eventVoiceHours.toFixed(1)}h` : 'Not recorded'}</b></div>
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
                  ? `In voice for the full ${trackedMinutes}-minute tracking window · ${presenceHours(presence.samples)}h recorded`
                  : `In voice for about ${Math.max(1, Math.round(trackedMinutes * coverage / 100))} of ${trackedMinutes} tracked minutes · ${presenceHours(presence.samples)}h recorded`;
            return <article key={member.id}>
              <a className="member-profile-link" href={supa ? `#/member/${encodeURIComponent(member.id)}` : '#/design/profile'}><DiscordAvatar url={member.avatar_url} name={member.display_name} className="member-avatar" /><div><b>{member.display_name}</b><span>RSVP: {rsvpLabel}</span><small>{voiceSummary}</small></div></a>
              <div className="attendance-actions" aria-label={`Attendance for ${member.display_name}`}>
                <button className={rsvp?.attendance === 'attended' ? 'active attended' : ''} disabled={busy} onClick={() => setAttendance(member.id, 'attended')}>Attended</button>
                <button className={rsvp?.attendance === 'no_show' ? 'active no-show' : ''} disabled={busy} onClick={() => setAttendance(member.id, 'no_show')}>No-show</button>
                <button disabled={busy || !rsvp?.attendance} onClick={() => setAttendance(member.id, null)}>Clear</button>
              </div>
            </article>;
          })}</div>
          {unlinkedPresence.length > 0 && <div className="attendance-unlinked"><span>Not linked to a website member</span>{unlinkedPresence.map((row) => <div key={row.discord_id}><b>Discord {row.discord_id}</b><small>{row.samples} voice samples · {presenceHours(row.samples)}h recorded</small></div>)}</div>}
        </div>
      </section>}
      {tab === 'evidence' && <section className="staff-review-workspace">
        <div className="stat-review-filters" aria-label="Stat submission filters">
          <label>Find a report<input value={statSearch} onChange={(event) => setStatSearch(event.target.value)} placeholder="Member or event name" /></label>
          <label>Status<select value={statStatusFilter} onChange={(event) => setStatStatusFilter(event.target.value as typeof statStatusFilter)}><option value="submitted">Needs review</option><option value="all">All statuses</option><option value="approved">Approved</option><option value="rejected">Denied</option></select></label>
          <label>Type<select value={statCategoryFilter} onChange={(event) => setStatCategoryFilter(event.target.value)}><option value="all">All types</option><option value="public_server">Public Servers</option><option value="public_linebattle">Linebattle Stats</option><option value="competitive">Competitive</option></select></label>
          <label>Order<select value={statSort} onChange={(event) => setStatSort(event.target.value as typeof statSort)}><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select></label>
          <span className="stat-review-count">{visibleStatSubmissions.length} reports</span>
        </div>
        <div className="staff-review-columns">
          <aside className="staff-report-list" aria-label="Reports">
            <header><b>Reports</b><span>{pendingStats} need review</span></header>
            {visibleStatSubmissions.length === 0 ? <p className="command-empty">No reports match these filters.</p> : visibleStatSubmissions.map((submission) => {
              const member = memberById.get(submission.submitter_id);
              const proofCount = submission.stat_round?.reduce((count, round) => count + (round.stat_proof?.filter((proof) => !proof.deleted_at).length ?? 0), 0) ?? 0;
              return <button type="button" key={submission.id} className={selectedStat?.id === submission.id ? 'selected' : ''} aria-pressed={selectedStat?.id === submission.id} onClick={() => setSelectedStatId(submission.id)}>
                <span className="staff-report-person"><DiscordAvatar url={member?.avatar_url ?? null} name={member?.display_name ?? 'Discord member'} className="member-avatar" /><b>{member?.display_name ?? 'Discord member'}</b><span className={'stat-status stat-status-' + submission.status}>{submission.status === 'submitted' ? 'Review' : submission.status}</span></span>
                <strong>{submission.event_name || statCategoryLabel(submission.category)}</strong>
                <small>{dateTime(submission.created_at)} · {submission.stat_round?.length ?? 0} rounds</small>
                <span className="staff-report-proof-count">{proofCount ? `${proofCount} proof image${proofCount === 1 ? '' : 's'}` : 'No proof attached'}</span>
              </button>;
            })}
          </aside>
          {selectedStat ? <article className="staff-report-detail" key={selectedStat.id}>
            <header className="staff-report-header">
              <div><span className="staff-overline">{statCategoryLabel(selectedStat.category)}</span><h2>{selectedStat.event_name || statCategoryLabel(selectedStat.category)}</h2><p>{selectedStatMember ? <a href={supa ? '#/member/' + encodeURIComponent(selectedStatMember.id) : '#/design/profile'}>{selectedStatMember.display_name}</a> : 'Discord member'} · Submitted {dateTime(selectedStat.created_at)}</p></div>
              <span className={'stat-status stat-status-' + selectedStat.status}>{selectedStat.status === 'submitted' ? 'Needs review' : selectedStat.status}</span>
            </header>
            <div className="staff-report-totals"><span><b>{selectedStat.stat_round?.reduce((sum, round) => sum + round.kills, 0) ?? 0}</b> Kills</span><span><b>{selectedStat.stat_round?.reduce((sum, round) => sum + round.deaths, 0) ?? 0}</b> Deaths</span><span><b>{selectedStat.stat_round?.length ?? 0}</b> Rounds</span>{selectedStat.status === 'submitted' && <button className="command-secondary" type="button" onClick={() => editingStatId === selectedStat.id ? setEditingStatId(null) : beginStatEdit(selectedStat)}>{editingStatId === selectedStat.id ? 'Finish editing' : 'Edit round values'}</button>}</div>
            {!selectedStat.stat_round?.length && <p className="command-empty">No rounds are attached to this report.</p>}
            <div className="staff-report-rounds">{selectedStat.stat_round?.map((round) => {
              const key = selectedStat.id + ':' + round.round_number;
              const draft = statRoundDrafts[key];
              const editing = editingStatId === selectedStat.id;
              const proofs = round.stat_proof?.filter((proof) => !proof.deleted_at) ?? [];
              return <section className="staff-report-round" key={round.round_number}>
                <header><h3>Round {round.round_number}</h3>{editing && <button className="command-primary" type="button" disabled={busy} onClick={() => saveStatRound(selectedStat.id, round)}>Save round</button>}</header>
                {editing ? <div className="stat-round-edit">
                  <label>Kills<input type="number" min="0" value={draft?.kills ?? String(round.kills)} onChange={(event) => setStatRoundDrafts((current) => ({ ...current, [key]: { kills: event.target.value, deaths: current[key]?.deaths ?? String(round.deaths), is_mvp: current[key]?.is_mvp ?? round.is_mvp, is_top5: current[key]?.is_top5 ?? round.is_top5 } }))} /></label>
                  <label>Deaths<input type="number" min="0" value={draft?.deaths ?? String(round.deaths)} onChange={(event) => setStatRoundDrafts((current) => ({ ...current, [key]: { kills: current[key]?.kills ?? String(round.kills), deaths: event.target.value, is_mvp: current[key]?.is_mvp ?? round.is_mvp, is_top5: current[key]?.is_top5 ?? round.is_top5 } }))} /></label>
                  <label><input type="checkbox" checked={draft?.is_mvp ?? round.is_mvp} onChange={(event) => setStatRoundDrafts((current) => ({ ...current, [key]: { kills: current[key]?.kills ?? String(round.kills), deaths: current[key]?.deaths ?? String(round.deaths), is_mvp: event.target.checked, is_top5: current[key]?.is_top5 ?? round.is_top5 } }))} /> MVP</label>
                  <label><input type="checkbox" checked={draft?.is_top5 ?? round.is_top5} onChange={(event) => setStatRoundDrafts((current) => ({ ...current, [key]: { kills: current[key]?.kills ?? String(round.kills), deaths: current[key]?.deaths ?? String(round.deaths), is_mvp: current[key]?.is_mvp ?? round.is_mvp, is_top5: event.target.checked } }))} /> Top 5</label>
                </div> : <div className="stat-round-values"><span><b>{round.kills}</b> kills</span><span><b>{round.deaths}</b> deaths</span><span>{round.is_mvp ? 'MVP' : 'No MVP'}</span><span>{round.is_top5 ? 'Top 5' : 'Not Top 5'}</span></div>}
                {proofs.length ? <div className="staff-proof-grid">{proofs.map((proof) => {
                  const url = statProofUrl(proof);
                  const title = `Round ${round.round_number} proof: ${selectedStat.event_name || statCategoryLabel(selectedStat.category)}`;
                  return url ? <div className="staff-proof-item" key={proof.id}><button type="button" onClick={() => setProofPreview({ url, title })}><ProofThumbnail url={url} title={title} /><span>Inspect screenshot</span></button><a href={url} target="_blank" rel="noopener noreferrer">Open original ↗</a></div> : <p className="staff-proof-unavailable" key={proof.id}>The proof file is unavailable.</p>;
                })}</div> : <p className="staff-proof-note">{DEMO ? 'Example only. Real Discord proof screenshots appear here for staff inspection.' : 'No proof is attached to this round. Check the Discord report before deciding.'}</p>}
              </section>;
            })}</div>
            <footer className="staff-review-decision">
              <p>{selectedStat.status === 'submitted' ? 'Check every round and screenshot before accepting this report.' : 'This report has already been reviewed. Its values remain available above.'}</p>
              <div>{selectedStat.status === 'submitted' && <><button className="command-primary" type="button" disabled={busy} onClick={() => reviewStatSubmission(selectedStat.id, 'approved')}>Accept report</button><button className="command-secondary" type="button" disabled={busy} onClick={() => reviewStatSubmission(selectedStat.id, 'rejected')}>Deny report</button></>}
              <button className="command-link-danger" type="button" disabled={busy} onClick={() => setConfirmStatDelete(selectedStat.id)}>Remove record</button></div>
              {confirmStatDelete === selectedStat.id && <div className="staff-delete-confirm" role="alert"><p>Remove this report and its recorded results? This is separate from denying it.</p><button className="command-danger" disabled={busy} onClick={() => { void removeStatSubmission(selectedStat.id); setConfirmStatDelete(null); }}>Confirm removal</button><button className="command-secondary" disabled={busy} onClick={() => setConfirmStatDelete(null)}>Keep report</button></div>}
            </footer>
          </article> : <div className="staff-report-detail staff-report-empty"><FaClipboardCheck /><h2>{statSubmissions.length ? 'No matching report' : 'The review inbox is clear'}</h2><p>{statSubmissions.length ? 'Adjust the filters to find a member or event.' : 'Submitted Discord reports will appear here with their rounds and proof.'}</p></div>}
        </div>
      </section>}
      {tab === 'audit' && <section className="command-card"><div className="command-section-head"><div><span>Accountability</span><h2>Audit log</h2></div><b>{audit.length}</b></div><div className="audit-list">{audit.length === 0 && <div className="command-empty">Changes will appear here after the first artwork upload or member record change.</div>}{auditPageRows.map((row) => <article key={row.id}><FaHistory /><div><b>{labelAction(row.action)}</b><span>{row.member_id ? memberById.get(row.member_id)?.display_name ?? 'Member' : 'Catalogue'}{row.item_id ? ` · ${itemById.get(row.item_id)?.name ?? 'Item'}` : ''}</span>{auditDetail(row.detail) && <small>{auditDetail(row.detail)}</small>}</div><time>{date(row.created_at)}</time></article>)}</div>{audit.length > 0 && <nav className="audit-pagination" aria-label="Audit log pages"><button className="command-secondary" type="button" disabled={auditPage === 1} onClick={() => setAuditPage((page) => Math.max(1, page - 1))}>Previous</button><div>{Array.from({ length: auditPageCount }, (_, index) => index + 1).map((page) => <button key={page} className={page === auditPage ? 'active' : ''} type="button" aria-current={page === auditPage ? 'page' : undefined} onClick={() => setAuditPage(page)}>{page}</button>)}</div><button className="command-secondary" type="button" disabled={auditPage === auditPageCount} onClick={() => setAuditPage((page) => Math.min(auditPageCount, page + 1))}>Next</button></nav>}</section>}
      {tab === 'weekly' && <WeeklyReview submissions={weeklySubmissions} memberName={(id) => memberById.get(id)?.display_name ?? 'Member'} busy={busy} loading={loading} error={loadErrors['Weekly content']} onRefresh={() => void load()} onReview={(id, status) => void reviewWeeklySubmission(id, status)} onPublish={() => void publishWeekly()} />}
      {tab === 'settings' && <section className="command-card settings-shell">
        <div className="command-section-head"><div><span>Access and data</span><h2>Workspace permissions</h2></div><FaCog /></div>
        <div className="staff-settings-grid"><article><h3>Your access</h3><p><strong>{me!.display_name}</strong> is signed in as <strong>{me!.role}</strong>.</p><p>Discord synchronization controls the account identity. The database checks permission for each saved change.</p></article><article><h3>Member records</h3><p>Admins and moderators manage member records and review submissions. Artwork creation, replacement and deletion are restricted to admins.</p><button className="command-secondary" onClick={() => openTab('members')}>Open Members</button></article><article><h3>Audit history</h3><p>The workspace displays the latest 75 records. Each page shows up to 25 entries.</p><button className="command-secondary" onClick={() => openTab('audit')}>Open audit log</button></article><article><h3>Integration settings</h3><p>Discord role mappings, synchronization schedules and backend event defaults are not editable here yet. No unsaved controls are presented.</p></article></div>
      </section>}
        </div>
      </div>
      <dialog className="staff-proof-dialog" ref={proofDialog} aria-labelledby="staff-proof-title" onClose={() => setProofPreview(null)} onClick={(event) => { if (event.target === event.currentTarget) setProofPreview(null); }}>
        <header><h2 id="staff-proof-title">{proofPreview?.title ?? 'Proof screenshot'}</h2><button className="command-secondary" autoFocus type="button" onClick={() => setProofPreview(null)}>Close</button></header>
        {proofPreview && <>{proofFailed ? <p className="staff-proof-unavailable" role="alert">This screenshot could not be loaded. The file may have expired or access may be restricted. Check the original before deciding.</p> : <img src={proofPreview.url} alt={proofPreview.title} onError={() => setProofFailed(true)} />}<a href={proofPreview.url} target="_blank" rel="noopener noreferrer">Open original screenshot ↗</a></>}
      </dialog>
    </main>
  );
}
