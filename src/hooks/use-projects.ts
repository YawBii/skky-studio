import { useEffect, useState, useCallback } from "react";
import { listProjects, type Project, type ProjectsResult } from "@/services/projects";

const LS_CURRENT_PREFIX = "yawb:current-project-id:";

function readCurrent(workspaceId: string | null | undefined): string | null {
  if (typeof window === "undefined" || !workspaceId) return null;
  try { return window.localStorage.getItem(LS_CURRENT_PREFIX + workspaceId); } catch { return null; }
}
function writeCurrent(workspaceId: string | null | undefined, id: string | null) {
  if (typeof window === "undefined" || !workspaceId) return;
  try {
    if (id) window.localStorage.setItem(LS_CURRENT_PREFIX + workspaceId, id);
    else window.localStorage.removeItem(LS_CURRENT_PREFIX + workspaceId);
  } catch {}
}

export function useProjects(workspaceId: string | null | undefined) {
  const [result, setResult] = useState<ProjectsResult>({ projects: [], source: "no-workspace" });
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(readCurrent(workspaceId));

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await listProjects(workspaceId ?? null);
    setResult(r);
    setLoading(false);
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.info("[yawb] projects source:", r.source, `count=${r.projects.length}`, r.error ?? "");
    }
    return r;
  }, [workspaceId]);

  useEffect(() => {
    setCurrentId(readCurrent(workspaceId));
    void refresh();
  }, [workspaceId, refresh]);

  useEffect(() => {
    if (loading) return;
    const ids = new Set(result.projects.map((p) => p.id));
    if (currentId && ids.has(currentId)) return;
    const next = result.projects[0]?.id ?? null;
    setCurrentId(next);
    writeCurrent(workspaceId, next);
  }, [loading, result.projects, currentId, workspaceId]);

  const select = useCallback((id: string) => {
    setCurrentId(id);
    writeCurrent(workspaceId, id);
  }, [workspaceId]);

  const current: Project | null =
    result.projects.find((p) => p.id === currentId) ?? result.projects[0] ?? null;

  return {
    projects: result.projects,
    current,
    source: result.source,
    error: result.error,
    isReal: result.source === "supabase",
    isEmpty: result.source === "empty",
    isError: result.source === "error",
    loading,
    select,
    refresh,
  };
}
