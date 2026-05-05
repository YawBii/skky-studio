import { createFileRoute } from "@tanstack/react-router";
import { Activity, Github, Triangle, Database, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { useProjectConnections } from "@/hooks/use-project-connections";
import { useProviderAutoLink } from "@/hooks/use-provider-auto-link";
import { useEffect } from "react";
import {
  ProjectScopedEmpty,
  ProjectSurfaceError,
  NoProjectSelected,
} from "@/components/project-empty";
import { AutoLinkPicker } from "@/components/auto-link-picker";
import { AutoLinkStatusBadge, summariseAutoLink } from "@/components/auto-link-status-badge";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Health — yawB" },
      {
        name: "description",
        content: "Project health: builds, dependencies, database and deployment.",
      },
    ],
  }),
  component: HealthPage,
});

function HealthPage() {
  const { project, projectIsReal, workspaceIsReal, workspace } = useSelectedProject();
  const { connections, isTableMissing, isError, error, sqlFile, loading, refresh } =
    useProjectConnections(project?.id ?? null);

  const auto = useProviderAutoLink(project ?? null, workspace?.id ?? null, {
    enabled: projectIsReal && workspaceIsReal,
    autoRun: true,
  });

  // After a successful auto-link / picker confirm, re-read connections.
  useEffect(() => {
    if (auto.result && !auto.running) void refresh();
  }, [auto.result, auto.running, refresh]);

  if (!workspaceIsReal || !projectIsReal || !project) {
    return <NoProjectSelected hint="Health is computed for the currently selected real project." />;
  }
  if (isError) return <ProjectSurfaceError message={error} />;
  if (isTableMissing)
    return <ProjectSurfaceError message="project_connections table missing" sqlFile={sqlFile} />;

  if (loading || auto.running)
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  const hasGithub = connections.some((c) => c.provider === "github" && c.status === "connected");
  const hasVercel = connections.some((c) => c.provider === "vercel" && c.status === "connected");
  const status = summariseAutoLink(auto.result);
  const showPicker =
    auto.result &&
    (auto.result.github.outcome === "ambiguous" || auto.result.vercel.outcome === "ambiguous");

  if (connections.length === 0 && status !== "needs-confirmation") {
    return (
      <div className="px-6 md:px-10 py-10 max-w-[1100px] mx-auto">
        <Header
          project={project.name}
          status={status}
          onRefresh={() => auto.refresh({ toast: true })}
        />
        <ProjectScopedEmpty
          icon={Activity}
          eyebrow={project.name}
          title={
            status === "no-match" ? "No matching provider resource found" : "No health data yet"
          }
          hint={
            status === "no-match"
              ? "yawB checked your connected GitHub and Vercel accounts but couldn't find an obvious match for this project. Import the matching repo or pick a Vercel project manually."
              : "Health checks run against your connected GitHub repo and Vercel deployments. Connect at least one provider to start scanning."
          }
          cta={{ label: "Open Integrations", to: "/connectors" }}
        />
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-[1100px] mx-auto">
      <Header
        project={project.name}
        status={status}
        onRefresh={() => auto.refresh({ toast: true })}
      />

      {showPicker && auto.result && (
        <div className="mb-6">
          <AutoLinkPicker
            project={project}
            workspaceId={workspace?.id ?? null}
            github={auto.result.github}
            vercel={auto.result.vercel}
            onConfirmed={() => void refresh()}
          />
        </div>
      )}

      <p className="text-muted-foreground mt-1 mb-6">
        {connections.length} connection{connections.length === 1 ? "" : "s"} · scans run when a
        build happens
      </p>

      <div className="grid sm:grid-cols-3 gap-4">
        <ProviderCheck label="GitHub" icon={Github} connected={hasGithub} />
        <ProviderCheck label="Vercel" icon={Triangle} connected={hasVercel} />
        <ProviderCheck label="Supabase" icon={Database} connected={true} note="Lovable Cloud" />
      </div>

      <div className="mt-6 rounded-2xl border border-white/5 bg-gradient-card p-5">
        <div className="text-[13px] font-medium">Diagnostic checks</div>
        <p className="text-[12px] text-muted-foreground mt-1">
          No build has run for this project yet. The first deploy will populate the health report.
        </p>
        <Button variant="hero" size="sm" className="mt-4" asChild>
          <Link to="/connectors">
            <Plus className="h-3.5 w-3.5" /> Manage connections
          </Link>
        </Button>
      </div>

      {auto.result && (
        <details className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11.5px] text-muted-foreground">
          <summary className="cursor-pointer select-none">Auto-link proof log</summary>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
            {auto.result.proof.join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}

function Header({
  project,
  status,
  onRefresh,
}: {
  project: string;
  status: ReturnType<typeof summariseAutoLink>;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Health</div>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">{project}</h1>
        <div className="mt-2">
          <AutoLinkStatusBadge status={status} />
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh provider links
      </Button>
    </div>
  );
}

function ProviderCheck({
  label,
  icon: Icon,
  connected,
  note,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  connected: boolean;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-display font-semibold">{label}</span>
      </div>
      <div className="mt-3 text-[12px]">
        {connected ? (
          <span className="text-success">Connected{note ? ` · ${note}` : ""}</span>
        ) : (
          <span className="text-muted-foreground">Not connected</span>
        )}
      </div>
    </div>
  );
}
