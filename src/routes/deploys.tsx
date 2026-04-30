import { createFileRoute, Link } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { useProjectConnections } from "@/hooks/use-project-connections";
import { ProjectScopedEmpty, ProjectSurfaceError, NoProjectSelected } from "@/components/project-empty";

export const Route = createFileRoute("/deploys")({
  head: () => ({
    meta: [
      { title: "Deploys — yawB" },
      { name: "description", content: "Deploy logs and history for the selected project." },
    ],
  }),
  component: DeploysPage,
});

function DeploysPage() {
  const { project, projectIsReal, workspaceIsReal } = useSelectedProject();
  const { connections, isError, error, isTableMissing, sqlFile, loading } = useProjectConnections(project?.id ?? null);

  if (!workspaceIsReal || !projectIsReal || !project) return <NoProjectSelected />;
  if (isError) return <ProjectSurfaceError message={error} />;
  if (isTableMissing) return <ProjectSurfaceError message="project_connections table missing" sqlFile={sqlFile} />;
  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  const vercel = connections.find((c) => c.provider === "vercel" && c.status === "connected");
  if (!vercel) {
    return (
      <ProjectScopedEmpty
        icon={Rocket}
        eyebrow={project.name}
        title="No deploys yet"
        hint="Connect Vercel for this project to see real deploy logs and history."
        cta={{ label: "Open Integrations", to: "/connectors" }}
      />
    );
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-[1100px] mx-auto">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Deploys</div>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">{project.name}</h1>
        <p className="text-muted-foreground mt-1">Connected to Vercel · {vercel.repoFullName ?? "no repo metadata"}</p>
      </div>
      <div className="rounded-2xl border border-white/5 bg-gradient-card p-6 text-[13px] text-muted-foreground">
        Live deploy log streaming connects in the next pass. Diagnostics are written to the browser console under <code className="font-mono text-foreground/80">[yawb] selection</code>.
        <div className="mt-4">
          <Link to="/connectors" className="text-primary text-[12px]">Manage Vercel connection →</Link>
        </div>
      </div>
    </div>
  );
}
