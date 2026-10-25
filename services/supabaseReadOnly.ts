import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default institutional fallback credentials for DepEd USIS Master School Registrar
const USIS_DEFAULT_URL = 'https://vubmvthbsnzzhmjbdces.supabase.co';
const USIS_DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1Ym12dGhic256emhtamJkY2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTIwMTMsImV4cCI6MjA4MDY4ODAxM30.woE4szCZ6PAbTU54Rf5b9oqr5QPS9aaBh_qRmLJ3B8k';

/**
 * Resolved USIS database connection:
 * Priority:
 * 1. VITE_USIS_SUPABASE_URL
 * 2. SUPABASE_URL (USIS database in .env)
 * 3. USIS_DEFAULT_URL (institutional registrar endpoint)
 */
const rawUrl = 
  import.meta.env.VITE_USIS_SUPABASE_URL ||
  (import.meta.env as Record<string, string>).SUPABASE_URL ||
  (import.meta.env as Record<string, string>).USIS_SUPABASE_URL ||
  USIS_DEFAULT_URL;

const rawKey = 
  import.meta.env.VITE_USIS_SUPABASE_ANON_KEY ||
  (import.meta.env as Record<string, string>).SUPABASE_ANON_KEY ||
  (import.meta.env as Record<string, string>).USIS_SUPABASE_ANON_KEY ||
  USIS_DEFAULT_ANON_KEY;

const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim() : USIS_DEFAULT_URL;
const supabaseAnonKey = typeof rawKey === 'string' ? rawKey.trim() : USIS_DEFAULT_ANON_KEY;

let client: SupabaseClient;

try {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
} catch (e) {
  console.error('[USIS ReadOnly] Client initialization error:', e);
  client = createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const supabaseReadOnly = client;
export default supabaseReadOnly;
