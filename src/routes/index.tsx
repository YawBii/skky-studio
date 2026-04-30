import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Eye, Code2, Database, Rocket, RefreshCw, Monitor, Tablet, Smartphone,
  ExternalLink, CheckCircle2, AlertTriangle, Play, History, GitCommit, BarChart3, Globe, Plus, Check,
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

type Tab = "preview" | "code" | "database" | "analytics" | "deploy" | "history";
type Device = "desktop" | "tablet" | "mobile";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "preview",   label: "Preview",   icon: Eye },
  { id: "code",      label: "Code",      icon: Code2 },
  { id: "database",  label: "Database",  icon: Database },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "deploy",    label: "Deploy",    icon: Rocket },
  { id: "history",   label: "History",   icon: History },
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
        {tab === "preview"   && <PreviewPane device={device} setDevice={setDevice} />}
        {tab === "code"      && <ComingSoon title="Code editor" hint="Open the in-app code editor." />}
        {tab === "database"  && <ComingSoon title="Database" hint="Browse tables, RLS, and schema." />}
        {tab === "analytics" && <AnalyticsPane />}
        {tab === "deploy"    && <DeployPane />}
        {tab === "history"   && <HistoryPane />}
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
          <div className="text-[12.5px] flex-1">
            <div className="font-medium">1 readiness check pending</div>
            <div className="text-muted-foreground mt-0.5">Custom domain not yet verified.</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => toast("Coming next: domain verification flow")}>
            <Globe className="h-3.5 w-3.5" /> Connect domain
          </Button>
        </div>

        {/* Domains list */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-display font-semibold tracking-tight">Custom domains</h3>
            <Button size="sm" variant="ghost" onClick={() => toast("Coming next: add a custom domain")}>
              <Plus className="h-3.5 w-3.5" /> Add domain
            </Button>
          </div>
          <div className="rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
            {[
              { name: "portal.skky.group", primary: true,  status: "Active",     ssl: true  },
              { name: "www.portal.skky.group", primary: false, status: "Active",  ssl: true  },
              { name: "staging.skky.group",  primary: false, status: "Verifying", ssl: false },
            ].map((d, i, a) => (
              <div key={d.name} className={cn("flex items-center justify-between px-4 py-3", i < a.length - 1 && "border-b border-white/5")}>
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-[12px] truncate">{d.name}</span>
                  {d.primary && <span className="text-[9.5px] uppercase tracking-wider text-foreground bg-white/10 px-1.5 py-0.5 rounded">primary</span>}
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className={cn("inline-flex items-center gap-1", d.status === "Active" ? "text-success" : "text-warning")}>
                    {d.status === "Active" ? <Check className="h-3 w-3" /> : <RefreshCw className="h-3 w-3 animate-spin" />}
                    {d.status}
                  </span>
                  <span className="text-muted-foreground">{d.ssl ? "SSL ✓" : "SSL issuing"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Analytics ---------- */

function AnalyticsPane() {
  const stats = [
    { label: "Visitors (24h)",   value: "2,481", delta: "+12.4%" },
    { label: "Page views",       value: "9,317", delta: "+8.1%" },
    { label: "Avg session",      value: "3m 42s", delta: "+0.6%" },
    { label: "Conversion",       value: "4.2%",  delta: "+0.3pt" },
  ];
  const top = [
    { path: "/",          views: 3812, share: 41 },
    { path: "/dashboard", views: 2104, share: 23 },
    { path: "/billing",   views: 1188, share: 13 },
    { path: "/settings",  views:  942, share: 10 },
    { path: "/team",      views:  611, share: 7  },
  ];
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-display font-semibold tracking-tight">Analytics</h2>
            <p className="text-[12.5px] text-muted-foreground mt-1">Live production traffic · last 24 hours</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => toast("Refreshing analytics…")}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/5 bg-gradient-card p-4">
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-[20px] font-display font-semibold tabular-nums tracking-tight">{s.value}</div>
              <div className="text-[11px] text-success mt-0.5">{s.delta}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/5 bg-gradient-card p-5">
          <div className="text-[13px] font-medium mb-3">Top pages</div>
          {top.map((p) => (
            <div key={p.path} className="flex items-center gap-3 py-2">
              <div className="font-mono text-[12px] w-32 truncate">{p.path}</div>
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-gradient-brand" style={{ width: `${p.share * 2.4}%` }} />
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums w-16 text-right">{p.views.toLocaleString()}</div>
            </div>
          ))}
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

/* ---------- History ---------- */

function HistoryPane() {
  const versions = [
    { sha: "a4f2c91", msg: "Promote build #248 to production",     who: "Yaw",         when: "2h ago",  status: "deployed" as const },
    { sha: "9d1e7b3", msg: "Add Supabase RLS policies for orders", who: "Builder Bot", when: "5h ago",  status: "merged"   as const },
    { sha: "7c3a0f2", msg: "Refactor checkout flow",               who: "Yaw",         when: "1d ago",  status: "merged"   as const },
    { sha: "5b2e9c4", msg: "Fix mobile preview layout",            who: "Reviewer",    when: "2d ago",  status: "merged"   as const },
    { sha: "3a1d8e5", msg: "Initial workspace scaffold",           who: "Builder Bot", when: "5d ago",  status: "merged"   as const },
  ];
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-[20px] font-display font-semibold tracking-tight">History</h2>
        <p className="text-[12.5px] text-muted-foreground mt-1">Every commit, build and deploy across the team.</p>
        <div className="mt-6 rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
          {versions.map((v, i) => (
            <div key={v.sha} className={cn(
              "flex items-start gap-3 px-4 py-3.5",
              i < versions.length - 1 && "border-b border-white/5",
            )}>
              <div className="mt-0.5 h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center">
                <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium truncate">{v.msg}</span>
                  {v.status === "deployed" && (
                    <span className="text-[10px] uppercase tracking-wider text-success bg-success/10 px-1.5 py-0.5 rounded">live</span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  <span className="font-mono">{v.sha}</span> · {v.who} · {v.when}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-[11px]" onClick={() => toast(`Viewing ${v.sha}`)}>
                View
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
