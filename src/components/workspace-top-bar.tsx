import { Link, useNavigate } from "@tanstack/react-router";
import {
  Github,
  Database,
  Triangle,
  Rocket,
  ChevronDown,
  Play,
  UserPlus,
  Crown,
  Eye,
  Globe,
  BarChart3,
  Check,
  FolderKanban,
  Plug,
  ExternalLink,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { MobileProjectPicker } from "@/components/mobile-project-picker";
import type {
  ConnectionProvider,
  ConnectionStatus,
  ProjectConnection,
} from "@/services/project-connections";

export type CollaboratorRole = "owner" | "admin" | "member" | "viewer";
export type CollaboratorStatus = "editing" | "viewing" | "online" | "offline";

export interface Collaborator {
  name: string;
  initials: string;
  color: string;
  role: CollaboratorRole;
  status: CollaboratorStatus;
}

interface WorkspaceTopBarProps {
  projectName: string;
  workspaceName?: string;
  environment: "production" | "preview" | "development";
  buildStatus?: "passing" | "failing" | "building" | "unknown";
  /** Real connection rows for the selected project. When empty, no chips render. */
  connections: ProjectConnection[];
  collaborators?: Collaborator[];
  presenceLive?: boolean;
  onDeploy?: () => void;
  onShare?: () => void;
}

const PROVIDER_ICONS: Partial<
  Record<ConnectionProvider, React.ComponentType<{ className?: string }>>
> = {
  github: Github,
  vercel: Triangle,
  netlify: Triangle,
  gitlab: Github,
  bitbucket: Github,
};

export function WorkspaceTopBar({
  projectName,
  workspaceName,
  environment,
  buildStatus = "unknown",
  connections,
  collaborators = [],
  presenceLive = false,
  onDeploy,
  onShare,
}: WorkspaceTopBarProps) {
  const visible = collaborators.slice(0, 3);
  const extra = Math.max(0, collaborators.length - visible.length);
  const { projects, project: currentProject, selectProject } = useSelectedProject();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);

  const onPickProject = (id: string) => {
    console.info("[yawb] topbar.projectSwitcher.pick", { id });
    selectProject(id);
    void navigate({ to: "/builder/$projectId", params: { projectId: id } });
  };

  const SwitcherButton = (
    <button
      type="button"
      data-testid="topbar-project-switcher"
      onClick={isMobile ? () => setMobilePickerOpen(true) : undefined}
      className="group flex items-center gap-2 rounded-lg hover:bg-white/[0.04] px-2 h-8 transition min-w-0 touch-manipulation"
      title="Switch project"
    >
      {workspaceName && (
        <>
          <span className="hidden sm:inline text-[11.5px] text-muted-foreground truncate max-w-[120px]">
            {workspaceName}
          </span>
          <span className="hidden sm:inline text-muted-foreground/40 text-xs">/</span>
        </>
      )}
      <FolderKanban className="h-3.5 w-3.5 text-muted-foreground sm:hidden shrink-0" />
      <span className="text-[13px] font-medium tracking-tight max-w-[150px] sm:max-w-[220px] truncate">
        {projectName}
      </span>
      <span className="hidden sm:inline text-muted-foreground/50 text-xs">/</span>
      <span className="hidden sm:inline text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {environment}
      </span>
      <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
    </button>
  );

  return (
    <header className="sticky top-0 z-30 h-12 border-b border-white/5 bg-background/70 backdrop-blur-xl">
      <div className="h-full px-3 sm:px-4 flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Workspace + Project switcher: mobile = full-screen sheet, desktop = popover */}
        {isMobile ? (
          SwitcherButton
        ) : (
          <Popover>
            <PopoverTrigger asChild>{SwitcherButton}</PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-72 p-1 bg-background/95 backdrop-blur-xl border-white/10 z-50"
            >
              <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Switch project
              </div>
              {projects.length === 0 ? (
                <div className="px-2 py-2 text-[12px] text-muted-foreground">No projects yet.</div>
              ) : (
                <div className="max-h-72 overflow-y-auto scrollbar-thin">
                  {projects.map((p) => {
                    const isCurrent = currentProject?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onPickProject(p.id)}
                        data-testid={`topbar-project-item-${p.id}`}
                        className={cn(
                          "w-full text-left flex items-center gap-2 rounded-md px-2 py-2 text-[13px] hover:bg-white/[0.05] touch-manipulation min-h-11",
                          isCurrent && "bg-white/[0.06] text-foreground",
                        )}
                      >
                        <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate flex-1">{p.name}</span>
                        {isCurrent && <Check className="h-3.5 w-3.5 text-success shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="border-t border-white/5 mt-1 pt-1">
                <Link
                  to="/projects"
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-white/[0.05] min-h-11 touch-manipulation"
                >
                  <FolderKanban className="h-3.5 w-3.5" />
                  All projects…
                </Link>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <MobileProjectPicker
          open={mobilePickerOpen}
          onOpenChange={setMobilePickerOpen}
          projects={projects}
          currentProjectId={currentProject?.id}
          onSelect={selectProject}
        />

        {/* Build status */}
        {buildStatus !== "unknown" && (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <BuildDot status={buildStatus} />
            <span className="capitalize">{buildStatus}</span>
          </span>
        )}

        <div className="flex-1" />

        {/* Collaborators */}
        {visible.length > 0 && (
          <TooltipProvider delayDuration={150}>
            <div className="flex items-center -space-x-1.5 mr-1">
              {visible.map((c) => (
                <Tooltip key={c.name}>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "relative inline-flex h-7 w-7 rounded-full ring-2 ring-background items-center justify-center text-[10.5px] font-semibold text-white/95",
                        c.color,
                      )}
                    >
                      {c.initials}
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-background",
                          c.status === "editing"
                            ? "bg-success animate-pulse"
                            : c.status === "viewing"
                              ? "bg-[oklch(0.72_0.18_240)]"
                              : c.status === "online"
                                ? "bg-success"
                                : "bg-muted-foreground/40",
                        )}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{c.name}</span>
                      <RoleBadge role={c.role} />
                    </div>
                    <div className="text-muted-foreground capitalize text-[10.5px]">{c.status}</div>
                  </TooltipContent>
                </Tooltip>
              ))}
              {extra > 0 && (
                <span className="inline-flex h-7 min-w-7 px-1.5 rounded-full ring-2 ring-background bg-white/10 text-[10.5px] font-semibold items-center justify-center">
                  +{extra}
                </span>
              )}
            </div>
          </TooltipProvider>
        )}

        {presenceLive && (
          <span className="hidden lg:inline-flex items-center gap-1.5 text-[10.5px] text-success/90">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
          </span>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onShare ?? (() => toast("Coming next: workspace invites"))}
          className="text-[12px] hidden sm:inline-flex"
        >
          <UserPlus className="h-3.5 w-3.5" /> Share
        </Button>

        {/* Connection chips — collapsed into a single icon + count with a popover of details */}
        {connections.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                title={`${connections.length} integration${connections.length === 1 ? "" : "s"}`}
                aria-label={`${connections.length} integrations`}
                className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2 rounded-lg hover:bg-white/[0.04] transition"
              >
                <span className="relative inline-flex">
                  <Plug className="h-3.5 w-3.5 text-foreground/80" />
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-background",
                      connections.some((c) => c.status === "error")
                        ? "bg-destructive"
                        : connections.every((c) => c.status === "connected")
                          ? "bg-success"
                          : connections.some((c) => c.status === "pending")
                            ? "bg-warning animate-pulse"
                            : "bg-muted-foreground/40",
                    )}
                  />
                </span>
                <span className="text-[11.5px] tabular-nums text-muted-foreground">
                  {connections.length}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 p-1 bg-background/95 backdrop-blur-xl border-white/10 z-50"
            >
              <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Integrations
              </div>
              <div className="max-h-72 overflow-y-auto scrollbar-thin">
                {connections.map((c) => {
                  const Icon = PROVIDER_ICONS[c.provider] ?? Database;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 px-2 py-2 text-[12.5px] rounded-md hover:bg-white/[0.04]"
                    >
                      <Icon className="h-3.5 w-3.5 text-foreground/80 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="capitalize truncate">{c.provider}</div>
                        {c.repoFullName && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            {c.repoFullName}
                          </div>
                        )}
                      </div>
                      <ConnStatusPill status={c.status} />
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-white/5 mt-1 pt-1">
                <Link
                  to="/connectors"
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                >
                  <Plug className="h-3.5 w-3.5" /> Manage integrations
                </Link>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void navigate({ to: "/health" })}
          className="hidden lg:inline-flex"
        >
          <BarChart3 className="h-3.5 w-3.5" /> Analytics
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void navigate({ to: "/connectors" })}
          className="hidden md:inline-flex"
        >
          <Globe className="h-3.5 w-3.5" /> Domain
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            currentProject?.id
              ? void navigate({
                  to: "/preview/$projectId",
                  params: { projectId: currentProject.id },
                })
              : toast("Select a project first")
          }
          className="hidden md:inline-flex"
        >
          <Play className="h-3.5 w-3.5" /> Preview
        </Button>

        <Button
          variant="hero"
          size="sm"
          onClick={onDeploy ?? (() => toast.success("Deploy queued"))}
          className="shrink-0"
        >
          <Rocket className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Publish</span>
        </Button>
      </div>
    </header>
  );
}

function RoleBadge({ role }: { role: CollaboratorRole }) {
  const Icon = role === "owner" || role === "admin" ? Crown : role === "viewer" ? Eye : null;
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-white/10 px-1 py-0.5 text-[9.5px] uppercase tracking-wider text-muted-foreground">
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {role}
    </span>
  );
}

function BuildDot({ status }: { status: "passing" | "failing" | "building" }) {
  const cls =
    status === "passing"
      ? "bg-success"
      : status === "failing"
        ? "bg-destructive"
        : "bg-warning animate-pulse";
  return <span className={cn("h-1.5 w-1.5 rounded-full", cls)} />;
}

function ConnStatusPill({ status }: { status: ConnectionStatus }) {
  const cls =
    status === "connected"
      ? "bg-success/15 text-success"
      : status === "pending"
        ? "bg-warning/15 text-warning"
        : status === "error"
          ? "bg-destructive/15 text-destructive"
          : "bg-white/5 text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
        cls,
      )}
    >
      {status}
    </span>
  );
}

function ConnDot({
  icon: Icon,
  status,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  status: ConnectionStatus;
  title?: string;
}) {
  const dot =
    status === "connected"
      ? "bg-success"
      : status === "pending"
        ? "bg-warning animate-pulse"
        : status === "error"
          ? "bg-destructive"
          : "bg-muted-foreground/40";
  return (
    <span className="relative inline-flex" title={title}>
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          status === "connected" ? "text-foreground/80" : "text-muted-foreground/60",
        )}
      />
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-background",
          dot,
        )}
      />
    </span>
  );
}
