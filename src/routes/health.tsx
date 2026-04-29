import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle, XCircle, Wrench, ShieldCheck, Zap, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { healthChecks, projects } from "@/lib/demo-data";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Project Health — yawB" },
      { name: "description", content: "Detailed health report: build, dependencies, database, deployment and accessibility." },
    ],
  }),
  component: HealthPage,
});

const iconFor = (s: string) =>
  s === "pass" ? <CheckCircle2 className="h-5 w-5 text-success" /> :
  s === "warn" ? <AlertTriangle className="h-5 w-5 text-warning" /> :
                 <XCircle className="h-5 w-5 text-destructive" />;

function HealthPage() {
  const project = projects.find(p => p.id === "atlas-ops")!;
  const failing = healthChecks.filter(c => c.status !== "pass").length;

  return (
    <div className="px-6 md:px-10 py-10 max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Project Health</div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground mt-1">{project.github} · {project.framework}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="glass" size="lg"><ShieldCheck /> Re-scan</Button>
          <Button variant="hero" size="lg"><Wrench /> Auto-repair {failing} issues</Button>
        </div>
      </div>

      {/* Score */}
      <div className="grid md:grid-cols-3 gap-5 mb-8">
        <div className="md:col-span-1 rounded-3xl border border-white/5 bg-gradient-card p-6 text-center shadow-elevated">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Overall score</div>
          <div className="my-4 text-7xl font-display font-bold text-gradient-brand tabular-nums">{project.health}</div>
          <div className="text-sm text-muted-foreground">out of 100</div>
          <div className="mt-5 h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-gradient-brand" style={{ width: `${project.health}%` }} />
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-3 gap-4">
          {[
            { label: "Build", value: "Passing", icon: Zap, tone: "text-success" },
            { label: "Database", value: "2 missing", icon: Database, tone: "text-destructive" },
            { label: "Security", value: "1 warn", icon: ShieldCheck, tone: "text-warning" },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-white/5 bg-gradient-card p-5">
              <c.icon className={`h-5 w-5 ${c.tone}`} />
              <div className="mt-4 text-xs text-muted-foreground">{c.label}</div>
              <div className="text-lg font-display font-semibold">{c.value}</div>
            </div>
          ))}
          <div className="col-span-3 rounded-2xl border border-warning/20 bg-warning/5 p-4 text-sm">
            <span className="font-medium text-warning">Heads up:</span>
            <span className="text-muted-foreground"> Supabase database is missing tables referenced in code. Auto-repair will create them with RLS enabled.</span>
          </div>
        </div>
      </div>

      {/* Checks list */}
      <div className="rounded-3xl border border-white/5 bg-gradient-card overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-display font-semibold">Diagnostic checks</h2>
          <span className="text-xs text-muted-foreground">{healthChecks.length} checks · last run 2m ago</span>
        </div>
        <ul className="divide-y divide-white/5">
          {healthChecks.map((c) => (
            <li key={c.id} className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02]">
              {iconFor(c.status)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-muted-foreground truncate">{c.detail}</div>
              </div>
              {c.status !== "pass" && (
                <Button variant="soft" size="sm"><Wrench className="h-3.5 w-3.5" /> Repair</Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
