import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  (typeof process !== "undefined" ? process.env.VITE_SUPABASE_URL : undefined) ??
  "";

const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (typeof process !== "undefined" ? process.env.VITE_SUPABASE_PUBLISHABLE_KEY : undefined) ??
  "";

// Detect missing OR placeholder values. Placeholders cause `Failed to fetch`
// because the browser tries to hit a nonexistent host like YOUR-PROJECT-REF.
const PLACEHOLDER_URL = /YOUR-PROJECT-REF/i;
const PLACEHOLDER_KEY = /YOUR-PUBLISHABLE-OR-ANON-KEY/i;

const urlOk = !!SUPABASE_URL && !PLACEHOLDER_URL.test(SUPABASE_URL);
const keyOk = !!SUPABASE_PUBLISHABLE_KEY && !PLACEHOLDER_KEY.test(SUPABASE_PUBLISHABLE_KEY);

// Temporary diagnostic — booleans only, never the key itself.
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.info("[yawb] supabase env", { hasUrl: urlOk, hasKey: keyOk });
}

export const SUPABASE_ENV_OK = urlOk && keyOk;

let _client: SupabaseClient | null = null;

function createBrowserClient(): SupabaseClient {
  if (!SUPABASE_ENV_OK) {
    throw new Error(
      "Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (publishable/anon key only).",
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
