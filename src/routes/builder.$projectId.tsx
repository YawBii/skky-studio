import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  Eye, Code2, Database, Rocket, RefreshCw, Monitor, Tablet, Smartphone,
  ExternalLink, CheckCircle2, Play, History as HistoryIcon, GitCommit,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { projects } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/builder/$projectId")({
  head: ({ params }) => ({
    meta: [
      { title: `Builder — ${params.projectId} | yawB` },
      { name: "description", content: "Preview, code, database, deploy and history — all in one workspace." },
    ],
  }),
  loader: ({ params }) => {
    const project = projects.find((p) => p.id === params.projectId);
    if (!project) throw notFound();
    return { project };
  },
  errorComponent: ({ error }) => <div className="p-10">Error: {error.message}</div>,
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-display font-bold">Project not found</h1>
      <Link to="/" className="text-primary text-sm mt-3 inline-block">← Back to dashboard</Link>
    </div>
  ),
  component: Builder,
});

type Tab = "preview" | "code" | "database" | "deploy" | "history";
type Device = "desktop" | "tablet" | "mobile";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "preview",  label: "Preview",  icon: Eye },
  { id: "code",     label: "Code",     icon: Code2 },
  { id: "database", label: "Database", icon: Database },
  { id: "deploy",   label: "Deploy",   icon: Rocket },
  { id: "history",  label: "History",  icon: HistoryIcon },
];

function Builder() {
  const { project } = Route.useLoaderData() as { project: typeof projects[number] };
  const [tab, setTab] = useState<Tab>("preview");
  const [device, setDevice] = useState<Device>("desktop");

  return (
    <div className="flex flex-col h-full">
      {/* Tab strip with project context */}
      <div className="h-11 border-b border-white/5 px-4 flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display font-semibold text-[13px] truncate max-w-[180px]">{project.name}</span>
          <StatusBadge status={project.status} />
        </div>
        <div className="h-4 w-px bg-white/5" />
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 h-8 px-3 rounded-lg text-[12.5px] transition",
                tab === t.id
                  ? "bg-white/[0.07] text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "preview"  && <PreviewPane device={device} setDevice={setDevice} project={project} />}
        {tab === "code"     && <CodePane />}
        {tab === "database" && <DatabasePane />}
        {tab === "deploy"   && <DeployPane />}
        {tab === "history"  && <HistoryPane />}
      </div>
    </div>
  );
}

function PreviewPane({
  device, setDevice, project,
}: { device: Device; setDevice: (d: Device) => void; project: typeof projects[number] }) {
  const widths: Record<Device, string> = { desktop: "100%", tablet: "820px", mobile: "390px" };
  return (
    <div className="h-full flex flex-col">
      <div className="h-11 border-b border-white/5 px-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast("Refreshing…")}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1 mx-2 h-7 rounded-md bg-white/[0.04] border border-white/5 px-2.5 flex items-center text-[11.5px] text-muted-foreground gap-2 font-mono">
          <ExternalLink className="h-3 w-3" /> https://{project.url}
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
          {([
            { k: "desktop", I: Monitor },
            { k: "tablet",  I: Tablet  },
            { k: "mobile",  I: Smartphone },
          ] as const).map(({ k, I }) => (
            <button
              key={k}
              onClick={() => setDevice(k)}
              className={cn(
                "h-6 w-6 rounded grid place-items-center transition",
                device === k ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <I className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-8 grid place-items-start justify-center bg-[oklch(0.13_0_0)]">
        <div style={{ width: widths[device] }} className="transition-all w-full max-w-full">
          <div className="rounded-2xl border border-white/10 bg-gradient-card shadow-elevated aspect-[16/10] overflow-hidden">
            <div className="h-full flex flex-col items-center justify-center text-center p-10">
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">Live preview</div>
              <h2 className="mt-3 text-3xl md:text-4xl font-display font-bold tracking-tight text-balance">
                {project.name}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-md text-pretty">
                Latest build is live and verified.
              </p>
              <Button variant="hero" className="mt-5">
                <Play className="h-3.5 w-3.5" /> Explore
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CodePane() {
  return (
    <div className="h-full grid place-items-center text-center px-6">
      <div className="max-w-sm">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">Coming next</div>
        <h2 className="mt-2 text-2xl font-display font-semibold tracking-tight">Code editor</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">In-app code editing arrives next. For now, ask yawB in the chat to make changes.</p>
      </div>
    </div>
  );
}

function DatabasePane() {
  const tables = [
    { name: "users", rows: 1284, rls: true },
    { name: "organizations", rows: 42, rls: true },
    { name: "subscriptions", rows: 38, rls: true },
    { name: "audit_logs", rows: 9214, rls: false },
  ];
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-[20px] font-display font-semibold tracking-tight">Database</h2>
        <p className="text-[12.5px] text-muted-foreground mt-1">Supabase · {tables.length} tables</p>
        <div className="mt-6 rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
          {tables.map((t, i) => (
            <div key={t.name} className={cn("flex items-center justify-between px-4 py-3", i < tables.length - 1 && "border-b border-white/5")}>
              <div className="font-mono text-xs">{t.name}</div>
              <div className="text-xs text-muted-foreground tabular-nums">{t.rows.toLocaleString()} rows</div>
              <div className="text-xs">{t.rls ? <span className="text-success">RLS on</span> : <span className="text-warning">RLS off</span>}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeployPane() {
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-[20px] font-display font-semibold tracking-tight">Deploy</h2>
        <p className="text-[12.5px] text-muted-foreground mt-1">Promote the latest verified build to production.</p>
        <div className="mt-6 rounded-2xl border border-white/5 bg-gradient-card p-5 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-[13.5px] font-medium">Production · main · a4f2c91</span>
            </div>
            <div className="text-[11.5px] text-muted-foreground mt-1">Last deploy 2h ago</div>
          </div>
          <Button variant="hero" size="sm" onClick={() => toast.success("Deploy queued")}>
            <Rocket className="h-3.5 w-3.5" /> Publish
          </Button>
        </div>
      </div>
    </div>
  );
}

function HistoryPane() {
  const versions = [
    { sha: "a4f2c91", msg: "Promote build #248 to production",     who: "Yaw",         when: "2h ago",  live: true },
    { sha: "9d1e7b3", msg: "Add Supabase RLS policies for orders", who: "Builder Bot", when: "5h ago",  live: false },
    { sha: "7c3a0f2", msg: "Refactor checkout flow",               who: "Yaw",         when: "1d ago",  live: false },
  ];
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-[20px] font-display font-semibold tracking-tight">History</h2>
        <p className="text-[12.5px] text-muted-foreground mt-1">Every commit, build and deploy across the team.</p>
        <div className="mt-6 rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
          {versions.map((v, i) => (
            <div key={v.sha} className={cn("flex items-start gap-3 px-4 py-3.5", i < versions.length - 1 && "border-b border-white/5")}>
              <div className="mt-0.5 h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center">
                <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium truncate">{v.msg}</span>
                  {v.live && <span className="text-[10px] uppercase tracking-wider text-success bg-success/10 px-1.5 py-0.5 rounded">live</span>}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  <span className="font-mono">{v.sha}</span> · {v.who} · {v.when}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
