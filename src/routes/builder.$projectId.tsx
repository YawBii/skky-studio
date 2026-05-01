import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, Code2, Database, Rocket, RefreshCw, Monitor, Tablet, Smartphone, ExternalLink, Play, History as HistoryIcon, Plus, Activity, Loader2, ChevronDown, FileText, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/services/projects";
import { JobsPanel } from "@/components/jobs-panel";
import { enqueueJob } from "@/services/jobs";
import { useProjectJobs } from "@/hooks/use-project-jobs";
import { setBuilderUIState, type BuilderEnvironment } from "@/hooks/use-builder-ui-state";
import {
  CommandCenterPill,
  CommandCenterDrawer,
  deriveCommandCenterState,
  useCommandCenterAutoOpen,
} from "@/components/command-center";

const FALLBACK_PAGES: { path: string; label: string }[] = [
  { path: "/",          label: "Home" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/settings",  label: "Settings" },
  { path: "/projects",  label: "Projects" },
  { path: "/billing",   label: "Billing" },
  { path: "/team",      label: "Team" },
];

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
  const [selectedPage, setSelectedPage] = useState<string>("/");
  const [selectedEnvironment, setSelectedEnvironment] = useState<BuilderEnvironment>("production");
  const navigate = useNavigate();

  // Mirror UI state to the global hook so the chat panel reads it.
  useEffect(() => {
    setBuilderUIState({ selectedPage, selectedEnvironment, currentTab: tab });
  }, [selectedPage, selectedEnvironment, tab]);

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

  // Listen for cross-component tab switches (e.g. from chat smart suggestions).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: Tab; focusJobId?: string }>).detail;
      if (detail?.tab) setTab(detail.tab);
      if (detail?.focusJobId) setFocusJobId(detail.focusJobId);
    };
    window.addEventListener("yawb:switch-tab", handler as EventListener);
    return () => window.removeEventListener("yawb:switch-tab", handler as EventListener);
  }, []);

  // Live job state for the Command Center pill/drawer. Polling only runs
  // while there is active work (handled inside useProjectJobs).
  const ccJobs = useProjectJobs(project?.id ?? null, project?.workspaceId ?? null);
  const ccState = useMemo(() => deriveCommandCenterState(ccJobs.jobs), [ccJobs.jobs]);
  const { open: ccOpen, setOpen: setCcOpen, effectiveMode: ccMode } = useCommandCenterAutoOpen(ccState, {
    onJobSucceeded: (j) => {
      // After a successful build, return focus to Preview.
      if (j.type === "build.production" || j.type === "build.typecheck") {
        setTab("preview");
      }
    },
  });

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
      // Keep user on Preview. Command Center pill shows progress; the drawer
      // only auto-opens for waiting_for_input or failed (or manual click).
      setTab("preview");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[yawb] startBuild.enqueue.error", e);
      toast.error(`Couldn't queue build: ${msg}`);
    } finally {
      setStarting(false);
    }
  };

  const onPagePick = (path: string) => {
    console.info("[yawb] pagePicker.selected", { path, projectId: project.id });
    console.info("[yawb] topbar.clicked", { control: "page-picker-item", path });
    setSelectedPage(path);
  };

  const onEnvPick = (env: BuilderEnvironment) => {
    console.info("[yawb] environmentPicker.selected", { env, projectId: project.id });
    console.info("[yawb] topbar.clicked", { control: "environment-picker-item", env });
    setSelectedEnvironment(env);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="relative z-40 h-11 border-b border-white/5 px-4 flex items-center gap-2 bg-background/70 backdrop-blur-xl pointer-events-auto">
        {/* Project selector — currently jumps to the project list, will become a switcher. */}
        <button
          type="button"
          onClick={() => {
            console.info("[yawb] topbar.clicked", { control: "project-name", projectId: project.id });
            void navigate({ to: "/projects" });
          }}
          className="inline-flex items-center gap-1.5 h-8 px-2 rounded-lg hover:bg-white/[0.05] transition touch-manipulation pointer-events-auto cursor-pointer min-w-0"
          title="Switch project"
        >
          <span className="font-display font-semibold text-[13px] truncate max-w-[160px]">{project.name}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        <span className="text-muted-foreground/40 text-xs">/</span>

        {/* Page picker */}
        <Popover onOpenChange={(o) => o && (console.info("[yawb] pagePicker.opened", { projectId: project.id }), console.info("[yawb] topbar.clicked", { control: "page-picker" }))}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-8 px-2 rounded-lg hover:bg-white/[0.05] transition touch-manipulation pointer-events-auto cursor-pointer"
              title="Switch page"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-[12px]">{selectedPage}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1 bg-background/95 backdrop-blur-xl border-white/10 z-50">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Pages</div>
            {FALLBACK_PAGES.map((p) => (
              <button
                key={p.path}
                type="button"
                onClick={() => onPagePick(p.path)}
                className={cn(
                  "w-full text-left flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[12.5px] hover:bg-white/[0.05] touch-manipulation",
                  selectedPage === p.path && "bg-white/[0.06] text-foreground",
                )}
              >
                <span className="font-mono">{p.path}</span>
                <span className="text-[11px] text-muted-foreground">{p.label}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <span className="text-muted-foreground/40 text-xs">/</span>

        {/* Environment picker */}
        <Popover onOpenChange={(o) => o && (console.info("[yawb] environmentPicker.opened", { projectId: project.id }), console.info("[yawb] topbar.clicked", { control: "environment-picker" }))}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-[10.5px] uppercase tracking-[0.16em] transition touch-manipulation pointer-events-auto cursor-pointer",
                selectedEnvironment === "production"
                  ? "border-success/30 bg-success/10 text-success hover:bg-success/15"
                  : "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15",
              )}
              title="Switch environment"
            >
              <Globe className="h-3 w-3" />
              {selectedEnvironment}
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-44 p-1 bg-background/95 backdrop-blur-xl border-white/10 z-50">
            {(["preview", "production"] as BuilderEnvironment[]).map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => onEnvPick(env)}
                className={cn(
                  "w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] hover:bg-white/[0.05] touch-manipulation capitalize",
                  selectedEnvironment === env && "bg-white/[0.06] text-foreground",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", env === "production" ? "bg-success" : "bg-warning")} />
                {env}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="h-4 w-px bg-white/5 mx-1" />

        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                console.info("[yawb] topbar.clicked", { control: `tab-${t.id}` });
                onTabClick(t.id);
              }}
              className={cn(
                "inline-flex items-center gap-2 h-8 px-3 rounded-lg text-[12.5px] transition touch-manipulation pointer-events-auto cursor-pointer",
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

      <div className="flex-1 min-h-0 overflow-hidden relative">
        {tab === "preview"  && (
          <PreviewPane
            device={device}
            setDevice={setDevice}
            project={project}
            onStartBuild={onStartBuild}
            starting={starting}
            selectedPage={selectedPage}
          />
        )}
        {tab === "code"     && <NotConnected title="Code editor" hint="In-app code editing connects in the next pass." />}
        {tab === "database" && <NotConnected title="Database" hint="Connect Supabase from Integrations to inspect this project's tables." cta={{ label: "Open Integrations", to: "/connectors" }} />}
        {tab === "deploy"   && <NotConnected title="Deploys" hint="Connect Vercel from Integrations to deploy this project." cta={{ label: "Open Integrations", to: "/connectors" }} />}
        {tab === "jobs"     && <JobsPanel projectId={project.id} workspaceId={project.workspaceId} initialExpandedJobId={focusJobId} />}
        {tab === "history"  && <NotConnected title="History" hint="Connect a Git provider to see commit history." cta={{ label: "Open Integrations", to: "/connectors" }} />}

        {/* Command Center: compact pill + collapsible drawer.
            Hidden on the Jobs tab (full panel already visible there). */}
        {tab !== "jobs" && (
          <>
            <CommandCenterPill
              state={{ ...ccState, mode: ccMode }}
              open={ccOpen}
              onToggle={() => setCcOpen(!ccOpen)}
            />
            <CommandCenterDrawer
              open={ccOpen}
              onClose={() => setCcOpen(false)}
              projectId={project.id}
              workspaceId={project.workspaceId}
              focusJobId={ccState.activeJob?.id ?? focusJobId}
              onOpenJobsTab={() => { setCcOpen(false); setTab("jobs"); }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function PreviewPane({ device, setDevice, project, onStartBuild, starting, selectedPage }: {
  device: Device;
  setDevice: (d: Device) => void;
  project: Project;
  onStartBuild: () => void;
  starting: boolean;
  selectedPage: string;
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
          <ExternalLink className="h-3 w-3" />
          <span className="truncate">{selectedPage}</span>
          <span className="ml-auto text-muted-foreground/60 text-[10.5px] non-italic">No deploy URL yet</span>
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
