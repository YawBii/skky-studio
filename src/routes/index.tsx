import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles, GitBranch, ArrowRight, Zap, Rocket, AlertTriangle, CheckCircle2,
  XCircle, Github, Database, Triangle, Wrench, ExternalLink, Activity,
  RefreshCw, ShieldCheck, KeyRound, Clock, MoreHorizontal, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { projects, healthChecks } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workspace — yawB" },
      { name: "description", content: "Build, repair and deploy production apps from a single workspace." },
    ],
  }),
  component: Workspace,
});

const recentDeploys = [
  { id: "d-248", env: "Production", branch: "main",     status: "success", time: "2h ago",  duration: "38s",  commit: "feat(auth): supabase session" },
  { id: "d-247", env: "Preview",    branch: "feat/billing", status: "success", time: "4h ago", duration: "42s", commit: "billing: stripe webhook" },
  { id: "d-246", env: "Production", branch: "main",     status: "failed",  time: "1d ago",  duration: "21s",  commit: "infra: bump deps" },
  { id: "d-245", env: "Preview",    branch: "feat/admin",   status: "building", time: "1d ago", duration: "—",   commit: "admin: roles ui" },
];

const openIssues = [
  { id: "I-114", title: "Supabase RLS missing on `profiles`",    project: "Atlas Ops",      severity: "critical" as const },
  { id: "I-113", title: "Vercel: stale env vars on production",  project: "Aurora SaaS",    severity: "warning"  as const },
  { id: "I-112", title: "Lighthouse: 2 routes missing og:image", project: "Lumen Marketing",severity: "info"     as const },
];

const connections = [
  { id: "github",   name: "GitHub",   icon: Github,   ok: true,  detail: "skky-group · 5 repos synced" },
  { id: "supabase", name: "Supabase", icon: Database, ok: true,  detail: "yawb-prod · 12 tables · RLS warn" },
  { id: "vercel",   name: "Vercel",   icon: Triangle, ok: false, detail: "Not connected — link to deploy" },
  { id: "auth",     name: "Auth",     icon: ShieldCheck, ok: true, detail: "Email + Google · Profiles + Roles" },
  { id: "secrets",  name: "Secrets",  icon: KeyRound, ok: true,  detail: "8 runtime · 0 unused" },
];

function Workspace() {
  const healthy = projects.filter((p) => p.status === "healthy").length;
  const overall = Math.round(projects.reduce((a, p) => a + p.health, 0) / projects.length);

  return (
    <div className="px-5 md:px-8 py-6 max-w-[1400px] mx-auto space-y-7">
      {/* Hero / status card */}
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-card shadow-elevated">
        <div className="absolute inset-0 dot-bg opacity-40 pointer-events-none" />
        <div className="absolute -top-24 -right-20 w-[420px] h-[420px] rounded-full bg-foreground/[0.04] blur-3xl pointer-events-none" />
        <div className="relative p-7 md:p-9">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full glass px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              All systems operational
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span>{healthy}/{projects.length} projects healthy</span>
          </div>

          <h1 className="mt-4 text-balance text-[34px] md:text-[44px] leading-[1.05] font-display font-bold tracking-[-0.035em] max-w-3xl">
            Build, repair and ship <span className="text-gradient-soft">production apps</span><br className="hidden md:block" />
            from a single intelligent workspace.
          </h1>
          <p className="mt-3 text-[15px] text-muted-foreground max-w-2xl text-pretty">
            yawB is your production-first AI builder. Spin up apps from a prompt, import existing
            GitHub repos, repair live issues, and deploy — without leaving the canvas.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button asChild variant="hero" size="lg"><Link to="/create"><Sparkles className="h-4 w-4" /> Create new app</Link></Button>
            <Button asChild variant="glass" size="lg"><Link to="/import"><GitBranch className="h-4 w-4" /> Import GitHub repo</Link></Button>
            <Button asChild variant="glass" size="lg"><Link to="/health"><Wrench className="h-4 w-4" /> Repair issue</Link></Button>
            <Button asChild variant="glass" size="lg"><Link to="/deploys"><Rocket className="h-4 w-4" /> Deploy</Link></Button>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Stat label="Active projects"  value={String(projects.length)} hint="+2 this month" icon={Rocket}        />
        <Stat label="Health score"     value={`${overall}%`}           hint="+4% w/w"       icon={ShieldCheck} accent="success" />
        <Stat label="Deploys this week"value="23"                       hint="+8 vs last"    icon={Zap}         />
        <Stat label="Open issues"      value="16"                       hint="−4 today"      icon={AlertTriangle} accent="warning" />
      </section>

      {/* Canvas grid */}
      <section className="grid grid-cols-12 gap-5">
        {/* App preview */}
        <div className="col-span-12 lg:col-span-8">
          <Panel
            title="App preview"
            subtitle="Skky Customer Portal · production"
            actions={
              <>
                <Button variant="ghost" size="sm"><RefreshCw className="h-3.5 w-3.5" /> Reload</Button>
                <Button variant="glass" size="sm"><ExternalLink className="h-3.5 w-3.5" /> Open</Button>
              </>
            }
          >
            <div className="relative rounded-2xl border border-white/10 bg-background/60 overflow-hidden">
              {/* faux browser chrome */}
              <div className="flex items-center gap-2 px-3 h-9 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                </div>
                <div className="flex-1 mx-3 h-6 rounded-md bg-white/[0.04] border border-white/5 px-2 flex items-center text-[11px] text-muted-foreground font-mono">
                  https://portal.skky.group
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7"><Play className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="aspect-[16/9] grid-bg relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/60" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-white/95 to-white/55 text-[oklch(0.16_0_0)] flex items-center justify-center font-display font-bold text-xl shadow-elevated">
                    S
                  </div>
                  <div className="font-display font-semibold text-lg tracking-tight">Skky Customer Portal</div>
                  <div className="text-xs text-muted-foreground max-w-sm text-pretty">
                    Live preview is sandboxed. Click Reload to refresh, or open the production URL.
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="hero" size="sm"><Play className="h-3.5 w-3.5" /> Run preview</Button>
                    <Button variant="glass" size="sm">Open in builder</Button>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* Build health score */}
        <div className="col-span-12 lg:col-span-4">
          <Panel
            title="Build health"
            subtitle={`${overall}% production readiness`}
            actions={<Button variant="ghost" size="sm"><RefreshCw className="h-3.5 w-3.5" /> Re-scan</Button>}
          >
            <HealthScore score={overall} />
            <ul className="mt-4 space-y-1.5">
              {healthChecks.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/[0.03]">
                  <HealthIcon status={c.status} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium truncate">{c.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{c.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Recent deploys */}
        <div className="col-span-12 lg:col-span-7">
          <Panel
            title="Recent deploys"
            subtitle="Production & preview activity"
            actions={<Button asChild variant="ghost" size="sm"><Link to="/deploys">View all <ArrowRight className="h-3.5 w-3.5" /></Link></Button>}
          >
            <div className="rounded-xl border border-white/5 overflow-hidden">
              {recentDeploys.map((d, i) => (
                <div
                  key={d.id}
                  className={cn(
                    "grid grid-cols-12 items-center gap-3 px-3.5 py-2.5 text-[12.5px]",
                    i !== recentDeploys.length - 1 && "border-b border-white/5",
                    "hover:bg-white/[0.03]",
                  )}
                >
                  <div className="col-span-1"><DeployStatus status={d.status as "success" | "failed" | "building"} /></div>
                  <div className="col-span-5 min-w-0">
                    <div className="font-medium truncate">{d.commit}</div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">{d.id} · {d.branch}</div>
                  </div>
                  <div className="col-span-2 text-[11px] text-muted-foreground">{d.env}</div>
                  <div className="col-span-2 text-[11px] text-muted-foreground inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {d.time}</div>
                  <div className="col-span-1 text-[11px] text-muted-foreground num text-right">{d.duration}</div>
                  <div className="col-span-1 text-right">
                    <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Open issues */}
        <div className="col-span-12 lg:col-span-5">
          <Panel
            title="Open issues"
            subtitle="Detected across your projects"
            actions={<Button asChild variant="ghost" size="sm"><Link to="/health">All issues <ArrowRight className="h-3.5 w-3.5" /></Link></Button>}
          >
            <ul className="space-y-2">
              {openIssues.map((i) => (
                <li
                  key={i.id}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:bg-white/[0.04] hover:border-white/10 transition"
                >
                  <div className="flex items-start gap-3">
                    <SeverityDot severity={i.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium leading-tight text-pretty">{i.title}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {i.project} · <span className="font-mono">{i.id}</span>
                      </div>
                    </div>
                    <Button variant="glass" size="sm"><Wrench className="h-3.5 w-3.5" /> Repair</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Connected services */}
        <div className="col-span-12">
          <Panel
            title="Connected services"
            subtitle="Production wiring across your stack"
            actions={<Button asChild variant="glass" size="sm"><Link to="/connectors">Manage <ArrowRight className="h-3.5 w-3.5" /></Link></Button>}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {connections.map((c) => (
                <div key={c.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 hover:bg-white/[0.04] transition">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center">
                      <c.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium">{c.name}</div>
                      <div className={cn(
                        "inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em]",
                        c.ok ? "text-success" : "text-muted-foreground",
                      )}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", c.ok ? "bg-success" : "bg-muted-foreground/40")} />
                        {c.ok ? "Connected" : "Not connected"}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-[11.5px] text-muted-foreground line-clamp-2 text-pretty">{c.detail}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      {/* Recent projects */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-lg font-display font-semibold tracking-tight">Recent projects</h2>
            <p className="text-[12px] text-muted-foreground">Jump back into any workspace</p>
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/projects">View all <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.slice(0, 3).map((p) => (
            <Link
              key={p.id}
              to="/builder/$projectId"
              params={{ projectId: p.id }}
              className="group rounded-2xl border border-white/5 bg-gradient-card p-4 hover:border-white/15 hover:shadow-elevated transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display font-semibold text-[15px] tracking-tight truncate">{p.name}</div>
                  <div className="text-[11.5px] text-muted-foreground truncate">{p.url}</div>
                </div>
                <span className={cn(
                  "text-[10px] uppercase tracking-[0.16em] rounded-full px-2 py-0.5 border",
                  p.status === "healthy"  && "border-success/30 bg-success/10 text-success",
                  p.status === "warning"  && "border-warning/30 bg-warning/10 text-warning",
                  p.status === "critical" && "border-destructive/30 bg-destructive/10 text-destructive",
                  p.status === "building" && "border-foreground/20 bg-white/[0.06] text-foreground",
                )}>{p.status}</span>
              </div>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> {p.health}%</span>
                <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" /> {p.framework}</span>
              </div>
              <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-gradient-brand" style={{ width: `${p.health}%` }} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

/* -------------------------------- helpers -------------------------------- */

function Panel({
  title, subtitle, actions, children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-4 md:p-5 shadow-elevated">
      <div className="flex items-center justify-between mb-3.5 gap-3">
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-display font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11.5px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
      </div>
      {children}
    </div>
  );
}

function Stat({
  label, value, hint, icon: Icon, accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "success" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-4 hover:border-white/10 transition">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        <Icon className={cn(
          "h-4 w-4",
          accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-foreground/70",
        )} />
      </div>
      <div className="mt-2.5 text-[28px] leading-none font-display font-bold num tracking-[-0.02em]">{value}</div>
      <div className={cn(
        "mt-1.5 text-[11px]",
        accent === "warning" ? "text-warning" : "text-success",
      )}>{hint}</div>
    </div>
  );
}

function HealthScore({ score }: { score: number }) {
  const tone = score >= 90 ? "success" : score >= 70 ? "warning" : "destructive";
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="oklch(1 0 0 / 0.08)" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={`var(--color-${tone})`}
            strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${score}, 100`}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display font-bold text-lg num">{score}</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-medium">Production readiness</div>
        <div className="text-[11.5px] text-muted-foreground text-pretty">
          {score >= 90 ? "Excellent — safe to deploy." :
           score >= 70 ? "Solid, with a few warnings to review." :
                        "Critical issues detected. Run repair."}
        </div>
      </div>
    </div>
  );
}

function HealthIcon({ status }: { status: "pass" | "warn" | "fail" }) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-warning" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function DeployStatus({ status }: { status: "success" | "failed" | "building" }) {
  if (status === "success")
    return <span className="inline-flex items-center gap-1.5 text-success text-[11px]"><CheckCircle2 className="h-3.5 w-3.5" /> ok</span>;
  if (status === "failed")
    return <span className="inline-flex items-center gap-1.5 text-destructive text-[11px]"><XCircle className="h-3.5 w-3.5" /> fail</span>;
  return <span className="inline-flex items-center gap-1.5 text-warning text-[11px]"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> run</span>;
}

function SeverityDot({ severity }: { severity: "critical" | "warning" | "info" }) {
  const cls =
    severity === "critical" ? "bg-destructive" :
    severity === "warning"  ? "bg-warning" :
                              "bg-foreground/60";
  return <span className={cn("mt-1 h-2 w-2 rounded-full shrink-0", cls)} />;
}
