import { createFileRoute } from "@tanstack/react-router";
import { Activity, Github, Triangle, Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { useProjectConnections } from "@/hooks/use-project-connections";
import { ProjectScopedEmpty, ProjectSurfaceError, NoProjectSelected } from "@/components/project-empty";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Health — yawB" },
      { name: "description", content: "Project health: builds, dependencies, database and deployment." },
    ],
  }),
  component: HealthPage,
});

function HealthPage() {
  const { project, projectIsReal, workspaceIsReal } = useSelectedProject();
  const { connections, isTableMissing, isError, error, sqlFile, loading } = useProjectConnections(project?.id ?? null);

  if (!workspaceIsReal || !projectIsReal || !project) {
    return <NoProjectSelected hint="Health is computed for the currently selected real project." />;
  }
  if (isError) return <ProjectSurfaceError message={error} />;
  if (isTableMissing) return <ProjectSurfaceError message="project_connections table missing" sqlFile={sqlFile} />;

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  const hasGithub = connections.some((c) => c.provider === "github" && c.status === "connected");
  const hasVercel = connections.some((c) => c.provider === "vercel" && c.status === "connected");

  if (connections.length === 0) {
    return (
      <ProjectScopedEmpty
        icon={Activity}
        eyebrow={project.name}
        title="No health data yet"
        hint="Health checks run against your connected GitHub repo and Vercel deployments. Connect at least one provider to start scanning."
        cta={{ label: "Open Integrations", to: "/connectors" }}
      />
    );
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-[1100px] mx-auto">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Health</div>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">{project.name}</h1>
        <p className="text-muted-foreground mt-1">{connections.length} connection{connections.length === 1 ? "" : "s"} · scans run when a build happens</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <ProviderCheck label="GitHub" icon={Github} connected={hasGithub} />
        <ProviderCheck label="Vercel" icon={Triangle} connected={hasVercel} />
        <ProviderCheck label="Supabase" icon={Database} connected={true} note="Lovable Cloud" />
      </div>

      <div className="mt-6 rounded-2xl border border-white/5 bg-gradient-card p-5">
        <div className="text-[13px] font-medium">Diagnostic checks</div>
        <p className="text-[12px] text-muted-foreground mt-1">No build has run for this project yet. The first deploy will populate the health report.</p>
        <Button variant="hero" size="sm" className="mt-4" asChild>
          <Link to="/connectors"><Plus className="h-3.5 w-3.5" /> Manage connections</Link>
        </Button>
      </div>
    </div>
  );
}

function ProviderCheck({ label, icon: Icon, connected, note }: { label: string; icon: React.ComponentType<{ className?: string }>; connected: boolean; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-display font-semibold">{label}</span>
      </div>
      <div className="mt-3 text-[12px]">
        {connected
          ? <span className="text-success">Connected{note ? ` · ${note}` : ""}</span>
          : <span className="text-muted-foreground">Not connected</span>}
      </div>
    </div>
  );
}
