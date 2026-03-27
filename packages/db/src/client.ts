import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

export type TypedSupabaseClient = SupabaseClient<Database>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/** True when Supabase env vars are configured */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Browser client — uses anon key, respects RLS.
 *  Returns null (typed as client) when env vars missing — build-safe for static gen. */
export function createBrowserClient(): TypedSupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[db] Supabase not configured — using mock client');
    return null as unknown as TypedSupabaseClient;
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

/** Server component client — uses anon key + cookie-based session */
export function createServerClient(cookieStore?: { get: (name: string) => { value: string } | undefined }): TypedSupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[db] Supabase not configured — using mock client');
    return null as unknown as TypedSupabaseClient;
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: cookieStore ? {} : undefined,
    },
  });
}

/** Admin client — uses service_role key, bypasses RLS. Server only! */
export function createAdminClient(): TypedSupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
