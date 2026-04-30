// Invites service — frontend-shaped API. Real persistence requires the
// workspace_invites table from the collaboration migration.
import { supabase } from "@/integrations/supabase/client";

export interface InviteInput {
  workspaceId: string;
  email: string;
  role: "admin" | "member" | "viewer";
}

export interface PendingInvite {
  id: string;
  email: string;
  role: InviteInput["role"];
  invitedAt: string;
  expiresAt: string;
}

function token() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function createInvite(input: InviteInput): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { ok: false, reason: "not-signed-in" };
    const { error } = await supabase.from("workspace_invites").insert({
      workspace_id: input.workspaceId,
      email: input.email.toLowerCase().trim(),
      role: input.role,
      token: token(),
      invited_by: u.user.id,
    });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "unknown" };
  }
}

export async function listInvites(workspaceId: string): Promise<PendingInvite[]> {
  try {
    const { data, error } = await supabase
      .from("workspace_invites")
      .select("id,email,role,created_at,expires_at,accepted_at")
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id as string,
      email: r.email as string,
      role: r.role as PendingInvite["role"],
      invitedAt: r.created_at as string,
      expiresAt: r.expires_at as string,
    }));
  } catch {
    return [];
  }
}
