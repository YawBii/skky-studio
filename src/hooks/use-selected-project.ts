// Shared accessor for the currently selected workspace + project.
// Single source of truth for routes that need the selected project.
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useProjects } from "@/hooks/use-projects";

export function useSelectedProject() {
  const ws = useWorkspaces();
  const projects = useProjects(ws.current?.id);
  return {
    workspace: ws.current,
    workspaceIsReal: ws.isReal,
    workspaceLoading: ws.loading,
    project: projects.current,
    projects: projects.projects,
    projectIsReal: projects.isReal,
    projectsEmpty: projects.isEmpty,
    projectsError: projects.isError,
    projectsLoading: projects.loading,
    projectsSource: projects.source,
    refreshProjects: projects.refresh,
    selectProject: projects.select,
  };
}
