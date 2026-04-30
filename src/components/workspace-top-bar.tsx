import { Link } from "@tanstack/react-router";
import {
  Github, Database, Triangle, Rocket, ChevronDown, Search, Bell, Play, Globe,
} from "lucide-react";
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
    <header className="sticky top-0 z-30 h-14 border-b border-white/5 bg-background/70 backdrop-blur-xl">
      <div className="h-full px-4 md:px-6 flex items-center gap-3">
        {/* Project switcher */}
        <button
          type="button"
          className="group flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] pl-2 pr-2.5 h-9 hover:bg-white/[0.06] transition"
        >
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-white/90 to-white/50 text-[oklch(0.16_0_0)] flex items-center justify-center font-display text-[11px] font-bold">
            {projectName.charAt(0)}
          </div>
          <span className="text-[13px] font-medium tracking-tight max-w-[180px] truncate">{projectName}</span>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {environment}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {/* Build status pill */}
        <div className="hidden md:inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] h-9 px-3 text-[12px]">
          <BuildDot status={buildStatus} />
          <span className="text-muted-foreground">Build</span>
          <span className="font-medium capitalize">{buildStatus}</span>
        </div>

        {/* Search */}
        <div className="hidden lg:flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] h-9 px-3 text-[12px] text-muted-foreground w-[280px]">
          <Search className="h-3.5 w-3.5" />
          <input
            placeholder="Search files, commands, prompts…"
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
        </div>

        <div className="flex-1" />

        {/* Connection chips */}
        <div className="hidden md:flex items-center gap-1.5">
          <ConnChip icon={Github}    label="GitHub"   ok={connections.github === "connected"} />
          <ConnChip icon={Database}  label="Supabase" ok={connections.supabase === "connected"} />
          <ConnChip icon={Triangle}  label="Vercel"   ok={connections.vercel === "connected"} />
        </div>

        <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
          <Link to="/health" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Link>
        </Button>

        <Button variant="glass" size="sm" className="hidden sm:inline-flex" onClick={() => toast("Opening preview sandbox…")}>
          <Play className="h-3.5 w-3.5" /> Preview
        </Button>

        <Button variant="hero" size="sm" onClick={onDeploy ?? (() => toast.success("Deploy queued", { description: "Promoting latest build to production." }))}>
          <Rocket className="h-3.5 w-3.5" /> Deploy
        </Button>
      </div>
    </header>
  );
}

function BuildDot({ status }: { status: "passing" | "failing" | "building" }) {
  const cls =
    status === "passing" ? "bg-success animate-pulse" :
    status === "failing" ? "bg-destructive" :
    "bg-warning animate-pulse";
  return <span className={cn("h-1.5 w-1.5 rounded-full", cls)} />;
}

function ConnChip({
  icon: Icon, label, ok,
}: { icon: React.ComponentType<{ className?: string }>; label: string; ok: boolean }) {
  return (
    <Link
      to="/connectors"
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-lg h-8 px-2.5 text-[11px] border transition",
        ok
          ? "border-success/30 bg-success/10 text-success hover:bg-success/15"
          : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
      )}
      title={`${label}: ${ok ? "Connected" : "Not connected"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden xl:inline">{label}</span>
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-success" : "bg-muted-foreground/40")} />
    </Link>
  );
}

export function StatusGlobe() {
  return <Globe className="h-3.5 w-3.5" />;
}
