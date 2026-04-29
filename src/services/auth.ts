// TODO(codex): wire to Supabase Auth via @/integrations/supabase/client (browser).
export interface Session { userId: string; email: string; displayName: string }

let _session: Session | null = { userId: "u_1", email: "ana@skky.group", displayName: "Ana — Skky Group" };

export async function getSession(): Promise<Session | null> { return _session; }
export async function signInWithPassword(email: string, _password: string): Promise<Session> {
  _session = { userId: "u_demo", email, displayName: email.split("@")[0] };
  return _session;
}
export async function signInWithProvider(_provider: "google" | "apple"): Promise<void> {}
export async function signUp(email: string, _password: string): Promise<Session> {
  _session = { userId: "u_new", email, displayName: email.split("@")[0] };
  return _session;
}
export async function signOut(): Promise<void> { _session = null; }
export async function sendMagicLink(_email: string): Promise<void> {}
