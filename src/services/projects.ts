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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toProject(r: {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at?: string | null;
}): Project {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    createdAt: r.created_at ?? undefined,
  };
}

export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value);
}

function isDuplicateProjectSlug(error: { code?: string; message?: string; details?: string | null } | null | undefined) {
  if (!error) return false;
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return error.code === "23505" && (text.includes("projects_workspace_id_slug_key") || text.includes("workspace_id") || text.includes("slug"));
}

function withSlugSuffix(baseSlug: string, attempt: number): string {
  const clean = (baseSlug || "project").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "project";
  return attempt <= 1 ? clean : `${clean}-${attempt}`;
}

export async function listProjects(
  workspaceId: string | null | undefined,
): Promise<ProjectsResult> {
  if (!workspaceId) {
    setDiag({
      workspaceId: null,
      projectsCount: 0,
      projectsSource: "no-workspace",
      projectsQueryError: null,
    });
    return { projects: [], source: "no-workspace" };
  }
  if (!UUID_RE.test(workspaceId)) {
    console.info("[yawb] projects.list skipped — non-UUID workspaceId", { workspaceId });
    setDiag({
      workspaceId,
      projectsCount: 0,
      projectsSource: "no-workspace",
      projectsQueryError: null,
    });
    pushDiag("projects.skipped", { reason: "non-uuid-workspace", workspaceId });
    return { projects: [], source: "no-workspace" };
  }

  try {
    console.info("[yawb] projects.query", { workspaceId });
    const { data, error } = await supabase
      .from("projects")
      .select("id, workspace_id, name, slug, description, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[yawb] projects.list error", error);
      setDiag({
        workspaceId,
        projectsCount: 0,
        projectsSource: "error",
        projectsQueryError: error,
      });
      pushDiag("projects.query.error", {
        workspaceId,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return { projects: [], source: "error", error: error.message };
    }
    if (!data || data.length === 0) {
      setDiag({ workspaceId, projectsCount: 0, projectsSource: "empty", projectsQueryError: null });
      pushDiag("projects.query.empty", { workspaceId, count: 0 });
      return { projects: [], source: "empty" };
    }
    const projects = data.map(toProject);
    setDiag({
      workspaceId,
      projectsCount: projects.length,
      projectsSource: "supabase",
      projectsQueryError: null,
    });
    pushDiag("projects.loaded", {
      workspaceId,
      count: projects.length,
      projectIds: projects.map((p) => p.id),
    });
    console.info("[yawb] projects.loaded", { workspaceId, count: projects.length });
    return {
      projects,
      source: "supabase",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    setDiag({
      workspaceId,
      projectsCount: 0,
      projectsSource: "error",
      projectsQueryError: message,
    });
    pushDiag("projects.query.exception", { workspaceId, message });
    return { projects: [], source: "error", error: message };
  }
}

export async function getProjectById(
  projectId: string | null | undefined,
): Promise<{ project: Project | null; error?: string }> {
  if (!isUuid(projectId)) {
    pushDiag("project.byId.skipped", { reason: "non-uuid-project", projectId });
    return { project: null, error: "Project id is not a UUID." };
  }

  try {
    console.info("[yawb] project.byId.query", { projectId });
    const { data, error } = await supabase
      .from("projects")
      .select("id, workspace_id, name, slug, description, created_at")
      .eq("id", projectId)
      .maybeSingle();

    if (error) {
      setDiag({ projectId, projectSelectError: error, projectsQueryError: error });
      pushDiag("project.byId.error", {
        projectId,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return { project: null, error: error.message };
    }
    if (!data) {
      setDiag({ projectId, projectSelectError: "Project not found by route id" });
      pushDiag("project.byId.empty", { projectId });
      return { project: null };
    }
    const project = toProject(data);
    setDiag({ projectId: project.id, workspaceId: project.workspaceId, projectSelectError: null });
    pushDiag("project.selected", {
      source: "route-project-id",
      projectId: project.id,
      workspaceId: project.workspaceId,
    });
    console.info("[yawb] project.selected", {
      source: "route-project-id",
      projectId: project.id,
      workspaceId: project.workspaceId,
    });
    return { project };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    setDiag({ projectId, projectSelectError: message, projectsQueryError: message });
    pushDiag("project.byId.exception", { projectId, message });
    return { project: null, error: message };
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

    let insertedId: string | null = null;
    let finalSlug = input.slug;
    let lastDuplicate: unknown = null;

    for (let attempt = 1; attempt <= 25; attempt += 1) {
      finalSlug = withSlugSuffix(input.slug, attempt);
      const projectInsertPayload = {
        workspace_id: input.workspaceId,
        name: input.name,
        slug: finalSlug,
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

      if (!insertError) {
        insertedId = inserted?.id ?? null;
        break;
      }

      if (isDuplicateProjectSlug(insertError)) {
        lastDuplicate = insertError;
        log("project.slug.duplicate.retry", { slug: finalSlug, attempt, nextSlug: withSlugSuffix(input.slug, attempt + 1) });
        continue;
      }

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

    if (!insertedId) {
      setDiag({ projectInsertError: lastDuplicate });
      return {
        ok: false,
        error: `Project slug "${input.slug}" is already taken and automatic slug retry failed. Try a different project name.`,
        code: "DUPLICATE_SLUG",
      };
    }

    const { data: row, error: selectError } = await supabase
      .from("projects")
      .select("id, workspace_id, name, slug, description, created_at")
      .eq("id", insertedId)
      .maybeSingle();

    if (selectError || !row) {
      setDiag({ projectSelectError: selectError ?? { message: "no row returned" } });
      log("projectSelectError", selectError);
      return {
        ok: false,
        error: selectError?.message ?? "Project created but could not be read back (RLS).",
        code: selectError?.code,
        details: selectError?.details ?? undefined,
        hint:
          selectError?.hint ?? "Check RLS SELECT policy on public.projects for workspace members.",
      };
    }

    const project = toProject(row);
    log("project.create.success", { id: project.id, slug: project.slug, requestedSlug: input.slug });
    return { ok: true, project };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("project.create exception", msg);
    return { ok: false, error: msg, code: "EXCEPTION" };
  }
}
