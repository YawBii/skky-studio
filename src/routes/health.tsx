import { createFileRoute } from "@tanstack/react-router";
import { Activity, Github, Triangle, Database, Plus, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { useProjectConnections } from "@/hooks/use-project-connections";
import { useProviderAutoLink } from "@/hooks/use-provider-auto-link";
import { useEffect, useState } from "react";
import {
  ProjectScopedEmpty,
  ProjectSurfaceError,
  NoProjectSelected,
} from "@/components/project-empty";
import { AutoLinkPicker } from "@/components/auto-link-picker";
import { AutoLinkStatusBadge, summariseAutoLink } from "@/components/auto-link-status-badge";
import { AiProviderStatus } from "@/components/ai-provider-status";
import { scanProjectSecurityById } from "@/services/project-security";
import type { ProjectSecurityReport } from "@/lib/project-security-monitor";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Health — yawB" },
      {
        name: "description",
        content: "Project health: builds, dependencies, database, deployment and security.",
      },
    ],
  }),
  component: HealthPage,
});

function HealthPage() {
  const { project, projectIsReal, workspaceIsReal, workspace } = useSelectedProject();
  const { connections, isTableMissing, isError, error, sqlFile, loading, refresh } =
    useProjectConnections(project?.id ?? null);
  const [security, setSecurity] = useState<ProjectSecurityReport | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);

  const auto = useProviderAutoLink(project ?? null, workspace?.id ?? null, {
    enabled: projectIsReal && workspaceIsReal,
    autoRun: true,
  });

  useEffect(() => {
    if (auto.result && !auto.running) void refresh();
  }, [auto.result, auto.running, refresh]);

  useEffect(() => {
    let cancelled = false;
    if (!project?.id || !projectIsReal) return;
    setSecurityLoading(true);
    setSecurityError(null);
    scanProjectSecurityById(project.id)
      .then((result) => {
        if (cancelled) return;
        setSecurity(result.report);
        setSecurityError(result.error ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setSecurityError(err instanceof Error ? err.message : String(err));
        setSecurity(null);
      })
      .finally(() => {
        if (!cancelled) setSecurityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id, projectIsReal]);

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
        <Header project={project.name} status={status} onRefresh={() => auto.refresh({ toast: true })} />
        <div className="mb-6">
          <SecurityMonitorCard
            report={security}
            loading={securityLoading}
            error={securityError}
            onRefresh={() => {
              if (project?.id) {
                setSecurityLoading(true);
                void scanProjectSecurityById(project.id).then((r) => {
                  setSecurity(r.report);
                  setSecurityError(r.error ?? null);
                  setSecurityLoading(false);
                });
              }
            }}
          />
        </div>
        <div className="rounded-2xl border border-white/5 bg-gradient-card p-8">
          <Activity className="h-7 w-7 text-muted-foreground" />
          <h2 className="mt-3 font-display text-2xl font-semibold">
            {status === "no-match"
              ? `No exact repo/deployment match found for ${project.name}.`
              : "No health data yet"}
          </h2>
          {status === "no-match" ? (
            <div className="mt-2 text-[13px] text-muted-foreground space-y-1">
              <p>Auto-link checked GitHub and Vercel.</p>
              <p>This is safe: yawB did not link an unrelated project.</p>
              <p className="italic">
                This looks like a new yawB project. Build the first screen or link an existing repo.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-muted-foreground">
              Health checks run against your connected GitHub repo and Vercel deployments.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="hero" size="sm" asChild>
              <Link to="/builder/$projectId" params={{ projectId: project.id }}>
                Build this project
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/projects" search={{ tab: "import" } as never}>
                Import / link manually
              </Link>
            </Button>
            <Button variant="outline" size="sm" disabled={auto.running} onClick={() => void auto.refresh({ toast: true })}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${auto.running ? "animate-spin" : ""}`} />
              Refresh provider links
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-[1100px] mx-auto">
      <Header project={project.name} status={status} onRefresh={() => auto.refresh({ toast: true })} />

      {showPicker && auto.result && (
        <div className="mb-6">
          <AutoLinkPicker project={project} workspaceId={workspace?.id ?? null} github={auto.result.github} vercel={auto.result.vercel} onConfirmed={() => void refresh()} />
        </div>
      )}

      <div className="mb-6">
        <SecurityMonitorCard
          report={security}
          loading={securityLoading}
          error={securityError}
          onRefresh={() => {
            if (project?.id) {
              setSecurityLoading(true);
              void scanProjectSecurityById(project.id).then((r) => {
                setSecurity(r.report);
                setSecurityError(r.error ?? null);
                setSecurityLoading(false);
              });
            }
          }}
        />
      </div>

      <p className="text-muted-foreground mt-1 mb-6">
        {connections.length} connection{connections.length === 1 ? "" : "s"} · scans run when a build happens
      </p>

      <div className="grid sm:grid-cols-3 gap-4">
        <ProviderCheck label="GitHub" icon={Github} connected={hasGithub} />
        <ProviderCheck label="Vercel" icon={Triangle} connected={hasVercel} />
        <ProviderCheck label="Supabase" icon={Database} connected={true} note="Lovable Cloud" />
      </div>

      <div className="mt-6"><AiProviderStatus /></div>

      <div className="mt-6 rounded-2xl border border-white/5 bg-gradient-card p-5">
        <div className="text-[13px] font-medium">Diagnostic checks</div>
        <p className="text-[12px] text-muted-foreground mt-1">
          Build, provider, and security monitoring are shown for this project.
        </p>
        <Button variant="hero" size="sm" className="mt-4" asChild>
          <Link to="/connectors"><Plus className="h-3.5 w-3.5" /> Manage connections</Link>
        </Button>
      </div>
    </div>
  );
}

function SecurityMonitorCard({ report, loading, error, onRefresh }: { report: ProjectSecurityReport | null; loading: boolean; error: string | null; onRefresh: () => void }) {
  const critical = report?.summary.critical ?? 0;
  const warning = report?.summary.warning ?? 0;
  const statusLabel = loading ? "Scanning" : report?.status === "secure" ? "Secure" : report?.status === "critical" ? "Critical" : "Needs attention";
  const Icon = report?.status === "secure" ? ShieldCheck : ShieldAlert;
  return (
    <section className="rounded-2xl border border-white/5 bg-gradient-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white/[0.06] p-2"><Icon className="h-5 w-5 text-emerald-300" /></div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">yawB Security Monitor</div>
            <h2 className="mt-1 font-display text-2xl font-semibold">{statusLabel}</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {report ? `${report.filesScanned} file(s) scanned · score ${report.score}/100 · ${critical} critical · ${warning} warning` : "Scanning generated project files for secrets, XSS risks, insecure assets, and unsafe embeds."}
            </p>
            {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Rescan
        </Button>
      </div>
      {report && (
        <div className="mt-4 grid gap-2">
          {report.findings.slice(0, 5).map((finding) => (
            <div key={finding.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[12px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{finding.title}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{finding.severity}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{finding.detail}</p>
              <p className="mt-1 text-muted-foreground">Fix: {finding.recommendation}</p>
              {finding.files.length > 0 && <p className="mt-1 font-mono text-[10px] text-muted-foreground">{finding.files.join(", ")}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Header({ project, status, onRefresh }: { project: string; status: ReturnType<typeof summariseAutoLink>; onRefresh: () => void }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Health</div>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">{project}</h1>
        <div className="mt-2"><AutoLinkStatusBadge status={status} /></div>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh provider links</Button>
    </div>
  );
}

function ProviderCheck({ label, icon: Icon, connected, note }: { label: string; icon: React.ComponentType<{ className?: string }>; connected: boolean; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-5">
      <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span className="font-display font-semibold">{label}</span></div>
      <div className="mt-3 text-[12px]">{connected ? <span className="text-success">Connected{note ? ` · ${note}` : ""}</span> : <span className="text-muted-foreground">Not connected</span>}</div>
    </div>
  );
}
