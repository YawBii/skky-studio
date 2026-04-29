import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Terminal, Search, ExternalLink, KeyRound, FileCode2, CheckCircle2, Circle,
  CircleDashed, CircleDot, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { codexChecklist, summarize, type WiringStatus } from "@/lib/codex-checklist";

export const Route = createFileRoute("/codex")({
  head: () => ({
    meta: [
      { title: "Codex wiring checklist · yawB" },
      { name: "description", content: "Per-service TODO checklist showing which yawB stubs are ready to be wired to real APIs." },
    ],
  }),
  component: CodexPage,
});

const FILTERS: { id: WiringStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "todo", label: "TODO" },
  { id: "in-progress", label: "In progress" },
  { id: "ready", label: "Ready" },
  { id: "wired", label: "Wired" },
];

function CodexPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<WiringStatus | "all">("all");
  const summary = useMemo(() => summarize(codexChecklist), []);
  const progress = (summary.wired / summary.total) * 100;

  const filtered = useMemo(() => {
    return codexChecklist
      .map((s) => ({
        ...s,
        functions: s.functions.filter((f) => {
          const matchesQ = !q ||
            s.service.toLowerCase().includes(q.toLowerCase()) ||
            f.name.toLowerCase().includes(q.toLowerCase()) ||
            s.file.toLowerCase().includes(q.toLowerCase());
          const matchesFilter = filter === "all" || f.status === filter;
          return matchesQ && matchesFilter;
        }),
      }))
      .filter((s) => s.functions.length > 0);
  }, [q, filter]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex items-start gap-4">
        <span className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 grid place-items-center">
          <Terminal className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="font-display font-semibold text-2xl">Codex wiring checklist</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every demo stub in <span className="font-mono">src/services/*</span> grouped by integration. Replace the body, flip the status to <span className="text-success">wired</span>.
          </p>
        </div>
      </header>

      {/* Summary */}
      <div className="rounded-2xl border border-white/5 bg-gradient-card p-5">
        <div className="flex items-center gap-6 flex-wrap">
          <Stat label="Total" value={summary.total} />
          <Stat label="TODO" value={summary.todo} tone="muted" />
          <Stat label="In progress" value={summary.inProgress} tone="primary" />
          <Stat label="Ready" value={summary.ready} tone="warning" />
          <Stat label="Wired" value={summary.wired} tone="success" />
          <div className="ml-auto text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Progress</div>
            <div className="text-2xl font-display font-semibold">{progress.toFixed(0)}%</div>
          </div>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full bg-success transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search service, function, file…"
            className="h-9 pl-8 bg-white/5 border-white/10 text-xs"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground ml-2" />
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "h-7 rounded-md px-3 text-xs transition-colors",
                filter === f.id ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Service cards */}
      <div className="space-y-4">
        {filtered.map((s) => (
          <section key={s.id} className="rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3 flex-wrap">
              <div className="min-w-0">
                <h2 className="font-display font-semibold">{s.service}</h2>
                <div className="text-[11px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
                  <FileCode2 className="h-3 w-3" /> {s.file}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border border-white/10 rounded px-2 py-0.5">
                  {s.provider}
                </span>
                {s.docs !== "internal" && (
                  <Button asChild variant="soft" size="sm">
                    <a href={s.docs} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3 w-3" /> Docs
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {s.envVars.length > 0 && (
              <div className="px-5 py-2.5 border-b border-white/5 flex items-center gap-2 flex-wrap text-[11px]">
                <KeyRound className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Required env:</span>
                {s.envVars.map((v) => (
                  <code key={v} className="font-mono bg-white/5 border border-white/10 rounded px-1.5 py-0.5">{v}</code>
                ))}
              </div>
            )}

            <div className="divide-y divide-white/5">
              {s.functions.map((f) => (
                <div key={f.name} className="px-5 py-3 flex items-start gap-3 hover:bg-white/[0.02]">
                  <StatusIcon status={f.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono font-medium">{f.name}</code>
                      <code className="text-xs font-mono text-muted-foreground truncate">{f.signature}</code>
                    </div>
                    {f.notes && (
                      <div className="text-[11px] text-muted-foreground mt-1">{f.notes}</div>
                    )}
                  </div>
                  <span className={cn("text-[10px] uppercase tracking-[0.18em] shrink-0", statusTone(f.status))}>
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
            No functions match these filters.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "muted" | "primary" | "warning" | "success" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-display font-semibold tabular-nums",
        tone === "success" && "text-success",
        tone === "warning" && "text-warning",
        tone === "primary" && "text-primary",
      )}>{value}</div>
    </div>
  );
}

function StatusIcon({ status }: { status: WiringStatus }) {
  if (status === "wired") return <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />;
  if (status === "ready") return <CircleDot className="h-4 w-4 text-warning mt-0.5" />;
  if (status === "in-progress") return <CircleDashed className="h-4 w-4 text-primary mt-0.5" />;
  return <Circle className="h-4 w-4 text-muted-foreground mt-0.5" />;
}

function statusTone(s: WiringStatus) {
  if (s === "wired") return "text-success";
  if (s === "ready") return "text-warning";
  if (s === "in-progress") return "text-primary";
  return "text-muted-foreground";
}
