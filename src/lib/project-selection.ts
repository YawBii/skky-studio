import type { Project } from "@/services/projects";

export const CURRENT_WORKSPACE_KEY = "yawb:current-workspace-id";
export const CURRENT_PROJECT_PREFIX = "yawb:current-project-id:";
const DIRECT_WORKSPACE_KEY = "yawb:direct-workspace";
const DIRECT_PROJECT_KEY = "yawb:direct-project";

export type DirectWorkspace = { id: string; name: string; slug: string };

export function readCurrentWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(CURRENT_WORKSPACE_KEY); } catch { return null; }
}

export function writeCurrentWorkspaceId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(CURRENT_WORKSPACE_KEY, id);
    else window.localStorage.removeItem(CURRENT_WORKSPACE_KEY);
    window.dispatchEvent(new CustomEvent("yawb:selection-changed", { detail: { workspaceId: id } }));
  } catch { /* ignore */ }
}

export function readCurrentProjectId(workspaceId: string | null | undefined): string | null {
  if (typeof window === "undefined" || !workspaceId) return null;
  try { return window.localStorage.getItem(CURRENT_PROJECT_PREFIX + workspaceId); } catch { return null; }
}

export function writeCurrentProjectId(workspaceId: string | null | undefined, id: string | null) {
  if (typeof window === "undefined" || !workspaceId) return;
  try {
    if (id) window.localStorage.setItem(CURRENT_PROJECT_PREFIX + workspaceId, id);
    else window.localStorage.removeItem(CURRENT_PROJECT_PREFIX + workspaceId);
    window.dispatchEvent(new CustomEvent("yawb:selection-changed", { detail: { workspaceId, projectId: id } }));
  } catch { /* ignore */ }
}

export function readDirectWorkspace(): DirectWorkspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DIRECT_WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DirectWorkspace;
    return parsed?.id ? parsed : null;
  } catch { return null; }
}

export function readDirectProject(): Project | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DIRECT_PROJECT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Project;
    return parsed?.id && parsed?.workspaceId ? parsed : null;
  } catch { return null; }
}

export function rememberDirectProject(project: Project) {
  if (typeof window === "undefined") return;
  const workspace: DirectWorkspace = {
    id: project.workspaceId,
    name: "Current workspace",
    slug: "current-workspace",
  };
  try {
    window.localStorage.setItem(DIRECT_WORKSPACE_KEY, JSON.stringify(workspace));
    window.localStorage.setItem(DIRECT_PROJECT_KEY, JSON.stringify(project));
  } catch { /* ignore */ }
  writeCurrentWorkspaceId(project.workspaceId);
  writeCurrentProjectId(project.workspaceId, project.id);
  window.dispatchEvent(new CustomEvent("yawb:project-bootstrap", { detail: { project } }));
}