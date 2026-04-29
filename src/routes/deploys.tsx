import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Rocket, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, Copy, Check,
  ExternalLink, GitBranch, ChevronRight, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { deployRuns, type DeployRun, type LogStage, type StageStatus } from "@/lib/deploy-logs";

export const Route = createFileRoute("/deploys")({
  head: () => ({
    meta: [
      { title: "Deploy logs · yawB" },
      { name: "description", content: "Vercel deploy logs with status timeline, error grouping and copyable snippets." },
    ],
  }),
  component: DeploysPage,
});

function DeploysPage() {
  const [selectedId, setSelectedId] = useState(deployRuns[0].id);
  const selected = deployRuns.find((r) => r.id === selectedId)!;

  return (
    <div className="flex h-screen">
      {/* Run list */}
      <aside className="w-80 shrink-0 border-r border-white/5 bg-sidebar/40 flex flex-col">
        <div className="h-14 border-b border-white/5 px-4 flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          <span className="font-display font-semibold">Deploys</span>
          <Link to="/" className="ml-auto text-xs text-muted-foreground hover:text-foreground">← Back</Link>
        </div>
        <div className="p-3 border-b border-white/5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by sha, branch…" className="h-9 pl-8 bg-white/5 border-white/10 text-xs" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {deployRuns.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={cn(
                "w-full text-left rounded-lg px-3 py-2.5 transition-colors",
                selectedId === r.id ? "bg-white/[0.07]" : "hover:bg-white/[0.04]",
              )}
            >
              <div className="flex items-center gap-2">
                <RunIcon status={r.status} />
                <span className="text-sm font-medium truncate">{r.commitMessage}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono">
                <GitBranch className="h-3 w-3" />
                <span className="truncate">{r.branch}</span>
                <span>·</span>
                <span>{r.commitSha}</span>
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>{r.target}</span>
                <span>{r.triggeredAt}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Detail */}
      <section className="flex-1 min-w-0 overflow-y-auto">
        <DeployDetail run={selected} />
      </section>
    </div>
  );
}

function DeployDetail({ run }: { run: DeployRun }) {
  const [activeStage, setActiveStage] = useState<string>(
    run.stages.find((s) => s.status === "error")?.id ?? run.stages[run.stages.length - 1].id,
  );
  const stage = run.stages.find((s) => s.id === activeStage) ?? run.stages[0];
  const totalDuration = useMemo(
    () => run.stages.reduce((acc, s) => acc + s.durationMs, 0),
    [run],
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <header className="flex items-start gap-4">
        <RunIcon status={run.status} large />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-semibold text-lg truncate">{run.commitMessage}</h1>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border border-white/10 rounded px-1.5 py-0.5">
              {run.target}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground font-mono flex items-center gap-2 flex-wrap">
            <GitBranch className="h-3 w-3" />
            <span>{run.branch}</span>
            <span>·</span>
            <span>{run.commitSha}</span>
            <span>·</span>
            <span>by {run.author}</span>
            <span>·</span>
            <span>{run.triggeredAt}</span>
            <span>·</span>
            <span>region {run.region}</span>
            <span>·</span>
            <span>{(totalDuration / 1000).toFixed(1)}s</span>
          </div>
        </div>
        <Button variant="glass" size="sm" asChild>
          <a href={`https://${run.url}`} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> Visit
          </a>
        </Button>
        <Button variant="hero" size="sm">
          <Rocket className="h-3.5 w-3.5" /> Redeploy
        </Button>
      </header>

      {/* Status timeline */}
      <Timeline stages={run.stages} active={activeStage} onSelect={setActiveStage} />

      {/* Error groups */}
      {run.errorGroups.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="font-display font-semibold">
              {run.errorGroups.length} error group{run.errorGroups.length > 1 ? "s" : ""}
            </h2>
          </div>
          <div className="space-y-3">
            {run.errorGroups.map((g) => (
              <div key={g.id} className="rounded-2xl border border-destructive/20 bg-destructive/[0.03] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3 border-b border-destructive/15">
                  <span className="h-6 w-6 rounded-md bg-destructive/15 text-destructive grid place-items-center text-[11px] font-semibold">
                    {g.count}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{g.signature}</div>
                    <div className="text-[11px] text-muted-foreground">First seen in <span className="font-mono">{g.firstStage}</span></div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveStage(g.firstStage)}>
                    Jump to logs <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <CopyableSnippet snippet={g.snippet} />
                <div className="px-4 py-2.5 text-xs text-muted-foreground border-t border-destructive/10 flex items-start gap-2">
                  <span className="text-destructive">Hint</span>
                  <span>{g.hint}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Logs for active stage */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-semibold">Logs · {stage.label}</h2>
          <span className="text-[11px] text-muted-foreground">({(stage.durationMs / 1000).toFixed(1)}s)</span>
          <CopyButton className="ml-auto" text={stage.lines.map((l) => `${l.ts}  ${l.text}`).join("\n")}>
            Copy all
          </CopyButton>
        </div>
        <LogStream stage={stage} />
      </section>
    </div>
  );
}

function Timeline({ stages, active, onSelect }: {
  stages: LogStage[]; active: string; onSelect: (id: string) => void;
}) {
  const total = stages.reduce((a, s) => a + Math.max(s.durationMs, 200), 0);
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-4">
      <div className="flex items-center gap-1">
        {stages.map((s, i) => {
          const widthPct = (Math.max(s.durationMs, 200) / total) * 100;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={{ width: `${widthPct}%` }}
              className={cn(
                "group relative h-16 rounded-lg border transition-all overflow-hidden text-left px-3 py-2 min-w-[88px]",
                stageBorder(s.status),
                stageBg(s.status),
                active === s.id && "ring-2 ring-foreground/30",
              )}
            >
              <div className="flex items-center gap-1.5">
                <StageDot status={s.status} />
                <span className="text-[11px] font-medium truncate">{s.label}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                {s.status === "pending" ? "—" : `${(s.durationMs / 1000).toFixed(1)}s`}
              </div>
              {i < stages.length - 1 && (
                <div className="absolute top-1/2 -right-1 -translate-y-1/2 h-px w-2 bg-white/10" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LogStream({ stage }: { stage: LogStage }) {
  if (stage.lines.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-black/40 p-6 text-xs text-muted-foreground text-center">
        Stage hasn't run yet.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-white/5 bg-black/50 font-mono text-xs leading-relaxed overflow-hidden">
      {stage.lines.map((l, i) => (
        <div
          key={i}
          className={cn(
            "group flex items-start gap-3 px-4 py-1.5 hover:bg-white/[0.03]",
            l.level === "error" && "bg-destructive/[0.06]",
            l.level === "warn" && "bg-warning/[0.05]",
          )}
        >
          <span className="text-muted-foreground/50 select-none w-24 shrink-0">{l.ts}</span>
          <span className={cn(
            "uppercase text-[9px] tracking-[0.18em] w-12 shrink-0 mt-0.5",
            l.level === "error" && "text-destructive",
            l.level === "warn" && "text-warning",
            l.level === "success" && "text-success",
            l.level === "info" && "text-muted-foreground",
          )}>{l.level}</span>
          <span className={cn("flex-1 break-all",
            l.level === "error" ? "text-destructive" :
            l.level === "success" ? "text-success" :
            "text-foreground/85",
          )}>{l.text}</span>
          <CopyButton text={l.text} subtle />
        </div>
      ))}
    </div>
  );
}

function CopyableSnippet({ snippet }: { snippet: string }) {
  return (
    <div className="relative">
      <pre className="px-4 py-3 text-xs font-mono leading-relaxed overflow-x-auto text-foreground/85 bg-black/40">
        {snippet}
      </pre>
      <CopyButton text={snippet} className="absolute top-2 right-2" />
    </div>
  );
}

function CopyButton({ text, className, children, subtle }: {
  text: string; className?: string; children?: React.ReactNode; subtle?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };
  if (subtle) {
    return (
      <button
        onClick={onClick}
        className={cn("opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground", className)}
        aria-label="Copy line"
      >
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      </button>
    );
  }
  return (
    <Button onClick={onClick} variant="soft" size="sm" className={className}>
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {children ?? (copied ? "Copied" : "Copy")}
    </Button>
  );
}

function RunIcon({ status, large }: { status: DeployRun["status"]; large?: boolean }) {
  const cls = large ? "h-9 w-9" : "h-7 w-7";
  const inner = large ? "h-5 w-5" : "h-4 w-4";
  if (status === "READY") return <span className={cn(cls, "rounded-lg bg-success/15 text-success grid place-items-center")}><CheckCircle2 className={inner} /></span>;
  if (status === "ERROR") return <span className={cn(cls, "rounded-lg bg-destructive/15 text-destructive grid place-items-center")}><XCircle className={inner} /></span>;
  if (status === "BUILDING") return <span className={cn(cls, "rounded-lg bg-primary/15 text-primary grid place-items-center")}><Loader2 className={cn(inner, "animate-spin")} /></span>;
  return <span className={cn(cls, "rounded-lg bg-muted text-muted-foreground grid place-items-center")}><Clock className={inner} /></span>;
}

function StageDot({ status }: { status: StageStatus }) {
  if (status === "ok") return <CheckCircle2 className="h-3 w-3 text-success" />;
  if (status === "error") return <XCircle className="h-3 w-3 text-destructive" />;
  if (status === "warn") return <AlertTriangle className="h-3 w-3 text-warning" />;
  if (status === "running") return <Loader2 className="h-3 w-3 text-primary animate-spin" />;
  return <Clock className="h-3 w-3 text-muted-foreground" />;
}

function stageBorder(s: StageStatus) {
  return s === "error" ? "border-destructive/30"
    : s === "warn" ? "border-warning/30"
    : s === "ok" ? "border-success/20"
    : s === "running" ? "border-primary/30"
    : "border-white/5";
}
function stageBg(s: StageStatus) {
  return s === "error" ? "bg-destructive/[0.06] hover:bg-destructive/[0.1]"
    : s === "warn" ? "bg-warning/[0.06] hover:bg-warning/[0.1]"
    : s === "ok" ? "bg-success/[0.04] hover:bg-success/[0.08]"
    : s === "running" ? "bg-primary/[0.06] hover:bg-primary/[0.1]"
    : "bg-white/[0.02] hover:bg-white/[0.05]";
}
