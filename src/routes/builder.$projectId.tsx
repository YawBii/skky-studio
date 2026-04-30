import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, Code2, Database, Rocket, RefreshCw, Monitor, Tablet, Smartphone, ExternalLink, Play, History as HistoryIcon, Plus, Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/services/projects";
import { JobsPanel } from "@/components/jobs-panel";
import { enqueueJob } from "@/services/jobs";

export const Route = createFileRoute("/builder/$projectId")({
  head: ({ params }) => ({
    meta: [
      { title: `Builder — ${params.projectId} | yawB` },
      { name: "description", content: "Preview, code, database, deploy and history — all in one workspace." },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-10">Error: {error.message}</div>,
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-display font-bold">Project not found</h1>
      <Link to="/" className="text-primary text-sm mt-3 inline-block">← Back to dashboard</Link>
    </div>
  ),
  component: Builder,
});

type Tab = "preview" | "code" | "database" | "deploy" | "jobs" | "history";
type Device = "desktop" | "tablet" | "mobile";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "preview",  label: "Preview",  icon: Eye },
  { id: "code",     label: "Code",     icon: Code2 },
  { id: "database", label: "Database", icon: Database },
  { id: "deploy",   label: "Deploy",   icon: Rocket },
  { id: "jobs",     label: "Jobs",     icon: Activity },
  { id: "history",  label: "History",  icon: HistoryIcon },
];

function Builder() {
  const { projectId } = Route.useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("preview");
  const [device, setDevice] = useState<Device>("desktop");
  const [focusJobId, setFocusJobId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("id, workspace_id, name, slug, description, created_at")
        .eq("id", projectId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) { setMissing(true); setProject(null); }
      else {
        setProject({
          id: data.id,
          workspaceId: data.workspace_id,
          name: data.name,
          slug: data.slug,
          description: data.description,
          createdAt: data.created_at,
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading project…</div>;
  if (missing || !project) {
    throw notFound();
  }

  const onTabClick = (id: Tab) => {
    console.info("[yawb] tab.clicked", { tab: id, projectId: project.id });
    setTab(id);
  };

  const onStartBuild = async () => {
    console.info("[yawb] startBuild.clicked", { projectId: project.id });
    if (starting) return;
    setStarting(true);
    try {
      console.info("[yawb] startBuild.enqueue.start", { projectId: project.id });
      const r = await enqueueJob({
        projectId: project.id,
        workspaceId: project.workspaceId,
        type: "build.production",
        title: "Start build",
        input: { source: "preview_empty_state_cta" },
      });
      if (!r.ok) {
        console.error("[yawb] startBuild.enqueue.error", r);
        const detail = r.tableMissing
          ? `Job tables missing — run ${r.sqlFile ?? "docs/sql/2026-04-30-project-jobs.sql"}`
          : r.error;
        toast.error(`Couldn't queue build: ${detail}`);
        return;
      }
      console.info("[yawb] startBuild.enqueue.success", { jobId: r.job.id });
      toast.success("Build job queued");
      setFocusJobId(r.job.id);
      setTab("jobs");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[yawb] startBuild.enqueue.error", e);
      toast.error(`Couldn't queue build: ${msg}`);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-11 border-b border-white/5 px-4 flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display font-semibold text-[13px] truncate max-w-[180px]">{project.name}</span>
        </div>
        <div className="h-4 w-px bg-white/5" />
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabClick(t.id)}
              className={cn(
                "inline-flex items-center gap-2 h-8 px-3 rounded-lg text-[12.5px] transition touch-manipulation",
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
        {tab === "preview"  && (
          <PreviewPane
            device={device}
            setDevice={setDevice}
            project={project}
            onStartBuild={onStartBuild}
            starting={starting}
          />
        )}
        {tab === "code"     && <NotConnected title="Code editor" hint="In-app code editing connects in the next pass." />}
        {tab === "database" && <NotConnected title="Database" hint="Connect Supabase from Integrations to inspect this project's tables." cta={{ label: "Open Integrations", to: "/connectors" }} />}
        {tab === "deploy"   && <NotConnected title="Deploys" hint="Connect Vercel from Integrations to deploy this project." cta={{ label: "Open Integrations", to: "/connectors" }} />}
        {tab === "jobs"     && <JobsPanel projectId={project.id} workspaceId={project.workspaceId} initialExpandedJobId={focusJobId} />}
        {tab === "history"  && <NotConnected title="History" hint="Connect a Git provider to see commit history." cta={{ label: "Open Integrations", to: "/connectors" }} />}
      </div>
    </div>
  );
}

function PreviewPane({ device, setDevice, project, onStartBuild, starting }: {
  device: Device;
  setDevice: (d: Device) => void;
  project: Project;
  onStartBuild: () => void;
  starting: boolean;
}) {
  const widths: Record<Device, string> = { desktop: "100%", tablet: "820px", mobile: "390px" };
  return (
    <div className="h-full flex flex-col">
      <div className="h-11 border-b border-white/5 px-4 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 touch-manipulation"
          onClick={() => { console.info("[yawb] preview.refresh.clicked"); toast("Refreshing preview…"); }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1 mx-2 h-7 rounded-md bg-white/[0.04] border border-white/5 px-2.5 flex items-center text-[11.5px] text-muted-foreground gap-2 font-mono">
          <ExternalLink className="h-3 w-3" /> No deploy URL yet
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
          {([
            { k: "desktop", I: Monitor },
            { k: "tablet",  I: Tablet  },
            { k: "mobile",  I: Smartphone },
          ] as const).map(({ k, I }) => (
            <button
              key={k}
              type="button"
              onClick={() => { console.info("[yawb] preview.device.clicked", { device: k }); setDevice(k); }}
              className={cn(
                "h-6 w-6 rounded grid place-items-center transition touch-manipulation",
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
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">Preview</div>
              <h2 className="mt-3 text-3xl md:text-4xl font-display font-bold tracking-tight text-balance">{project.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-md text-pretty">
                Tell yawB in the chat what to build. The first build will appear here.
              </p>
              <Button
                type="button"
                variant="hero"
                className="mt-5 touch-manipulation"
                onClick={onStartBuild}
                disabled={starting}
              >
                {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {starting ? "Queuing…" : "Start a build"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotConnected({ title, hint, cta }: { title: string; hint: string; cta?: { label: string; to: string } }) {
  return (
    <div className="h-full grid place-items-center text-center px-6">
      <div className="max-w-sm">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">Not connected yet</div>
        <h2 className="mt-2 text-2xl font-display font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">{hint}</p>
        {cta && (
          <Button variant="hero" className="mt-5" asChild>
            <Link to={cta.to as never}><Plus className="h-3.5 w-3.5" /> {cta.label}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
