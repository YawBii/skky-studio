// Projects service: reads from Supabase `projects`.
// Falls back to demo projects when the workspace is the demo one, the table is
// unavailable, or the query fails.
import { supabase } from "@/integrations/supabase/client";
import { projects as DEMO_PROJECTS, type Project as DemoProject } from "@/lib/demo-data";

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt?: string;
  isDemo?: boolean;
}

export type ProjectsResult = {
  projects: Project[];
  source: "supabase" | "demo-fallback" | "demo-empty";
};

function demoToProject(p: DemoProject, workspaceId: string): Project {
  return {
    id: p.id,
    workspaceId,
    name: p.name,
    slug: p.id,
    description: p.description,
    isDemo: true,
  };
}

export async function listProjects(workspaceId: string | null | undefined): Promise<ProjectsResult> {
  if (!workspaceId || workspaceId === "demo-workspace") {
    return {
      projects: DEMO_PROJECTS.map((p) => demoToProject(p, workspaceId ?? "demo-workspace")),
      source: "demo-fallback",
    };
  }

  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id, workspace_id, name, slug, description, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      return {
        projects: DEMO_PROJECTS.map((p) => demoToProject(p, workspaceId)),
        source: "demo-fallback",
      };
    }
    if (!data || data.length === 0) {
      return { projects: [], source: "demo-empty" };
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
  } catch {
    return {
      projects: DEMO_PROJECTS.map((p) => demoToProject(p, workspaceId)),
      source: "demo-fallback",
    };
  }
}

export async function createProject(input: {
  workspaceId: string;
  name: string;
  slug: string;
  description?: string;
}): Promise<Project | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return null;
    const { data, error } = await supabase
      .from("projects")
      .insert({
        workspace_id: input.workspaceId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        created_by: uid,
      })
      .select("id, workspace_id, name, slug, description, created_at")
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      createdAt: data.created_at,
    };
  } catch {
    return null;
  }
}
