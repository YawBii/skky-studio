// project_files service — persistence layer for per-project generated artifacts.
// Backed by the `project_files` table (RLS scoped to project members).
//
// Used by:
//  - PreviewPane (Local Preview reads index.html via getProjectIndexHtml)
//  - The job runner step `ai.generate` (writes files via upsertProjectFiles)

import { supabase } from "@/integrations/supabase/client";
import { generateProjectFiles, type GeneratedFile } from "@/services/project-template";
import type { Project } from "@/services/projects";

export interface ProjectFile {
  id: string;
  projectId: string;
  path: string;
  content: string;
  language: string | null;
  kind: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListResult {
  files: ProjectFile[];
  error?: string;
  tableMissing?: boolean;
}

function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === "42P01") return true;
  return /relation .* does not exist|project_files/i.test(err.message ?? "");
}

export async function listProjectFiles(projectId: string): Promise<ListResult> {
  const { data, error } = await supabase
    .from("project_files")
    .select("id, project_id, path, content, language, kind, created_at, updated_at")
    .eq("project_id", projectId)
    .order("path", { ascending: true });
  if (error) {
    if (isMissingTable(error)) {
      return { files: [], tableMissing: true, error: error.message };
    }
    return { files: [], error: error.message };
  }
  return {
    files: (data ?? []).map((r) => ({
      id: r.id,
      projectId: r.project_id,
      path: r.path,
      content: r.content,
      language: r.language,
      kind: r.kind,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

export interface UpsertResult {
  ok: boolean;
  error?: string;
  tableMissing?: boolean;
}

export async function upsertProjectFile(
  projectId: string,
  path: string,
  content: string,
  language: string | null = null,
  kind: string = "source",
): Promise<UpsertResult> {
  const { error } = await supabase
    .from("project_files")
    .upsert(
      { project_id: projectId, path, content, language, kind },
      { onConflict: "project_id,path" },
    );
  if (error) {
    if (isMissingTable(error)) return { ok: false, tableMissing: true, error: error.message };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function upsertProjectFiles(
  projectId: string,
  files: GeneratedFile[],
): Promise<{ ok: boolean; written: string[]; error?: string; tableMissing?: boolean }> {
  const written: string[] = [];
  for (const f of files) {
    const r = await upsertProjectFile(projectId, f.path, f.content, f.language, f.kind);
    if (!r.ok) {
      return { ok: false, written, error: r.error, tableMissing: r.tableMissing };
    }
    written.push(f.path);
  }
  return { ok: true, written };
}

export async function getProjectIndexHtml(projectId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("project_files")
    .select("content")
    .eq("project_id", projectId)
    .eq("path", "index.html")
    .maybeSingle();
  if (error || !data) return null;
  return typeof data.content === "string" ? data.content : null;
}

/**
 * Generate fresh files (deterministic) and persist them. Used by the
 * `ai.generate` job step and as a fallback after `build.production`.
 */
export async function regenerateProjectFiles(input: {
  project: Pick<Project, "id" | "name" | "description">;
  chatRequest?: string | null;
}): Promise<{ ok: boolean; written: string[]; error?: string; tableMissing?: boolean }> {
  const files = generateProjectFiles(input);
  return upsertProjectFiles(input.project.id, files);
}
