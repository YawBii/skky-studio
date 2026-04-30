// Per-project Jobs / Activity panel. Shows queued/running/succeeded/failed
// jobs with their steps, logs, retry/cancel controls, and a small affordance
// to enqueue common job types.
import { useState } from "react";
import { Loader2, Play, RotateCcw, X, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Circle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProjectJobs } from "@/hooks/use-project-jobs";
import { JOB_TYPES, type Job, type JobStep, type JobType } from "@/services/jobs";

interface JobsPanelProps {
  projectId: string | null;
  workspaceId: string | null;
  className?: string;
}

const QUICK_JOBS: { type: JobType; title: string }[] = [
  { type: "build.typecheck", title: "Run TypeScript check" },
  { type: "build.production", title: "Run production build" },
  { type: "vercel.create_preview_deploy", title: "Create preview deploy" },
  { type: "github.commit_changes", title: "Commit pending changes" },
];

export function JobsPanel({ projectId, workspaceId, className }: JobsPanelProps) {
  const { jobs, source, error, sqlFile, loading, ticking, stepsByJob, enqueue, cancel, retry, refreshSteps } =
    useProjectJobs(projectId, workspaceId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [enqueuing, setEnqueuing] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
    if (!stepsByJob[id]) void refreshSteps(id);
  };

  const onQuick = async (q: { type: JobType; title: string }) => {
    setEnqueuing(q.type);
    await enqueue({ type: q.type, title: q.title });
    setEnqueuing(null);
  };

  if (!projectId) {
    return (
      <div className={cn("p-6 text-[13px] text-muted-foreground", className)}>
        Select a project to see its jobs.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="px-4 h-12 border-b border-white/5 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <div className="text-[13px] font-medium">Jobs</div>
        {ticking && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        <span className="ml-auto text-[11px] text-muted-foreground">{jobs.length} total</span>
      </div>

      <div className="px-4 py-3 border-b border-white/5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Run job</div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_JOBS.map((q) => (
            <Button key={q.type} size="sm" variant="outline"
              disabled={enqueuing === q.type || !workspaceId}
              onClick={() => onQuick(q)}
              className="h-7 text-[11.5px]"
            >
              {enqueuing === q.type ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              {q.title}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {source === "table-missing" && (
          <EmptyMissingTable error={error} sqlFile={sqlFile} />
        )}
        {source === "error" && (
          <div className="p-6 text-[12px] text-destructive">
            <AlertTriangle className="h-4 w-4 mb-2" />
            Couldn't load jobs: {error}
          </div>
        )}
        {(source === "empty" || (source === "supabase" && jobs.length === 0)) && (
          <div className="p-6 text-[12.5px] text-muted-foreground">
            No jobs yet. Use “Run job” above or ask the assistant to enqueue one.
          </div>
        )}
        {loading && jobs.length === 0 && (
          <div className="p-6 text-[12px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin inline mr-1.5" /> Loading jobs…</div>
        )}
        <ul className="divide-y divide-white/5">
          {jobs.map((j) => (
            <JobRow key={j.id}
              job={j}
              expanded={!!expanded[j.id]}
              steps={stepsByJob[j.id] ?? []}
              onToggle={() => toggle(j.id)}
              onCancel={() => cancel(j.id)}
              onRetry={() => retry(j.id)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function EmptyMissingTable({ error, sqlFile }: { error: string | null; sqlFile: string | null }) {
  return (
    <div className="p-6 text-[12.5px] text-muted-foreground">
      <div className="flex items-center gap-2 text-warning mb-2">
        <AlertTriangle className="h-4 w-4" /> <span className="font-medium">Job tables are not installed yet</span>
      </div>
      <p className="mb-2">Run the SQL migration to create <code className="text-foreground">project_jobs</code>, <code className="text-foreground">project_job_steps</code>, and <code className="text-foreground">project_secrets</code>.</p>
      {sqlFile && <p className="font-mono text-[11px] text-foreground/80">{sqlFile}</p>}
      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function JobRow({ job, expanded, steps, onToggle, onCancel, onRetry }: {
  job: Job;
  expanded: boolean;
  steps: JobStep[];
  onToggle: () => void;
  onCancel: () => Promise<unknown>;
  onRetry: () => Promise<unknown>;
}) {
  const canCancel = job.status === "queued" || job.status === "running";
  const canRetry = job.status === "failed" || job.status === "cancelled";

  return (
    <li className="px-4 py-2.5">
      <div className="flex items-center gap-2">
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <StatusDot status={job.status} />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] truncate">{job.title}</div>
          <div className="text-[10.5px] text-muted-foreground font-mono truncate">
            {job.type} · {new Date(job.createdAt).toLocaleTimeString()}
            {job.retryCount > 0 && ` · retry ${job.retryCount}`}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canCancel && (
            <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => void onCancel()} title="Cancel">
              <X className="h-3 w-3" />
            </Button>
          )}
          {canRetry && (
            <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => void onRetry()} title="Retry">
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {job.error && (
        <div className="mt-1.5 ml-6 text-[11px] text-destructive whitespace-pre-wrap">{job.error}</div>
      )}

      {expanded && (
        <div className="mt-2 ml-6 space-y-1.5">
          {steps.length === 0 && (
            <div className="text-[11px] text-muted-foreground">No steps recorded.</div>
          )}
          {steps.map((s) => <StepRow key={s.id} step={s} />)}
        </div>
      )}
    </li>
  );
}

function StepRow({ step }: { step: JobStep }) {
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <StatusDot status={step.status} />
        <div className="text-[12px] flex-1 truncate">{step.title}</div>
        <span className="text-[10px] text-muted-foreground font-mono">{step.stepKey}</span>
      </div>
      {step.error && <div className="mt-1 text-[11px] text-destructive whitespace-pre-wrap">{step.error}</div>}
      {step.logs && step.logs.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {step.logs.slice(-4).map((l, i) => (
            <li key={i} className="text-[10.5px] text-muted-foreground font-mono truncate">
              <span className="text-foreground/60">{new Date(l.ts).toLocaleTimeString()}</span> {l.msg}
            </li>
          ))}
        </ul>
      )}
      {(step.startedAt || step.finishedAt) && (
        <div className="mt-1 text-[10px] text-muted-foreground/70 font-mono">
          {step.startedAt && `start ${new Date(step.startedAt).toLocaleTimeString()}`}
          {step.finishedAt && ` · end ${new Date(step.finishedAt).toLocaleTimeString()}`}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "running") return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
  if (status === "succeeded") return <CheckCircle2 className="h-3 w-3 text-success" />;
  if (status === "failed") return <X className="h-3 w-3 text-destructive" />;
  if (status === "cancelled") return <X className="h-3 w-3 text-muted-foreground" />;
  if (status === "skipped") return <Circle className="h-3 w-3 text-muted-foreground/60" />;
  return <Circle className="h-3 w-3 text-muted-foreground" />;
}

// Re-export so consumers can build their own quick job buttons.
export { JOB_TYPES };
