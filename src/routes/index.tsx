import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Eye, Code2, Database, Rocket, RefreshCw, Monitor, Tablet, Smartphone,
  ExternalLink, CheckCircle2, AlertTriangle, Play, History, GitCommit,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workspace — yawB" },
      { name: "description", content: "Preview, edit, and ship your production app with yawB." },
    ],
  }),
  component: Workspace,
});

type Tab = "preview" | "code" | "database" | "deploy" | "history";
type Device = "desktop" | "tablet" | "mobile";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "preview",  label: "Preview",  icon: Eye },
  { id: "code",     label: "Code",     icon: Code2 },
  { id: "database", label: "Database", icon: Database },
  { id: "deploy",   label: "Deploy",   icon: Rocket },
  { id: "history",  label: "History",  icon: History },
];

function Workspace() {
  const [tab, setTab] = useState<Tab>("preview");
  const [device, setDevice] = useState<Device>("desktop");
  const [logsOpen, setLogsOpen] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Tab strip */}
      <div className="h-11 border-b border-white/5 px-4 flex items-center gap-1">
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

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setLogsOpen(true)}
            className="text-[11.5px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Build passing · view logs
          </button>
        </div>
      </div>

      {/* Pane */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "preview"  && <PreviewPane device={device} setDevice={setDevice} />}
        {tab === "code"     && <ComingSoon title="Code editor" hint="Open the in-app code editor." />}
        {tab === "database" && <ComingSoon title="Database" hint="Browse tables, RLS, and schema." />}
        {tab === "deploy"   && <DeployPane />}
      </div>

      {/* Build logs drawer */}
      <Sheet open={logsOpen} onOpenChange={setLogsOpen}>
        <SheetContent side="bottom" className="bg-background/95 backdrop-blur-xl border-white/10">
          <SheetHeader>
            <SheetTitle>Build logs</SheetTitle>
            <SheetDescription>Most recent build · #248 · 38s</SheetDescription>
          </SheetHeader>
          <div className="mt-4 rounded-xl border border-white/5 bg-black/40 font-mono text-[11.5px] p-4 max-h-[40vh] overflow-y-auto scrollbar-thin">
            {[
              "✓ Resolving dependencies (412 packages)",
              "✓ Compiling routes · 18 files",
              "✓ Generating Supabase types",
              "✓ Bundling client (vite) · gzip 142kb",
              "✓ Running smoke tests · 12 passed",
              "✅ Build #248 succeeded in 38s",
            ].map((l, i) => (
              <div key={i} className={cn(l.startsWith("✅") ? "text-success font-medium mt-2" : "text-muted-foreground")}>
                <span className="text-muted-foreground/50 mr-3 num">{String(i + 1).padStart(2, "0")}</span>{l}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ---------- Preview ---------- */

function PreviewPane({ device, setDevice }: { device: Device; setDevice: (d: Device) => void }) {
  const widths: Record<Device, string> = { desktop: "100%", tablet: "820px", mobile: "390px" };
  return (
    <div className="h-full flex flex-col">
      <div className="h-11 border-b border-white/5 px-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast("Refreshing…")}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1 mx-2 h-7 rounded-md bg-white/[0.04] border border-white/5 px-2.5 flex items-center text-[11.5px] text-muted-foreground gap-2 font-mono">
          <ExternalLink className="h-3 w-3" /> https://portal.skky.group
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
                Welcome back, Skky team
              </h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-md text-pretty">
                Your latest build is live and verified.
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

/* ---------- Deploy ---------- */

function DeployPane() {
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-[20px] font-display font-semibold tracking-tight">Deploy</h2>
        <p className="text-[12.5px] text-muted-foreground mt-1">Promote the latest verified build to production.</p>

        <div className="mt-6 rounded-2xl border border-white/5 bg-gradient-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-[13.5px] font-medium">Production · main · a4f2c91</span>
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-1">Last deploy 2h ago · Built in 42s</div>
            </div>
            <Button variant="hero" size="sm" onClick={() => toast.success("Deploy queued")}>
              <Rocket className="h-3.5 w-3.5" /> Publish
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-warning/20 bg-warning/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <div className="text-[12.5px]">
            <div className="font-medium">1 readiness check pending</div>
            <div className="text-muted-foreground mt-0.5">Custom domain not yet verified. Open in Settings → Domains.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Coming soon ---------- */

function ComingSoon({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="h-full grid place-items-center text-center px-6">
      <div className="max-w-sm">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">Coming next</div>
        <h2 className="mt-2 text-2xl font-display font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-[13px] text-muted-foreground text-pretty">{hint}</p>
        <p className="mt-4 text-[11.5px] text-muted-foreground">
          Ask yawB in the chat to start working on this surface.
        </p>
      </div>
    </div>
  );
}
