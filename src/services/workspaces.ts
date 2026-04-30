// Workspaces service: reads from Supabase `workspaces` + `workspace_members`.
//
// Source semantics:
//   - "supabase"      -> real DB rows for the signed-in user
//   - "demo-empty"    -> signed-in user with zero rows in Supabase (show empty state)
//   - "demo-fallback" -> NOT signed in (no auth user). Render demo so the marketing
//                       shell still has something to show. Never used for signed-in users.
//   - "error"         -> signed-in user but the query failed (e.g. migration not
//                       applied, RLS blocking). UI MUST show empty state + error,
//                       not the Skky Group demo, so the user is not lied to.
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

export type WorkspacesSource = "supabase" | "demo-fallback" | "demo-empty" | "error";

export type WorkspacesResult = {
  workspaces: Workspace[];
  source: WorkspacesSource;
  error?: string;
};

export async function listWorkspaces(): Promise<WorkspacesResult> {
  let uid: string | undefined;
  try {
    const { data: userData } = await supabase.auth.getUser();
    uid = userData.user?.id;
  } catch {
    // auth call failed -> treat as signed-out
  }
  if (!uid) return { workspaces: [DEMO_WORKSPACE], source: "demo-fallback" };

  try {
    const { data, error } = await supabase
      .from("workspace_members")
      .select("role, workspaces:workspace_id ( id, name, slug )")
      .eq("user_id", uid);

    if (error) {
      // Signed-in but query failed. Do NOT pretend Skky Group exists.
      return { workspaces: [], source: "error", error: error.message };
    }

    type Row = {
      role: Workspace["role"];
      workspaces: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
    };
    const rows = ((data ?? []) as unknown as Row[])
      .map((r) => {
        const ws = Array.isArray(r.workspaces) ? r.workspaces[0] : r.workspaces;
        if (!ws) return null;
        return { id: ws.id, name: ws.name, slug: ws.slug, role: r.role } satisfies Workspace;
      })
      .filter((x): x is Workspace => !!x);

    if (rows.length === 0) return { workspaces: [], source: "demo-empty" };
    return { workspaces: rows, source: "supabase" };
  } catch (e) {
    return { workspaces: [], source: "error", error: e instanceof Error ? e.message : String(e) };
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
