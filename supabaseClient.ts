import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * DATABASE CONFIGURATION
 * Loads credentials dynamically from environment variables (.env / .env.local).
 * In Vite, client-accessible variables are prefixed with VITE_.
 */
const rawUrl = import.meta.env.VITE_SUPABASE_URL || (import.meta.env as Record<string, string>).SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (import.meta.env as Record<string, string>).SUPABASE_ANON_KEY || '';

const URL = typeof rawUrl === 'string' ? rawUrl.trim() : '';
const KEY = typeof rawKey === 'string' ? rawKey.trim() : '';

let client: SupabaseClient;

// Verification for developer setup
const isConfigured = Boolean(
  URL &&
  KEY &&
  !URL.includes('your-project-id') &&
  !KEY.includes('your-anon-key') &&
  URL.startsWith('http')
);

if (!isConfigured) {
  console.warn(
    "I-LEMS DATABASE CONFIGURATION NOTICE:\n" +
    "Supabase credentials are not configured or are using placeholders in .env / .env.local.\n" +
    "Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable database synchronization."
  );
}

try {
  if (isConfigured) {
    client = createClient(URL, KEY);
  } else {
    // Safe placeholder initialization to prevent crash on startup when credentials are unset
    client = createClient('https://placeholder.supabase.co', 'placeholder-anon-key');
  }
} catch (e) {
  console.error("Supabase Client Initialization Error:", e);
  client = {} as any;
}

export const supabase = client;

/**
 * Validates that the database is reachable and configured.
 * This is used by the App to decide whether to show the Dashboard or the Error screen.
 */
export const checkConnection = async (): Promise<boolean> => {
  if (!isConfigured || !URL || !KEY) {
    return false;
  }
  
  if (!supabase || typeof supabase.from !== 'function') {
    return false;
  }
  
  try {
    const { error, status } = await supabase
      .from('app_settings')
      .select('id')
      .limit(1);
    
    if (error) {
        // PGRST116 means the table is reachable but likely empty (valid connection)
        if (error.code === 'PGRST116' || status === 404) return true; 
        return false;
    }
    return true;
  } catch (e) {
    // Catch networking errors (e.g., DNS failure, invalid URL format)
    return false;
  }
};
