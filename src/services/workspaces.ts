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

export type CreateWorkspaceResult =
  | { ok: true; workspace: Workspace }
  | { ok: false; error: string; code?: string; details?: string; hint?: string };

export async function createWorkspace(input: { name: string; slug: string }): Promise<CreateWorkspaceResult> {
  let uid: string | undefined;
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      console.error("[yawb] createWorkspace getUser error:", userErr);
      return { ok: false, error: `Auth error: ${userErr.message}` };
    }
    uid = userData.user?.id;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Auth call failed" };
  }
  if (!uid) {
    console.warn("[yawb] createWorkspace: no session");
    return { ok: false, error: "Not signed in. Please sign in and try again." };
  }

  const payload = { name: input.name, slug: input.slug, created_by: uid };
  console.info("[yawb] createWorkspace payload:", { hasSession: true, userId: uid, name: payload.name, slug: payload.slug });

  // Step 1: insert (do NOT chain .select() — RLS may block reading back before
  // the owner row is seeded by trg_workspace_seed_owner).
  const { error: insertError } = await supabase.from("workspaces").insert(payload);
  if (insertError) {
    console.error("[yawb] workspaceInsertError:", {
      message: insertError.message,
      code: insertError.code,
      details: insertError.details,
      hint: insertError.hint,
    });
    return {
      ok: false,
      error: insertError.message,
      code: insertError.code,
      details: insertError.details ?? undefined,
      hint: insertError.hint ?? undefined,
    };
  }

  // Step 2: select the workspace via the membership we now own.
  const { data: rows, error: selectError } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("slug", input.slug)
    .eq("created_by", uid)
    .order("created_at", { ascending: false })
    .limit(1);

  if (selectError) {
    console.error("[yawb] workspaceSelectError:", {
      message: selectError.message,
      code: selectError.code,
      details: selectError.details,
      hint: selectError.hint,
    });
    return {
      ok: false,
      error: `Workspace created but read-back failed: ${selectError.message}`,
      code: selectError.code,
      details: selectError.details ?? undefined,
      hint: selectError.hint ?? undefined,
    };
  }
  const ws = rows?.[0];
  if (!ws) {
    return { ok: false, error: "Workspace created but not visible — check RLS / trg_workspace_seed_owner trigger." };
  }
  return { ok: true, workspace: { id: ws.id, name: ws.name, slug: ws.slug, role: "owner" } };
}
