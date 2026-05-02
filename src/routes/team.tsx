import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { ProjectScopedEmpty } from "@/components/project-empty";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — yawB" },
      { name: "description", content: "Workspace members and invitations." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { current, isReal } = useWorkspaces();
  if (!isReal || !current) {
    return (
      <ProjectScopedEmpty
        icon={Users}
        eyebrow="Team"
        title="Create a workspace first"
        hint="Team members live inside a workspace."
        cta={{ label: "Go home", to: "/" }}
      />
    );
  }
  return (
    <ProjectScopedEmpty
      icon={Users}
      eyebrow={current.name}
      title="Member management not connected yet"
      hint="Real workspace_members + invitations table read/write wires in the next pass. Use the Share button in the top bar to send invites."
    />
  );
}
