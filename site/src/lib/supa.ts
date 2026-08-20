// Supabase client, or demo mode when no project is configured yet.
// Demo mode runs the whole site read-only off the bundled seed data so the
// design and flows can be reviewed before the backend exists.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supa: SupabaseClient | null = url && anon ? createClient(url, anon) : null;
export const DEMO = !supa;

export const STEAM_LOGIN_URL = url ? `${url}/functions/v1/steam-auth` : null;
