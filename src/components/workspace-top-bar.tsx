import { Link } from "@tanstack/react-router";
import { Github, Database, Triangle, Rocket, ChevronDown, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConnectionStatus {
  github: "connected" | "disconnected";
  supabase: "connected" | "disconnected";
  vercel: "connected" | "disconnected";
}

interface WorkspaceTopBarProps {
  projectName: string;
  environment: "production" | "preview" | "development";
  connections: ConnectionStatus;
  buildStatus: "passing" | "failing" | "building";
  onDeploy?: () => void;
}

export function WorkspaceTopBar({
  projectName,
  environment,
  connections,
  buildStatus,
  onDeploy,
}: WorkspaceTopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-12 border-b border-white/5 bg-background/70 backdrop-blur-xl">
      <div className="h-full px-4 flex items-center gap-3">
        {/* Project + branch */}
        <button
          type="button"
          className="group flex items-center gap-2 rounded-lg hover:bg-white/[0.04] px-2 h-8 transition"
        >
          <span className="text-[13px] font-medium tracking-tight max-w-[220px] truncate">{projectName}</span>
          <span className="text-muted-foreground/50 text-xs">/</span>
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{environment}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        {/* Build status — minimal dot + word */}
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <BuildDot status={buildStatus} />
          <span className="capitalize">{buildStatus}</span>
        </span>

        <div className="flex-1" />

        {/* Connection dots only — click to view */}
        <Link
          to="/connectors"
          title="Integrations"
          className="hidden sm:inline-flex items-center gap-2 h-8 px-2 rounded-lg hover:bg-white/[0.04] transition"
        >
          <ConnDot icon={Github}   ok={connections.github === "connected"} />
          <ConnDot icon={Database} ok={connections.supabase === "connected"} />
          <ConnDot icon={Triangle} ok={connections.vercel === "connected"} />
        </Link>

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

function BuildDot({ status }: { status: "passing" | "failing" | "building" }) {
  const cls =
    status === "passing" ? "bg-success" :
    status === "failing" ? "bg-destructive" :
    "bg-warning animate-pulse";
  return <span className={cn("h-1.5 w-1.5 rounded-full", cls)} />;
}

function ConnDot({
  icon: Icon, ok,
}: { icon: React.ComponentType<{ className?: string }>; ok: boolean }) {
  return (
    <span className="relative inline-flex">
      <Icon className={cn("h-3.5 w-3.5", ok ? "text-foreground/80" : "text-muted-foreground/50")} />
      <span className={cn(
        "absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-background",
        ok ? "bg-success" : "bg-muted-foreground/40",
      )} />
    </span>
  );
}
