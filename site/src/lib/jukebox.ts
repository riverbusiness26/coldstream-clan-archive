import { supa } from './supa';

export const MUSIC_BUCKET = 'jukebox-music';
export const MAX_MUSIC_BYTES = 25 * 1024 * 1024;
export const MUSIC_TYPES: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
};
export type JukeboxTrack = { id: string; title: string; artist: string; storage_key: string; published: boolean; sort_order: number };

export function validateMusic(file: Pick<File, 'type' | 'size'>) {
  if (!MUSIC_TYPES[file.type]) throw new Error('Choose an MP3, M4A, Ogg or WAV audio file.');
  if (!file.size || file.size > MAX_MUSIC_BYTES) throw new Error('Each track must be between 1 byte and 25 MB.');
}

function database() {
  if (!supa) throw new Error('Music uploads need the connected website database. This preview cannot save tracks.');
  return supa;
}

export async function loadJukebox(admin = false): Promise<JukeboxTrack[]> {
  if (!supa) return [];
  let query = supa.from('jukebox_track').select('id,title,artist,storage_key,published,sort_order').order('sort_order').order('created_at').order('id');
  if (!admin) query = query.eq('published', true);
  const { data, error } = await query;
  if (error) throw new Error('The jukebox playlist could not load. Please retry.');
  return data ?? [];
}

export async function musicUrl(track: JukeboxTrack) {
  const { data, error } = await database().storage.from(MUSIC_BUCKET).createSignedUrl(track.storage_key, 3600);
  if (error || !data?.signedUrl) throw new Error('This track is unavailable. Refresh the playlist and try again.');
  return data.signedUrl;
}

export async function saveMusic(track: JukeboxTrack) {
  const { error } = await database().rpc('save_jukebox_track', {
    target_track: track.id, track_storage_key: track.storage_key,
    track_title: track.title.trim(), track_artist: track.artist.trim(),
    track_published: track.published, track_order: track.sort_order,
  });
  if (error) throw new Error(error.message);
}

export async function uploadMusic(file: File, title: string, artist: string) {
  validateMusic(file);
  if (!title.trim()) throw new Error('Give the track a title.');
  const client = database();
  const id = crypto.randomUUID();
  const storage_key = `${id}.${MUSIC_TYPES[file.type]}`;
  const { error } = await client.storage.from(MUSIC_BUCKET).upload(storage_key, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  try {
    await saveMusic({ id, storage_key, title, artist, published: false, sort_order: 0 });
  } catch (error) {
    // If the response was lost after commit, retain the uploaded track, not a broken row.
    const { data: existing, error: lookupError } = await client.from('jukebox_track').select('id').eq('id', id).maybeSingle();
    if (existing) return;
    if (!lookupError) await client.storage.from(MUSIC_BUCKET).remove([storage_key]);
    throw error;
  }
}
