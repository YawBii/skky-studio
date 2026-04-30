import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  (typeof process !== "undefined" ? process.env.VITE_SUPABASE_URL : undefined) ??
  "";

const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (typeof process !== "undefined" ? process.env.VITE_SUPABASE_PUBLISHABLE_KEY : undefined) ??
  "";

let _client: SupabaseClient | null = null;

function createBrowserClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  });
}

/**
 * Browser Supabase client. Uses the publishable/anon key only — RLS enforces
 * row-level access. Never import a service-role key into client code.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_client) _client = createBrowserClient();
  return _client;
}

/** Async accessor kept for backwards compatibility with existing call sites. */
export async function getSupabase(): Promise<SupabaseClient> {
  return getSupabaseClient();
}

export function getSupabaseSync(): SupabaseClient | null {
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const c = getSupabaseClient() as unknown as Record<string | symbol, unknown>;
    return c[prop as string];
  },
});
