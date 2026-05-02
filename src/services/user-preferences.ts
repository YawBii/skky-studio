// User preferences service: persisted UI prefs (split sizes, etc.).
// Real DB write requires `user_preferences` table from the collaboration migration.
// Falls back to localStorage when signed-out or DB write fails.
import { supabase } from "@/integrations/supabase/client";

const LS_KEY = "yawb:user-preferences";

export type UserPreferences = {
  workspaceSplit?: Record<string, number>; // percentage layout (panel id -> pct)
  // future keys go here
  [k: string]: unknown;
};

function readLocal(): UserPreferences {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocal(prefs: UserPreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function loadPreferences(): Promise<UserPreferences> {
  const local = readLocal();
  const uid = await currentUserId();
  if (!uid) return local;
  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("preferences")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) return local;
    const remote = (data?.preferences as UserPreferences | undefined) ?? {};
    // Merge: remote wins on collision, local fills gaps.
    const merged = { ...local, ...remote };
    writeLocal(merged);
    return merged;
  } catch {
    return local;
  }
}

export async function savePreferences(patch: Partial<UserPreferences>): Promise<void> {
  const merged = { ...readLocal(), ...patch };
  writeLocal(merged); // always persist locally first
  const uid = await currentUserId();
  if (!uid) return;
  try {
    await supabase
      .from("user_preferences")
      .upsert({ user_id: uid, preferences: merged, updated_at: new Date().toISOString() })
      .select()
      .single();
  } catch {
    // swallow — localStorage is the safety net
  }
}
