// Workspaces service: reads from Supabase `workspaces` + `workspace_members`.
// Falls back to a demo workspace when the user is signed-out, the table is
// missing, or the query fails (so the UI never breaks during the migration
// rollout).
import { supabase } from "@/integrations/supabase/client";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member" | "viewer" | null;
  isDemo?: boolean;
}

export const DEMO_WORKSPACE: Workspace = {
  id: "demo-workspace",
  name: "Skky Group",
  slug: "skky-group",
  role: "owner",
  isDemo: true,
};

/** True when the result represents real DB rows (not a fallback). */
export type WorkspacesResult = {
  workspaces: Workspace[];
  source: "supabase" | "demo-fallback" | "demo-empty";
};

export async function listWorkspaces(): Promise<WorkspacesResult> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return { workspaces: [DEMO_WORKSPACE], source: "demo-fallback" };

    // Join via workspace_members so RLS naturally scopes to this user.
    const { data, error } = await supabase
      .from("workspace_members")
      .select("role, workspaces:workspace_id ( id, name, slug )")
      .eq("user_id", uid);

    if (error) return { workspaces: [DEMO_WORKSPACE], source: "demo-fallback" };

    const rows = (data ?? [])
      .map((r) => {
        const ws = (r as { workspaces: { id: string; name: string; slug: string } | null }).workspaces;
        if (!ws) return null;
        return {
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          role: (r as { role: Workspace["role"] }).role,
        } satisfies Workspace;
      })
      .filter((x): x is Workspace => !!x);

    if (rows.length === 0) {
      // Real DB, just empty — UI should show "create your first workspace".
      return { workspaces: [], source: "demo-empty" };
    }
    return { workspaces: rows, source: "supabase" };
  } catch {
    return { workspaces: [DEMO_WORKSPACE], source: "demo-fallback" };
  }
}

export async function createWorkspace(input: { name: string; slug: string }): Promise<Workspace | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return null;
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name: input.name, slug: input.slug, created_by: uid })
      .select("id, name, slug")
      .single();
    if (error || !data) return null;
    return { id: data.id, name: data.name, slug: data.slug, role: "owner" };
  } catch {
    return null;
  }
}
