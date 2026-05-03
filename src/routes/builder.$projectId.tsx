import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  Code2,
  Database,
  Rocket,
  History as HistoryIcon,
  Plus,
  Activity,
  ChevronDown,
  FileText,
  Globe,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getProjectById, type Project } from "@/services/projects";
import { rememberDirectProject } from "@/lib/project-selection";
import { JobsPanel } from "@/components/jobs-panel";
import { PreviewPane } from "@/components/preview-pane";
import { enqueueJob } from "@/services/jobs";
import { useProjectJobs } from "@/hooks/use-project-jobs";
import { useIsMobile } from "@/hooks/use-mobile";
import { setBuilderUIState, type BuilderEnvironment } from "@/hooks/use-builder-ui-state";
import {
  CommandCenterPill,
  CommandCenterDrawer,
  deriveCommandCenterState,
  useCommandCenterAutoOpen,
} from "@/components/command-center";
import { useProjectConnections } from "@/hooks/use-project-connections";
import { useProjectFiles } from "@/hooks/use-project-files";
import { resolveDeployUrl } from "@/lib/deploy-url";
import { MobileBootstrapPanel } from "@/components/mobile-bootstrap-panel";

const FALLBACK_PAGES: { path: string; label: string }[] = [
  { path: "/", label: "Home" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/settings", label: "Settings" },
  { path: "/projects", label: "Projects" },
  { path: "/billing", label: "Billing" },
  { path: "/team", label: "Team" },
];

export const Route = createFileRoute("/builder/$projectId")({
  head: ({ params }) => ({
    meta: [
      { title: `Builder — ${params.projectId} | yawB` },
      {
        name: "description",
        content: "Preview, code, database, deploy and history — all in one workspace.",
      },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-10">Error: {error.message}</div>,
  notFoundComponent: function NotFoundComponent() {
    const { projectId } = Route.useParams();
    return (
      <div className="p-6 sm:p-10 text-center max-w-md mx-auto">
        <h1 className="text-2xl font-display font-bold">Project not found</h1>
        <p className="text-sm text-muted-foreground mt-2">
          We couldn't load <span className="font-mono">{projectId}</span>. It may not exist, or you
          may not have access.
        </p>
        <Link to="/" className="text-primary text-sm mt-3 inline-block">
          ← Back to dashboard
        </Link>
        <div className="mt-6 text-left">
          <MobileBootstrapPanel urlProjectId={projectId} activeProjectId={null} />
        </div>
      </div>
    );
  },
  component: Builder,
});

type Tab = "preview" | "code" | "database" | "deploy" | "jobs" | "history";
type Device = "desktop" | "tablet" | "mobile";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "code", label: "Code", icon: Code2 },
  { id: "database", label: "Database", icon: Database },
  { id: "deploy", label: "Deploy", icon: Rocket },
  { id: "jobs", label: "Jobs", icon: Activity },
  { id: "history", label: "History", icon: HistoryIcon },
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
  const isMobile = useIsMobile();
  const userPickedDeviceRef = useRef(false);

  // Default the preview device to "mobile" when on a phone, "desktop" otherwise.
  // Once the user picks a device manually we stop overriding.
  useEffect(() => {
    if (userPickedDeviceRef.current) return;
    setDevice(isMobile ? "mobile" : "desktop");
  }, [isMobile]);

  const handleDeviceChange = (d: Device) => {
    userPickedDeviceRef.current = true;
    setDevice(d);
  };

  // Mirror UI state to the global hook so the chat panel reads it.
  useEffect(() => {
    setBuilderUIState({ selectedPage, selectedEnvironment, currentTab: tab });
  }, [selectedPage, selectedEnvironment, tab]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const direct = await getProjectById(projectId);
      if (cancelled) return;
      if (!direct.project) {
        setMissing(true);
        setProject(null);
      } else {
        setProject(direct.project);
        setMissing(false);
        rememberDirectProject(direct.project);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
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

  // Project connections drive the active deploy URL for PreviewPane.
  const connectionsApi = useProjectConnections(project?.id ?? null);
  const activeDeployResolved = useMemo(
    () => resolveDeployUrl(connectionsApi.connections),
    [connectionsApi.connections],
  );
  const activeDeployUrl = activeDeployResolved.url;

  useEffect(() => {
    if (!project) return;
    if (activeDeployUrl) {
      console.info("[yawb] preview.deployUrl.resolved", {
        source: activeDeployResolved.source,
        url: activeDeployUrl,
      });
    } else {
      console.info("[yawb] preview.deployUrl.missing", { projectId: project.id });
    }
  }, [activeDeployUrl, activeDeployResolved.source, project]);

  // Per-project generated files for Local Preview.
  const filesApi = useProjectFiles(project?.id ?? null);

  const {
    open: ccOpen,
    setOpen: setCcOpen,
    effectiveMode: ccMode,
  } = useCommandCenterAutoOpen(ccState, {
    onJobSucceeded: (j) => {
      // After a successful build, return focus to Preview + flash a toast.
      if (j.type === "build.production" || j.type === "build.typecheck") {
        setTab("preview");
        toast.success("Build passed", { description: j.title });
      }
      // After a successful preview deploy, refresh connections to pick up
      // the new deploy URL and switch back to Preview without a full reload.
      if (j.type === "vercel.create_preview_deploy") {
        void connectionsApi.refresh();
        setTab("preview");
        toast.success("Preview deploy ready");
      }
      // After a build.production succeeds, refresh project_files once so the
      // local preview reflects the new build.
      if (j.type === "build.production") {
        void filesApi.refresh().then(() => {
          toast.success("Local preview updated");
        });
      }
      // After ai.generate_changes succeeds, also refresh project_files and
      // switch the user to Preview + Local so the new design is visible
      // immediately. Without this, the regenerate job runs on the server but
      // the iframe keeps showing the previous HTML and the user thinks
      // "nothing changed".
      if (j.type === "ai.generate_changes") {
        const pid = project?.id;
        if (!pid) return;
        void filesApi.refresh().then(() => {
          setTab("preview");
          try {
            window.localStorage.setItem(`yawb:preview-mode:${pid}`, "local");
          } catch {
            /* localStorage may be blocked */
          }
          const designMode =
            (j.output && typeof j.output === "object"
              ? ((j.output as Record<string, unknown>).designMode as string | undefined)
              : undefined) ?? "design";
          toast.success(`Design updated — ${designMode}`, {
            description: "Local preview now shows the new design.",
          });
          window.dispatchEvent(
            new CustomEvent("yawb:preview-force-reload", { detail: { projectId: pid } }),
          );
        });
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
      <div className="relative z-40 h-11 border-b border-white/5 px-3 sm:px-4 flex items-center gap-2 bg-background/70 backdrop-blur-xl pointer-events-auto min-w-0 flex-nowrap overflow-hidden">
        {/* Project selector — currently jumps to the project list, will become a switcher. */}
        <button
          type="button"
          onClick={() => {
            console.info("[yawb] topbar.clicked", {
              control: "project-name",
              projectId: project.id,
            });
            void navigate({ to: "/projects" });
          }}
          className="inline-flex items-center gap-1.5 h-8 px-2 rounded-lg hover:bg-white/[0.05] transition touch-manipulation pointer-events-auto cursor-pointer min-w-0"
          title="Switch project"
        >
          <span className="font-display font-semibold text-[13px] truncate max-w-[160px]">
            {project.name}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        <span className="hidden sm:inline text-muted-foreground/40 text-xs">/</span>

        {/* Page picker — hidden on phones to avoid header overflow. */}
        <Popover
          onOpenChange={(o) =>
            o &&
            (console.info("[yawb] pagePicker.opened", { projectId: project.id }),
            console.info("[yawb] topbar.clicked", { control: "page-picker" }))
          }
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2 rounded-lg hover:bg-white/[0.05] transition touch-manipulation pointer-events-auto cursor-pointer"
              title="Switch page"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-[12px]">{selectedPage}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-56 p-1 bg-background/95 backdrop-blur-xl border-white/10 z-50"
          >
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Pages
            </div>
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

        <span className="hidden sm:inline text-muted-foreground/40 text-xs">/</span>

        {/* Environment picker */}
        <Popover
          onOpenChange={(o) =>
            o &&
            (console.info("[yawb] environmentPicker.opened", { projectId: project.id }),
            console.info("[yawb] topbar.clicked", { control: "environment-picker" }))
          }
        >
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
          <PopoverContent
            align="start"
            className="w-44 p-1 bg-background/95 backdrop-blur-xl border-white/10 z-50"
          >
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
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    env === "production" ? "bg-success" : "bg-warning",
                  )}
                />
                {env}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="hidden md:block h-4 w-px bg-white/5 mx-1" />

        <div className="hidden md:flex items-center gap-1">
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

      <div className="flex-1 min-h-0 overflow-hidden relative pb-[calc(env(safe-area-inset-bottom)+56px)] md:pb-0">
        {tab === "preview" && (
          <PreviewPane
            device={device}
            setDevice={handleDeviceChange}
            project={project}
            onStartBuild={onStartBuild}
            starting={starting}
            selectedPage={selectedPage}
            activeDeployUrl={activeDeployUrl}
            connections={connectionsApi.connections}
            generated={filesApi.generated}
            regenerating={false}
            jobs={ccJobs.jobs}
            stepsByJob={ccJobs.stepsByJob}
            onJumpToJob={(jobId) => {
              console.info("[yawb] preview.summary.jumpToJob", { jobId });
              setFocusJobId(jobId);
              setTab("jobs");
            }}
            onOpenSummaryInChat={(jobId) => {
              console.info("[yawb] preview.summary.openInChat", { jobId });
              window.dispatchEvent(new CustomEvent("yawb:open-chat"));
              window.dispatchEvent(new CustomEvent("yawb:focus-summary", { detail: { jobId } }));
            }}
            onRefreshLocalPreview={() => {
              console.info("[yawb] preview.localRefresh.clicked", { projectId: project.id });
              void filesApi.refresh().then(() => {
                toast.success("Local preview refreshed");
              });
            }}
            onRegenerateDesign={async (designMode) => {
              const regenerationSeed =
                typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
              console.info("[yawb] regenerate.seed", {
                regenerationSeed,
                designMode,
                projectId: project.id,
              });
              const r = await enqueueJob({
                projectId: project.id,
                workspaceId: project.workspaceId,
                type: "ai.generate_changes",
                title: `Regenerate design — ${designMode}`,
                input: {
                  source: "preview_regenerate_design",
                  regenerationSeed,
                  forceVariant: true,
                  designMode,
                },
              });
              if (!r.ok) {
                toast.error(`Couldn't regenerate: ${r.error}`);
                return;
              }
              console.info("[yawb] regenerate.enqueued", {
                jobId: r.job.id,
                regenerationSeed,
                designMode,
              });
              toast.success(`Regenerate (${designMode}) queued`);
              setFocusJobId(r.job.id);
              // Refresh jobs list once so the new job appears in the panel.
              void ccJobs.refresh();
            }}
          />
        )}
        {tab === "code" && (
          <NotConnected title="Code editor" hint="In-app code editing connects in the next pass." />
        )}
        {tab === "database" && (
          <NotConnected
            title="Database"
            hint="Connect Supabase from Integrations to inspect this project's tables."
            cta={{ label: "Open Integrations", to: "/connectors" }}
          />
        )}
        {tab === "deploy" && (
          <NotConnected
            title="Deploys"
            hint="Connect Vercel from Integrations to deploy this project."
            cta={{ label: "Open Integrations", to: "/connectors" }}
          />
        )}
        {tab === "jobs" && (
          <JobsPanel
            projectId={project.id}
            workspaceId={project.workspaceId}
            initialExpandedJobId={focusJobId}
          />
        )}
        {tab === "history" && (
          <NotConnected
            title="History"
            hint="Connect a Git provider to see commit history."
            cta={{ label: "Open Integrations", to: "/connectors" }}
          />
        )}

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
              onOpenJobsTab={() => {
                setCcOpen(false);
                setTab("jobs");
              }}
            />
          </>
        )}
      </div>

      {/* Mobile bottom tab bar — only visible <=768px. Provides Preview / Chat /
          Jobs / More. The Chat tab opens the SplitPane bottom-sheet via the
          'yawb:open-chat' custom event. */}
      <MobileBottomNav
        currentTab={tab}
        onTabClick={onTabClick}
        onOpenChat={() => {
          console.info("[yawb] mobile.bottomNav.chat.clicked");
          window.dispatchEvent(new CustomEvent("yawb:open-chat"));
        }}
      />
    </div>
  );
}

function useUnreadSummaries(): { count: number; clear: () => void } {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const onSummary = () => setCount((c) => c + 1);
    const onChatOpen = () => setCount(0);
    window.addEventListener("yawb:summary-appended", onSummary as EventListener);
    window.addEventListener("yawb:open-chat", onChatOpen as EventListener);
    return () => {
      window.removeEventListener("yawb:summary-appended", onSummary as EventListener);
      window.removeEventListener("yawb:open-chat", onChatOpen as EventListener);
    };
  }, []);
  return { count, clear: () => setCount(0) };
}

// Primary tabs (Preview/Jobs) live as dedicated buttons in the bottom bar.
// MOBILE_OVERFLOW_TABS only appear inside the "More" popover so we don't
// duplicate the visible tabs.
const MOBILE_OVERFLOW_TABS: {
  id: Tab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "code", label: "Code", icon: Code2 },
  { id: "database", label: "Database", icon: Database },
  { id: "deploy", label: "Deploy", icon: Rocket },
  { id: "history", label: "History", icon: HistoryIcon },
];

function MobileBottomNav({
  currentTab,
  onTabClick,
  onOpenChat,
}: {
  currentTab: Tab;
  onTabClick: (id: Tab) => void;
  onOpenChat: () => void;
}) {
  // Hide tabs that already have a dedicated bottom-bar button (preview, jobs)
  // and the currently-active tab so the popover never duplicates what's
  // already visible in the bottom bar.
  const VISIBLE_TABS: Tab[] = ["preview", "jobs"];
  const overflowItems = MOBILE_OVERFLOW_TABS.filter(
    (t) => !VISIBLE_TABS.includes(t.id) && t.id !== currentTab,
  );
  const inOverflow = MOBILE_OVERFLOW_TABS.some((t) => t.id === currentTab);
  const { count: unreadSummaries, clear: clearUnread } = useUnreadSummaries();
  const handleChat = () => {
    clearUnread();
    onOpenChat();
  };
  return (
    <nav
      data-testid="mobile-bottom-nav"
      aria-label="Builder sections"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch justify-around">
        {/* Preview */}
        <li className="flex-1">
          <BottomNavButton
            label="Preview"
            icon={Eye}
            active={currentTab === "preview"}
            onClick={() => onTabClick("preview")}
            testId="mobile-tab-preview"
          />
        </li>
        {/* Chat — opens bottom sheet, not a tab */}
        <li className="flex-1">
          <BottomNavButton
            label="Chat"
            icon={MessageSquare}
            active={false}
            onClick={handleChat}
            testId="mobile-tab-chat"
            badge={unreadSummaries}
          />
        </li>
        {/* Jobs */}
        <li className="flex-1">
          <BottomNavButton
            label="Jobs"
            icon={Activity}
            active={currentTab === "jobs"}
            onClick={() => onTabClick("jobs")}
            testId="mobile-tab-jobs"
          />
        </li>
        {/* More */}
        <li className="flex-1">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="mobile-tab-more"
                className={cn(
                  "w-full h-14 flex flex-col items-center justify-center gap-0.5 text-[11px] touch-manipulation",
                  inOverflow ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
                <span>More</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="top"
              className="w-56 p-1 bg-background/95 backdrop-blur-xl border-white/10 z-50 mb-2"
            >
              <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                More
              </div>
              {MOBILE_OVERFLOW_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTabClick(t.id)}
                  data-testid={`mobile-more-${t.id}`}
                  className={cn(
                    "w-full text-left flex items-center gap-2 rounded-md px-2 py-2 text-[13px] hover:bg-white/[0.05] touch-manipulation min-h-11",
                    currentTab === t.id && "bg-white/[0.06] text-foreground",
                  )}
                >
                  <t.icon className="h-4 w-4 text-muted-foreground" />
                  {t.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </li>
      </ul>
    </nav>
  );
}

function BottomNavButton({
  label,
  icon: Icon,
  active,
  onClick,
  testId,
  badge = 0,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
  testId: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      className={cn(
        "relative w-full h-14 flex flex-col items-center justify-center gap-0.5 text-[11px] touch-manipulation",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="relative">
        <Icon className="h-5 w-5" />
        {badge > 0 && (
          <span
            data-testid={`${testId}-badge`}
            className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-destructive text-[9px] font-semibold text-destructive-foreground inline-flex items-center justify-center ring-2 ring-background"
          >
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span>{label}</span>
    </button>
  );
}

function NotConnected({
  title,
  hint,
  cta,
}: {
  title: string;
  hint: string;
  cta?: { label: string; to: string };
}) {
  return (
    <div className="h-full grid place-items-center text-center px-6">
      <div className="max-w-sm">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          Not connected yet
        </div>
        <h2 className="mt-2 text-2xl font-display font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">{hint}</p>
        {cta && (
          <Button variant="hero" className="mt-5" asChild>
            <Link to={cta.to as never}>
              <Plus className="h-3.5 w-3.5" /> {cta.label}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
