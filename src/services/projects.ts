// Projects service — Supabase only. No demo fallback in the authenticated app.
import { supabase } from "@/integrations/supabase/client";

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

export async function listProjects(workspaceId: string | null | undefined): Promise<ProjectsResult> {
  if (!workspaceId) return { projects: [], source: "no-workspace" };

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
  };
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const hasSession = !!sessionData.session;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
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
    log("projectInsertPayload", projectInsertPayload);

    const { data: inserted, error: insertError } = await supabase
      .from("projects")
      .insert(projectInsertPayload)
      .select("id")
      .maybeSingle();

    if (insertError) {
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
