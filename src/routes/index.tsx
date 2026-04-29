import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, GitBranch, Activity, ArrowRight, Zap, ShieldCheck, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/project-card";
import { projects } from "@/lib/demo-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — yawB" },
      { name: "description", content: "Your production app dashboard. Create new apps or maintain existing projects." },
    ],
  }),
  component: Dashboard,
});

const stats = [
  { label: "Active projects", value: "5", trend: "+2 this month", icon: Rocket },
  { label: "Avg. health score", value: "79%", trend: "+4% w/w", icon: ShieldCheck },
  { label: "Deploys this week", value: "23", trend: "+8 vs last week", icon: Zap },
  { label: "Issues to repair", value: "16", trend: "−4 today", icon: Activity },
];

function Dashboard() {
  const healthy = projects.filter(p => p.status === "healthy").length;
  return (
    <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-card p-8 md:p-10 mb-8 shadow-elevated">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute -top-40 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            All systems operational · {healthy} of {projects.length} projects healthy
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight max-w-2xl">
            Build, repair and ship <span className="text-gradient-brand">production apps</span> with AI.
          </h1>
          <p className="mt-4 text-muted-foreground max-w-xl">
            yawB is your production-first AI builder. Spin up new apps from a prompt,
            or import existing GitHub, Vercel and Supabase projects to upgrade and maintain them.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/create"><Sparkles /> Create new app</Link>
            </Button>
            <Button asChild variant="glass" size="lg">
              <Link to="/import"><GitBranch /> Import existing project</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/5 bg-gradient-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 text-3xl font-display font-bold tabular-nums">{s.value}</div>
            <div className="mt-1 text-xs text-success">{s.trend}</div>
          </div>
        ))}
      </section>

      {/* Projects */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-display font-semibold">Your projects</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/projects">View all <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
