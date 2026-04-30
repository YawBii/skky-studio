import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Sparkles, GitBranch, Wrench, Rocket, ArrowUp, ArrowRight, RefreshCw,
  ExternalLink, Play, CheckCircle2, AlertTriangle, XCircle, Circle, Loader2,
  Github, Database, Triangle, ShieldCheck, KeyRound, Globe, Code2,
  ListChecks, Edit3, Check, Layers, Boxes, Plug, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { lifecycle, samplePlan, readiness, type StepStatus } from "@/lib/lifecycle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workspace — yawB" },
      { name: "description", content: "Describe what to build. yawB plans, builds, previews and ships production apps." },
    ],
  }),
  component: Workspace,
});

type Mode = "build" | "import" | "repair" | "deploy";

const MODES: { id: Mode; label: string; icon: React.ComponentType<{ className?: string }>; hint: string; placeholder: string; suggestions: string[] }[] = [
  {
    id: "build",
    label: "Build",
    icon: Sparkles,
    hint: "Describe the app, dashboard or feature you want yawB to build.",
    placeholder: "Build a SaaS dashboard for managing subscriptions, with team auth, Stripe billing and an admin console…",
    suggestions: [
      "Build a SaaS dashboard for managing subscriptions",
      "Create a booking app with Supabase auth",
      "Generate an internal admin console from my Postgres schema",
    ],
  },
  {
    id: "import",
    label: "Import",
    icon: GitBranch,
    hint: "Paste a GitHub URL or describe the repo to import and harden for production.",
    placeholder: "Import github.com/skky-group/aurora and prepare it for production…",
    suggestions: [
      "Import my GitHub repo and fix production issues",
      "Import skky-group/atlas and add missing Supabase tables",
      "Pull in lumen-marketing and run a full health scan",
    ],
  },
  {
    id: "repair",
    label: "Repair",
    icon: Wrench,
    hint: "Paste an error, log line, or describe the production issue to fix.",
    placeholder: "Repair my failing Vercel deploy: 'Module not found: stripe'…",
    suggestions: [
      "Repair my failing Vercel deploy",
      "Fix Supabase RLS missing on `profiles`",
      "Investigate p95 latency spike on /api/orders",
    ],
  },
  {
    id: "deploy",
    label: "Deploy",
    icon: Rocket,
    hint: "Promote, rollback or schedule a production release.",
    placeholder: "Promote latest preview to production after the readiness checks pass…",
    suggestions: [
      "Promote preview to production",
      "Rollback to deploy d-246",
      "Schedule deploy for 22:00 UTC",
    ],
  },
];

function Workspace() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("build");
  const [prompt, setPrompt] = useState("");
  const [planApproved, setPlanApproved] = useState(false);

  const active = useMemo(() => MODES.find((m) => m.id === mode)!, [mode]);

  const startBuild = () => {
    if (!prompt.trim()) {
      toast("Describe what you want to build first.", { description: "Pick a suggestion or type your own prompt." });
      return;
    }
    if (mode === "import") return navigate({ to: "/import" });
    if (mode === "repair") return navigate({ to: "/health" });
    if (mode === "deploy") return navigate({ to: "/deploys" });
    navigate({ to: "/builder/$projectId", params: { projectId: "skky-portal" } });
  };

  const blockers = readiness.filter((r) => !r.ok && r.id !== "domain").length;
  const readyScore = Math.round((readiness.filter((r) => r.ok).length / readiness.length) * 100);

  return (
    <div className="px-5 md:px-8 py-6 max-w-[1280px] mx-auto space-y-7">
      {/* ========================== Hero composer ========================== */}
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-card shadow-elevated">
        <div className="absolute inset-0 dot-bg opacity-40 pointer-events-none" />
        <div className="absolute -top-24 -right-20 w-[420px] h-[420px] rounded-full bg-foreground/[0.04] blur-3xl pointer-events-none" />

        <div className="relative p-6 md:p-9">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full glass px-2.5 py-1">
              <Sparkles className="h-3 w-3" /> Production-first builder
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span>Prompt → Plan → Build → Preview → Test → Deploy</span>
          </div>

          <h1 className="mt-4 text-balance text-[32px] md:text-[44px] leading-[1.05] font-display font-bold tracking-[-0.035em] max-w-3xl">
            What do you want to <span className="text-gradient-soft">build today?</span>
          </h1>
          <p className="mt-2.5 text-[14.5px] text-muted-foreground max-w-2xl text-pretty">
            Describe an app, import a repo, repair a production issue or ship a deploy.
            yawB plans it, builds it, previews it and helps you fix anything before it goes live.
          </p>

          {/* Mode pills */}
          <div className="mt-6 inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {MODES.map((m) => {
              const isActive = m.id === mode;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg h-8 px-3 text-[12px] font-medium transition",
                    isActive
                      ? "bg-foreground text-background shadow-glow"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
                  )}
                >
                  <m.icon className="h-3.5 w-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Prompt composer */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-background/40 ring-hairline p-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder={active.placeholder}
              className="w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed placeholder:text-muted-foreground/70 focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-2 py-2">
              <p className="text-[11.5px] text-muted-foreground px-2">{active.hint}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toast("Coming next: voice & file attachments.")}
                >
                  Attach
                </Button>
                <Button variant="hero" size="lg" onClick={startBuild} disabled={!prompt.trim()}>
                  {mode === "build" && <>Plan & build <ArrowUp className="h-4 w-4 rotate-45" /></>}
                  {mode === "import" && <>Import repo <GitBranch className="h-4 w-4" /></>}
                  {mode === "repair" && <>Diagnose <Wrench className="h-4 w-4" /></>}
                  {mode === "deploy" && <>Continue <Rocket className="h-4 w-4" /></>}
                </Button>
              </div>
            </div>
          </div>

          {/* Suggestions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {active.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="text-left text-[12px] rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 px-3 py-1.5 transition text-muted-foreground hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ========================== Lifecycle timeline ========================== */}
      <Lifecycle />

      {/* ========================== Plan + Preview row ========================== */}
      <section className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-7">
          <PlanCard approved={planApproved} onApprove={() => { setPlanApproved(true); toast.success("Plan approved", { description: "yawB will start building now." }); }} />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <PreviewCard />
        </div>
      </section>

      {/* ========================== Publish + Connections ========================== */}
      <section className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-7">
          <PublishCard score={readyScore} blockers={blockers} />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <ConnectionsCard />
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- Lifecycle */

function Lifecycle() {
  return (
    <section className="rounded-2xl border border-white/5 bg-gradient-card p-4 md:p-5 shadow-elevated">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[13.5px] font-display font-semibold tracking-tight">Build lifecycle</h2>
          <p className="text-[11.5px] text-muted-foreground">Track each stage from prompt to production.</p>
        </div>
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Currently building step 3 of 6
        </span>
      </div>

      <ol className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {lifecycle.map((s, i) => (
          <li
            key={s.id}
            className={cn(
              "relative rounded-xl border p-3",
              s.status === "running"   ? "border-foreground/30 bg-white/[0.05]" :
              s.status === "done"      ? "border-success/25 bg-success/[0.06]" :
              s.status === "attention" ? "border-warning/30 bg-warning/[0.06]" :
                                         "border-white/5 bg-white/[0.02]",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground num">
                Step {i + 1}
              </span>
              <StepIcon status={s.status} />
            </div>
            <div className="mt-1.5 text-[13px] font-medium tracking-tight">{s.label}</div>
            <div className="text-[11px] text-muted-foreground text-pretty">{s.hint}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")      return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "running")   return <Loader2      className="h-4 w-4 text-foreground animate-spin" />;
  if (status === "attention") return <AlertTriangle className="h-4 w-4 text-warning" />;
  return <Circle className="h-4 w-4 text-muted-foreground/50" />;
}

/* ---------------------------------------------------------------- Plan card */

function PlanCard({ approved, onApprove }: { approved: boolean; onApprove: () => void }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-5 shadow-elevated h-full">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-foreground/80" />
            <h3 className="text-[14px] font-display font-semibold tracking-tight">Build plan</h3>
            <span className="rounded-full bg-white/[0.05] border border-white/10 text-[10px] uppercase tracking-[0.16em] text-muted-foreground px-2 py-0.5">
              {samplePlan.appType}
            </span>
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground text-pretty max-w-xl">
            {samplePlan.summary}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">ETA</div>
          <div className="text-[18px] font-display font-bold num leading-none mt-1">~{samplePlan.estimatedMinutes}m</div>
          <div className="text-[10.5px] text-muted-foreground mt-0.5">{samplePlan.estimatedSteps} steps</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <PlanBlock icon={Layers} title="Pages & routes">
          <ul className="space-y-1">
            {samplePlan.routes.map((r) => (
              <li key={r.path} className="flex items-baseline gap-2 text-[12px]">
                <span className="font-mono text-foreground/90">{r.path}</span>
                <span className="text-muted-foreground text-[11.5px] truncate">{r.purpose}</span>
              </li>
            ))}
          </ul>
        </PlanBlock>

        <PlanBlock icon={Boxes} title="Data model">
          <ul className="space-y-1">
            {samplePlan.models.map((m) => (
              <li key={m.name} className="text-[12px]">
                <span className="font-mono">{m.name}</span>
                <span className="text-[11px] text-muted-foreground"> · {m.fields}</span>
              </li>
            ))}
          </ul>
        </PlanBlock>

        <PlanBlock icon={Plug} title="Integrations">
          <div className="flex flex-wrap gap-1.5">
            {samplePlan.integrations.map((i) => (
              <span key={i} className="rounded-md border border-white/10 bg-white/[0.04] text-[11px] px-2 py-0.5">
                {i}
              </span>
            ))}
          </div>
        </PlanBlock>

        <PlanBlock icon={ShieldAlert} title="Risks">
          <ul className="space-y-1.5">
            {samplePlan.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px]">
                <span className={cn(
                  "mt-1 h-1.5 w-1.5 rounded-full shrink-0",
                  r.level === "high" ? "bg-destructive" : r.level === "med" ? "bg-warning" : "bg-foreground/50",
                )} />
                <span className="text-pretty">{r.text}</span>
              </li>
            ))}
          </ul>
        </PlanBlock>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
        <div className="text-[11.5px] text-muted-foreground">
          {approved ? "Plan approved — building in progress." : "Review the plan, then approve to start the build."}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => toast("Coming next: inline plan editor.")}>
            <Edit3 className="h-3.5 w-3.5" /> Edit plan
          </Button>
          <Button variant="glass" size="sm" onClick={() => toast("Re-planning…", { description: "yawB will re-scope the app." })}>
            <RefreshCw className="h-3.5 w-3.5" /> Re-plan
          </Button>
          {approved ? (
            <Button variant="hero" size="sm" disabled>
              <Check className="h-3.5 w-3.5" /> Approved
            </Button>
          ) : (
            <Button variant="hero" size="sm" onClick={onApprove}>
              <Check className="h-3.5 w-3.5" /> Approve plan
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanBlock({
  icon: Icon, title, children,
}: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- Preview card */

function PreviewCard() {
  const issues = 1; // demo
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-5 shadow-elevated h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[14px] font-display font-semibold tracking-tight">Live preview</h3>
          <p className="text-[11.5px] text-muted-foreground">portal.skky.group · sandbox</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 text-success text-[10.5px] px-2 py-0.5">
          <span className="h-1 w-1 rounded-full bg-success animate-pulse" /> Live
        </span>
      </div>

      <div className="rounded-xl border border-white/10 bg-background/60 overflow-hidden">
        <div className="flex items-center gap-2 px-3 h-9 border-b border-white/5 bg-white/[0.02]">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <div className="flex-1 mx-3 h-6 rounded-md bg-white/[0.04] border border-white/5 px-2 flex items-center text-[11px] text-muted-foreground font-mono truncate">
            https://portal.skky.group
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast("Refreshing preview…")}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="aspect-[16/10] grid-bg relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/60" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-white/95 to-white/55 text-[oklch(0.16_0_0)] flex items-center justify-center font-display font-bold text-lg shadow-elevated">
              S
            </div>
            <div className="font-display font-semibold tracking-tight">Skky Customer Portal</div>
            <div className="text-[11.5px] text-muted-foreground max-w-xs text-pretty">
              Preview is live. Open it in a new tab or refresh to see the latest build.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="glass" size="sm" onClick={() => window.open("https://portal.skky.group", "_blank")}>
          <ExternalLink className="h-3.5 w-3.5" /> Open preview
        </Button>
        <Button variant="ghost" size="sm" onClick={() => toast("Reloading preview sandbox…")}>
          <Play className="h-3.5 w-3.5" /> Refresh
        </Button>
        <Button asChild variant="ghost" size="sm" className="col-span-1">
          <Link to="/versions/$projectId" params={{ projectId: "skky-portal" }}>
            <Code2 className="h-3.5 w-3.5" /> View code changes
          </Link>
        </Button>
        {issues > 0 ? (
          <Button variant="hero" size="sm" onClick={() => toast.success("yawB is repairing the issue…")}>
            <Wrench className="h-3.5 w-3.5" /> Fix with yawB
          </Button>
        ) : (
          <span className="inline-flex items-center justify-center rounded-md text-[11.5px] text-success">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> No issues
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Publish card */

function PublishCard({ score, blockers }: { score: number; blockers: number }) {
  const tone = score >= 90 ? "success" : score >= 70 ? "warning" : "destructive";
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-5 shadow-elevated h-full">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[14px] font-display font-semibold tracking-tight">Publish to production</h3>
          <p className="text-[11.5px] text-muted-foreground">Resolve blockers, then ship.</p>
        </div>
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="oklch(1 0 0 / 0.08)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke={`var(--color-${tone})`}
              strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${score}, 100`}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className="font-display font-bold text-[15px] num">{score}</span>
          </div>
        </div>
      </div>

      <ul className="space-y-1.5">
        {readiness.map((r) => (
          <li
            key={r.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2",
              r.ok ? "border-white/5 bg-white/[0.02]" : "border-warning/25 bg-warning/[0.06]",
            )}
          >
            {r.ok ? (
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium">{r.label}</div>
              {!r.ok && r.fixHint && (
                <div className="text-[11px] text-muted-foreground truncate">{r.fixHint}</div>
              )}
            </div>
            {!r.ok && r.fixAction && (
              <Button
                variant="glass"
                size="sm"
                onClick={() => toast(`Coming next: ${r.fixAction}.`)}
              >
                {r.fixAction}
              </Button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
        <div className="text-[11.5px] text-muted-foreground">
          {blockers > 0
            ? <><span className="text-warning font-medium">{blockers} blocker{blockers > 1 ? "s" : ""}</span> before production.</>
            : "All checks passing — ready to deploy."}
        </div>
        <Button
          variant="hero"
          size="lg"
          disabled={blockers > 0}
          onClick={() => toast.success("Deploy queued", { description: "Promoting latest build to production." })}
        >
          <Rocket className="h-4 w-4" /> {blockers > 0 ? "Resolve blockers" : "Deploy to production"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Connections card */

const CONNECTIONS = [
  { id: "github",   name: "GitHub",   icon: Github,      ok: true,  detail: "skky-group · 5 repos synced" },
  { id: "supabase", name: "Supabase", icon: Database,    ok: true,  detail: "yawb-prod · 12 tables" },
  { id: "vercel",   name: "Vercel",   icon: Triangle,    ok: false, detail: "Not connected — required to ship", action: "Connect Vercel" },
  { id: "auth",     name: "Auth",     icon: ShieldCheck, ok: true,  detail: "Email + Google · Profiles & roles" },
  { id: "secrets",  name: "Secrets",  icon: KeyRound,    ok: true,  detail: "8 runtime · 0 unused" },
  { id: "domain",   name: "Domain",   icon: Globe,       ok: false, detail: "Optional — uses .lovable.app", action: "Add domain" },
];

function ConnectionsCard() {
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-5 shadow-elevated h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[14px] font-display font-semibold tracking-tight">Connected services</h3>
          <p className="text-[11.5px] text-muted-foreground">Production wiring across your stack.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/connectors">Manage <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </div>

      <ul className="space-y-2">
        {CONNECTIONS.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:bg-white/[0.04] transition"
          >
            <div className="h-8 w-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center">
              <c.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium">{c.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{c.detail}</div>
            </div>
            {c.ok ? (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Connected
              </span>
            ) : (
              <Button
                variant="glass"
                size="sm"
                onClick={() => toast(`Coming next: ${c.action}.`)}
              >
                {c.action}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* unused export to satisfy possible importers */
export { XCircle };
