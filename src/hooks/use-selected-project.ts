// Shared accessor for the currently selected workspace + project.
// Data is provided by WorkspaceShell so nested routes do not refetch
// workspaces/projects independently.
import { createContext, useContext } from "react";
import type { Project, ProjectsResult } from "@/services/projects";
import type { Workspace } from "@/services/workspaces";

export interface SelectedProjectState {
  workspace: Workspace | null;
  workspaceIsReal: boolean;
  workspaceLoading: boolean;
  project: Project | null;
  projects: Project[];
  projectIsReal: boolean;
  projectsEmpty: boolean;
  projectsError: boolean;
  projectsLoading: boolean;
  projectsSource: ProjectsResult["source"];
  refreshProjects: () => Promise<ProjectsResult>;
  selectProject: (id: string) => void;
}

const empty: SelectedProjectState = {
  workspace: null,
  workspaceIsReal: false,
  workspaceLoading: false,
  project: null,
  projects: [],
  projectIsReal: false,
  projectsEmpty: true,
  projectsError: false,
  projectsLoading: false,
  projectsSource: "no-workspace",
  refreshProjects: async () => ({ projects: [], source: "no-workspace" }),
  selectProject: () => {},
};

const SelectedProjectContext = createContext<SelectedProjectState | null>(null);

export function SelectedProjectProvider({
  value,
  children,
}: {
  value: SelectedProjectState;
  children: React.ReactNode;
}) {
  return <SelectedProjectContext.Provider value={value}>{children}</SelectedProjectContext.Provider>;
}

export function useSelectedProject() {
  return useContext(SelectedProjectContext) ?? empty;
}
