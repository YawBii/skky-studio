import { createFileRoute } from "@tanstack/react-router";
import { Database } from "lucide-react";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { ProjectScopedEmpty, NoProjectSelected } from "@/components/project-empty";

export const Route = createFileRoute("/cloud")({
  head: () => ({
    meta: [
      { title: "Cloud — yawB" },
      { name: "description", content: "Database, auth, storage, secrets, functions and logs." },
    ],
  }),
  component: CloudPage,
});

function CloudPage() {
  const { project, projectIsReal, workspaceIsReal } = useSelectedProject();
  if (!workspaceIsReal || !projectIsReal || !project) {
    return (
      <NoProjectSelected hint="Cloud database, auth and storage are scoped to the selected project." />
    );
  }
  return (
    <ProjectScopedEmpty
      icon={Database}
      eyebrow={project.name}
      title="Cloud admin not connected yet"
      hint="Live Database, Auth users, Storage, Secrets, Functions and Logs read/write through Lovable Cloud admin wires in the next pass. No mock numbers will be shown."
    />
  );
}
