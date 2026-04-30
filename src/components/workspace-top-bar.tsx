import { Link } from "@tanstack/react-router";
import { Github, Database, Triangle, Rocket, ChevronDown, Play, UserPlus, Crown, Eye, Globe, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ConnectionProvider, ConnectionStatus, ProjectConnection } from "@/services/project-connections";

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

const PROVIDER_ICONS: Partial<Record<ConnectionProvider, React.ComponentType<{ className?: string }>>> = {
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

  return (
    <header className="sticky top-0 z-30 h-12 border-b border-white/5 bg-background/70 backdrop-blur-xl">
      <div className="h-full px-4 flex items-center gap-3">
        {/* Workspace + Project */}
        <button
          type="button"
          className="group flex items-center gap-2 rounded-lg hover:bg-white/[0.04] px-2 h-8 transition min-w-0"
        >
          {workspaceName && (
            <>
              <span className="text-[11.5px] text-muted-foreground truncate max-w-[120px]">{workspaceName}</span>
              <span className="text-muted-foreground/40 text-xs">/</span>
            </>
          )}
          <span className="text-[13px] font-medium tracking-tight max-w-[220px] truncate">{projectName}</span>
          <span className="text-muted-foreground/50 text-xs">/</span>
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{environment}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

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
                          c.status === "editing" ? "bg-success animate-pulse" :
                          c.status === "viewing" ? "bg-[oklch(0.72_0.18_240)]" :
                          c.status === "online"  ? "bg-success" :
                          "bg-muted-foreground/40",
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
          className="text-[12px]"
        >
          <UserPlus className="h-3.5 w-3.5" /> Share
        </Button>

        {/* Connection chips — only render when there are real rows */}
        {connections.length > 0 && (
          <Link
            to="/connectors"
            title="Integrations"
            className="hidden sm:inline-flex items-center gap-2 h-8 px-2 rounded-lg hover:bg-white/[0.04] transition"
          >
            {connections.map((c) => {
              const Icon = PROVIDER_ICONS[c.provider] ?? Database;
              return <ConnDot key={c.id} icon={Icon} status={c.status} title={`${c.provider}: ${c.status}`} />;
            })}
          </Link>
        )}

        <Button variant="ghost" size="sm" onClick={() => toast("Opening analytics…")} className="hidden md:inline-flex">
          <BarChart3 className="h-3.5 w-3.5" /> Analytics
        </Button>

        <Button variant="ghost" size="sm" onClick={() => toast("Coming next: connect a custom domain")}>
          <Globe className="h-3.5 w-3.5" /> Domain
        </Button>

        <Button variant="ghost" size="sm" onClick={() => toast("Opening preview…")}>
          <Play className="h-3.5 w-3.5" /> Preview
        </Button>

        <Button variant="hero" size="sm" onClick={onDeploy ?? (() => toast.success("Deploy queued"))}>
          <Rocket className="h-3.5 w-3.5" /> Publish
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
    status === "passing" ? "bg-success" :
    status === "failing" ? "bg-destructive" :
    "bg-warning animate-pulse";
  return <span className={cn("h-1.5 w-1.5 rounded-full", cls)} />;
}

function ConnDot({
  icon: Icon, status, title,
}: { icon: React.ComponentType<{ className?: string }>; status: ConnectionStatus; title?: string }) {
  const dot =
    status === "connected" ? "bg-success" :
    status === "pending" ? "bg-warning animate-pulse" :
    status === "error" ? "bg-destructive" :
    "bg-muted-foreground/40";
  return (
    <span className="relative inline-flex" title={title}>
      <Icon className={cn("h-3.5 w-3.5", status === "connected" ? "text-foreground/80" : "text-muted-foreground/60")} />
      <span className={cn("absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-background", dot)} />
    </span>
  );
}
