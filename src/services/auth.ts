import { getSupabase } from "@/integrations/supabase/client";

export interface Session {
  userId: string;
  email: string;
  displayName: string;
}

function toSession(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined): Session | null {
  if (!user) return null;
  const email = user.email ?? "";
  const meta = user.user_metadata ?? {};
  const displayName =
    (typeof meta.display_name === "string" && meta.display_name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    (email ? email.split("@")[0] : "User");
  return { userId: user.id, email, displayName };
}

/** Friendly mapper for Supabase Auth errors. Avoids leaking internals. */
function friendlyError(message: string | undefined): string {
  if (!message) return "Something went wrong. Please try again.";
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Invalid email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email address before signing in.";
  if (m.includes("user already registered")) return "An account with this email already exists.";
  if (m.includes("password should be at least")) return "Password must be at least 6 characters.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("not configured")) return "Authentication is not configured. Please contact support.";
  return message;
}

export async function getSession(): Promise<Session | null> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getSession();
    return toSession(data.session?.user);
  } catch {
    return null;
  }
}

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyError(error.message));
  const session = toSession(data.user);
  if (!session) throw new Error("Sign-in failed.");
  return session;
}

export async function signInWithProvider(provider: "google" | "apple"): Promise<void> {
  const supabase = await getSupabase();
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) throw new Error(friendlyError(error.message));
}

export async function signUp(email: string, password: string, displayName?: string): Promise<Session | null> {
  const supabase = await getSupabase();
  const emailRedirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: displayName ? { display_name: displayName } : undefined,
    },
  });
  if (error) throw new Error(friendlyError(error.message));
  // If email confirmation is required, session is null until confirmed.
  return toSession(data.user);
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const supabase = await getSupabase();
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(friendlyError(error.message));
}

export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(friendlyError(error.message));
}

/** Backwards-compatible alias for existing UI imports. */
export const sendMagicLink = sendPasswordResetEmail;

/**
 * Subscribe to auth state changes. Returns an unsubscribe function.
 */
export async function onAuthChange(cb: (session: Session | null) => void): Promise<() => void> {
  const supabase = await getSupabase();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(toSession(session?.user));
  });
  return () => data.subscription.unsubscribe();
}
