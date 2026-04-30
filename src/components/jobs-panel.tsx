// Per-project Jobs / Activity panel. Shows queued/running/waiting/succeeded/
// failed jobs, their steps, logs, retry/cancel controls, interactive
// questions (Lovable-style), a strict proof report, runner diagnostics, and
// quick job-enqueue buttons.
import { useState } from "react";
import {
  Loader2, Play, RotateCcw, X, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, Circle, Activity, HelpCircle, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProjectJobs } from "@/hooks/use-project-jobs";
import { useDiagnostics } from "@/lib/diagnostics";
import { JOB_TYPES, type Job, type JobStep, type JobQuestion, type JobType, type StepAttempt } from "@/services/jobs";

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
  const {
    jobs, source, error, sqlFile, loading, ticking, lastTick,
    stepsByJob, questionsByJob, attemptsByJob,
    enqueue, cancel, retry, retryStep, answer, refreshSteps, refreshQuestions, refreshAttempts,
  } = useProjectJobs(projectId, workspaceId);
  const diag = useDiagnostics();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [enqueuing, setEnqueuing] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
    if (!stepsByJob[id]) void refreshSteps(id);
    if (!questionsByJob[id]) void refreshQuestions(id);
    if (!attemptsByJob[id]) void refreshAttempts(id);
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
        {source === "table-missing" && <EmptyMissingTable error={error} sqlFile={sqlFile} />}
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
              questions={questionsByJob[j.id] ?? []}
              onToggle={() => toggle(j.id)}
              onCancel={() => cancel(j.id)}
              onRetry={() => retry(j.id)}
              onAnswer={(input) => answer({ ...input, jobId: j.id })}
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
      <p className="mb-2">Run the SQL migrations to create <code className="text-foreground">project_jobs</code>, <code className="text-foreground">project_job_steps</code>, <code className="text-foreground">project_secrets</code>, and <code className="text-foreground">project_job_questions</code>.</p>
      {sqlFile && <p className="font-mono text-[11px] text-foreground/80">{sqlFile}</p>}
      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function JobRow({ job, expanded, steps, questions, onToggle, onCancel, onRetry, onAnswer }: {
  job: Job;
  expanded: boolean;
  steps: JobStep[];
  questions: JobQuestion[];
  onToggle: () => void;
  onCancel: () => Promise<unknown>;
  onRetry: () => Promise<unknown>;
  onAnswer: (input: { questionId: string; stepId: string | null; answer: unknown; skipped?: boolean }) => Promise<unknown>;
}) {
  const canCancel = job.status === "queued" || job.status === "running" || job.status === "waiting_for_input";
  const canRetry = job.status === "failed" || job.status === "cancelled";
  const openQuestion = questions.find((q) => !q.answeredAt);

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
            {job.status === "waiting_for_input" && " · awaiting answer"}
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

      {openQuestion && (
        <div className="mt-2 ml-6">
          <QuestionCard question={openQuestion} onAnswer={onAnswer} />
        </div>
      )}

      {expanded && (
        <div className="mt-2 ml-6 space-y-1.5">
          {steps.length === 0 && (
            <div className="text-[11px] text-muted-foreground">No steps recorded.</div>
          )}
          {steps.map((s) => <StepRow key={s.id} step={s} />)}
          {questions.length > 0 && <QuestionHistory questions={questions} />}
          {(job.status === "succeeded" || job.status === "failed") && steps.length > 0 && (
            <ProofReport steps={steps} jobError={job.error} />
          )}
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

function QuestionCard({ question, onAnswer }: {
  question: JobQuestion;
  onAnswer: (input: { questionId: string; stepId: string | null; answer: unknown; skipped?: boolean }) => Promise<unknown>;
}) {
  const [single, setSingle] = useState<string>("");
  const [multi, setMulti] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (skipped = false) => {
    setBusy(true);
    let answer: unknown;
    if (skipped) {
      answer = null;
    } else if (question.kind === "single_choice") {
      answer = single === "__other" ? { other: other.trim() } : single;
    } else if (question.kind === "multi_choice") {
      const picks = [...multi];
      if (picks.includes("__other") && other.trim()) {
        const idx = picks.indexOf("__other");
        picks[idx] = `other:${other.trim()}`;
      }
      answer = picks;
    } else if (question.kind === "confirm") {
      answer = single === "yes";
    } else {
      answer = text.trim();
    }
    await onAnswer({ questionId: question.id, stepId: question.stepId, answer, skipped });
    setBusy(false);
  };

  const canSubmit = (() => {
    if (question.kind === "text") return text.trim().length > 0;
    if (question.kind === "single_choice") return single && (single !== "__other" || other.trim().length > 0);
    if (question.kind === "multi_choice") return multi.length > 0 && (!multi.includes("__other") || other.trim().length > 0);
    if (question.kind === "confirm") return single === "yes" || single === "no";
    return false;
  })();

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-primary mb-2">
        <HelpCircle className="h-3 w-3" /> {question.required ? "Question (required)" : "Question (optional)"}
      </div>
      <div className="text-[13px] mb-3 text-pretty">{question.question}</div>

      {question.kind === "single_choice" && (
        <div className="space-y-1.5">
          {question.options.map((o) => (
            <label key={o.value} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-white/5 cursor-pointer">
              <input type="radio" name={`q-${question.id}`} value={o.value} checked={single === o.value} onChange={() => setSingle(o.value)} className="mt-0.5 accent-primary" />
              <div>
                <div>{o.label}</div>
                {o.description && <div className="text-[11px] text-muted-foreground">{o.description}</div>}
              </div>
            </label>
          ))}
          <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-white/5 cursor-pointer">
            <input type="radio" name={`q-${question.id}`} value="__other" checked={single === "__other"} onChange={() => setSingle("__other")} className="accent-primary" />
            <span>Other</span>
          </label>
          {single === "__other" && (
            <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Type your answer…" className="w-full rounded-md bg-background/50 border border-white/10 px-2 py-1.5 text-[12px] outline-none focus:border-primary/50" />
          )}
        </div>
      )}

      {question.kind === "multi_choice" && (
        <div className="space-y-1.5">
          {question.options.map((o) => (
            <label key={o.value} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-white/5 cursor-pointer">
              <input type="checkbox" checked={multi.includes(o.value)} onChange={(e) => setMulti((p) => e.target.checked ? [...p, o.value] : p.filter((v) => v !== o.value))} className="mt-0.5 accent-primary" />
              <div>
                <div>{o.label}</div>
                {o.description && <div className="text-[11px] text-muted-foreground">{o.description}</div>}
              </div>
            </label>
          ))}
          <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-white/5 cursor-pointer">
            <input type="checkbox" checked={multi.includes("__other")} onChange={(e) => setMulti((p) => e.target.checked ? [...p, "__other"] : p.filter((v) => v !== "__other"))} className="accent-primary" />
            <span>Other</span>
          </label>
          {multi.includes("__other") && (
            <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Type your answer…" className="w-full rounded-md bg-background/50 border border-white/10 px-2 py-1.5 text-[12px] outline-none focus:border-primary/50" />
          )}
        </div>
      )}

      {question.kind === "confirm" && (
        <div className="flex gap-2">
          {(["yes", "no"] as const).map((v) => (
            <button key={v} onClick={() => setSingle(v)} className={cn("rounded-md px-3 py-1.5 text-[12px] border", single === v ? "bg-primary/20 border-primary/50" : "border-white/10 hover:bg-white/5")}>
              {v === "yes" ? "Yes" : "No"}
            </button>
          ))}
        </div>
      )}

      {question.kind === "text" && (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Type your answer…" className="w-full rounded-md bg-background/50 border border-white/10 px-2 py-1.5 text-[12px] outline-none focus:border-primary/50" />
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="hero" disabled={!canSubmit || busy} onClick={() => void submit(false)}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Submit
        </Button>
        {!question.required && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void submit(true)}>
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}

function QuestionHistory({ questions }: { questions: JobQuestion[] }) {
  const answered = questions.filter((q) => q.answeredAt);
  if (answered.length === 0) return null;
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1">Q&A history</div>
      <ul className="space-y-1">
        {answered.map((q) => (
          <li key={q.id} className="text-[11.5px]">
            <div className="text-foreground/90">{q.question}</div>
            <div className="text-muted-foreground font-mono text-[11px]">→ {JSON.stringify(q.answer)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProofReport({ steps, jobError }: { steps: JobStep[]; jobError: string | null }) {
  const ok = steps.filter((s) => s.status === "succeeded").length;
  const failed = steps.filter((s) => s.status === "failed").length;
  const skipped = steps.filter((s) => s.status === "skipped").length;
  const cancelled = steps.filter((s) => s.status === "cancelled").length;
  const allOk = failed === 0 && cancelled === 0;
  return (
    <div className="rounded-md border border-white/5 bg-black/20">
      <div className={cn("px-2.5 py-1.5 text-[11.5px] font-medium flex items-center gap-1.5",
        allOk ? "text-success" : "text-destructive")}>
        {allOk ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
        Proof report — {ok} ok · {failed} failed · {skipped} skipped · {cancelled} cancelled
      </div>
      {jobError && <div className="px-2.5 pb-1.5 text-[11px] text-destructive">{jobError}</div>}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "running") return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
  if (status === "waiting_for_input") return <HelpCircle className="h-3 w-3 text-warning" />;
  if (status === "succeeded") return <CheckCircle2 className="h-3 w-3 text-success" />;
  if (status === "failed") return <X className="h-3 w-3 text-destructive" />;
  if (status === "cancelled") return <X className="h-3 w-3 text-muted-foreground" />;
  if (status === "skipped") return <Circle className="h-3 w-3 text-muted-foreground/60" />;
  return <Circle className="h-3 w-3 text-muted-foreground" />;
}

// Re-export so consumers can build their own quick job buttons.
export { JOB_TYPES };
