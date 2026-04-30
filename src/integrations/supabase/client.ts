import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicConfig } from "@/server/config.functions";

let _client: SupabaseClient | null = null;
let _initPromise: Promise<SupabaseClient> | null = null;

/**
 * Lazily initialize the browser Supabase client by fetching public config
 * (URL + anon/publishable key) from a server function. The anon key is
 * safe to expose to the browser — RLS enforces row-level access.
 */
export async function getSupabase(): Promise<SupabaseClient> {
  if (_client) return _client;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const cfg = await getPublicConfig();
    if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) {
      throw new Error(
        "Supabase is not configured. Set EXTERNAL_SUPABASE_URL and EXTERNAL_SUPABASE_PUBLISHABLE_KEY.",
      );
    }
    _client = createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });
    return _client;
  })();

  return _initPromise;
}

/** Synchronous accessor for code paths that already awaited init. */
export function getSupabaseSync(): SupabaseClient | null {
  return _client;
}
