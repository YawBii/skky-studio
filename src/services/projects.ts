// Projects service — Supabase only. No demo fallback in the authenticated app.
import { supabase } from "@/integrations/supabase/client";
import { setDiag, pushDiag } from "@/lib/diagnostics";

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt?: string;
}

export type ProjectsSource = "supabase" | "empty" | "error" | "no-workspace";

export type ProjectsResult = {
  projects: Project[];
  source: ProjectsSource;
  error?: string;
};

// Match the canonical 8-4-4-4-12 hex form. Anything else (e.g. the synthetic
// "demo-workspace" id used when signed-out) would cause Postgres to throw
// 22P02 "invalid input syntax for type uuid" — surfacing as a 400 in the
// console and breaking project loading on mobile, where the user has no
// other obvious way to recover. Treat non-UUID workspace ids as "no-workspace"
// so the empty state renders cleanly instead.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listProjects(workspaceId: string | null | undefined): Promise<ProjectsResult> {
  if (!workspaceId) return { projects: [], source: "no-workspace" };
  if (!UUID_RE.test(workspaceId)) {
    // eslint-disable-next-line no-console
    console.info("[yawb] projects.list skipped — non-UUID workspaceId", { workspaceId });
    return { projects: [], source: "no-workspace" };
  }

  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id, workspace_id, name, slug, description, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[yawb] projects.list error", error);
      return { projects: [], source: "error", error: error.message };
    }
    if (!data || data.length === 0) {
      return { projects: [], source: "empty" };
    }
    return {
      projects: data.map((r) => ({
        id: r.id,
        workspaceId: r.workspace_id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        createdAt: r.created_at,
      })),
      source: "supabase",
    };
  } catch (e) {
    return { projects: [], source: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

export type CreateProjectResult =
  | { ok: true; project: Project }
  | { ok: false; error: string; code?: string; details?: string; hint?: string };

export async function createProject(input: {
  workspaceId: string;
  name: string;
  slug: string;
  description?: string;
}): Promise<CreateProjectResult> {
  const log = (label: string, payload: unknown) => {
    // eslint-disable-next-line no-console
    console.info(`[yawb] ${label}`, payload);
    pushDiag(label, payload);
  };
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const hasSession = !!sessionData.session;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    setDiag({ hasSession, userId: uid ?? null, workspaceId: input.workspaceId });
    log("project.create diagnostics", { hasSession, userId: uid, workspaceId: input.workspaceId });

    if (!uid) {
      return { ok: false, error: "You must be signed in to create a project.", code: "NO_SESSION" };
    }

    const projectInsertPayload = {
      workspace_id: input.workspaceId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      created_by: uid,
    };
    setDiag({ projectInsertPayload, projectInsertError: null, projectSelectError: null });
    log("projectInsertPayload", projectInsertPayload);

    const { data: inserted, error: insertError } = await supabase
      .from("projects")
      .insert(projectInsertPayload)
      .select("id")
      .maybeSingle();

    if (insertError) {
      setDiag({ projectInsertError: insertError });
      log("projectInsertError", insertError);
      return {
        ok: false,
        error: insertError.message,
        code: insertError.code,
        details: insertError.details ?? undefined,
        hint: insertError.hint ?? undefined,
      };
    }

    const projectId = inserted?.id;
    if (!projectId) {
      return { ok: false, error: "Project insert returned no id.", code: "NO_ID" };
    }

    const { data: row, error: selectError } = await supabase
      .from("projects")
      .select("id, workspace_id, name, slug, description, created_at")
      .eq("id", projectId)
      .maybeSingle();

    if (selectError || !row) {
      setDiag({ projectSelectError: selectError ?? { message: "no row returned" } });
      log("projectSelectError", selectError);
      return {
        ok: false,
        error: selectError?.message ?? "Project created but could not be read back (RLS).",
        code: selectError?.code,
        details: selectError?.details ?? undefined,
        hint: selectError?.hint ?? "Check RLS SELECT policy on public.projects for workspace members.",
      };
    }

    return {
      ok: true,
      project: {
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        createdAt: row.created_at,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("project.create exception", msg);
    return { ok: false, error: msg, code: "EXCEPTION" };
  }
}
