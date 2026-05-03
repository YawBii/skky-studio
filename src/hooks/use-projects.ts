import { useEffect, useState, useCallback } from "react";
import { listProjects, type Project, type ProjectsResult } from "@/services/projects";
import { setDiag } from "@/lib/diagnostics";
import {
  readCurrentProjectId,
  readDirectProject,
  writeCurrentProjectId,
} from "@/lib/project-selection";

export function useProjects(workspaceId: string | null | undefined) {
  const [result, setResult] = useState<ProjectsResult>({ projects: [], source: "no-workspace" });
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(readCurrentProjectId(workspaceId));

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await listProjects(workspaceId ?? null);
    const direct = readDirectProject();
    const canUseDirect = r.source !== "supabase";
    const shouldInjectDirect =
      canUseDirect &&
      direct &&
      direct.workspaceId === workspaceId &&
      !r.projects.some((p) => p.id === direct.id);
    const next = shouldInjectDirect
      ? { projects: [direct, ...r.projects], source: "supabase" as const }
      : r;
    setResult(next);
    setLoading(false);
    setDiag({
      workspaceId: workspaceId ?? null,
      projectsCount: next.projects.length,
      projectsSource: next.source,
    });
    if (typeof window !== "undefined") {
      console.info(
        "[yawb] projects source:",
        next.source,
        `count=${next.projects.length}`,
        r.error ?? "",
      );
    }
    return next;
  }, [workspaceId]);

  useEffect(() => {
    setCurrentId(readCurrentProjectId(workspaceId));
    void refresh();
  }, [workspaceId, refresh]);

  useEffect(() => {
    const onBootstrap = (e: Event) => {
      const project = (e as CustomEvent<{ project?: Project }>).detail?.project;
      if (!project || project.workspaceId !== workspaceId) return;
      setResult((prev) => {
        const exists = prev.projects.some((p) => p.id === project.id);
        const projects = exists
          ? prev.projects.map((p) => (p.id === project.id ? project : p))
          : [project, ...prev.projects];
        return { projects, source: "supabase" };
      });
      setCurrentId(project.id);
      setLoading(false);
      setDiag({
        workspaceId: project.workspaceId,
        projectId: project.id,
        projectsCount: 1,
        projectsSource: "supabase",
      });
    };
    window.addEventListener("yawb:project-bootstrap", onBootstrap as EventListener);
    return () => window.removeEventListener("yawb:project-bootstrap", onBootstrap as EventListener);
  }, [workspaceId]);

  useEffect(() => {
    const onSelectionChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ workspaceId?: string | null; projectId?: string | null }>).detail;
      if (detail?.workspaceId && detail.workspaceId !== workspaceId) return;
      if (detail?.projectId) setCurrentId(detail.projectId);
      void refresh();
    };
    window.addEventListener("yawb:selection-changed", onSelectionChanged as EventListener);
    return () => window.removeEventListener("yawb:selection-changed", onSelectionChanged as EventListener);
  }, [workspaceId, refresh]);

  useEffect(() => {
    if (loading) return;
    const ids = new Set(result.projects.map((p) => p.id));
    if (currentId && ids.has(currentId)) return;
    const next = result.projects[0]?.id ?? null;
    setCurrentId(next);
    writeCurrentProjectId(workspaceId, next);
  }, [loading, result.projects, currentId, workspaceId]);

  const select = useCallback(
    (id: string) => {
      setCurrentId(id);
      writeCurrentProjectId(workspaceId, id);
    },
    [workspaceId],
  );

  const inject = useCallback((project: Project) => {
    setResult((prev) => {
      const exists = prev.projects.some((p) => p.id === project.id);
      const projects = exists
        ? prev.projects.map((p) => (p.id === project.id ? project : p))
        : [project, ...prev.projects];
      setDiag({
        workspaceId: project.workspaceId,
        projectId: project.id,
        projectsCount: projects.length,
        projectsSource: prev.source === "supabase" ? "supabase" : "supabase",
      });
      return { projects, source: "supabase" };
    });
    setCurrentId(project.id);
    writeCurrentProjectId(project.workspaceId, project.id);
  }, []);

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
    inject,
    refresh,
  };
}
