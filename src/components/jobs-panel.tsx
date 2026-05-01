// Per-project Jobs / Activity panel. Shows queued/running/waiting/succeeded/
// failed jobs, their steps, logs, retry/cancel controls, interactive
// questions (Lovable-style), a strict proof report, runner diagnostics, and
// quick job-enqueue buttons.
import { useState, useEffect, type ReactNode } from "react";
import {
  Loader2, Play, RotateCcw, X, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, Circle, Activity, HelpCircle, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProjectJobs } from "@/hooks/use-project-jobs";
import { useDiagnostics } from "@/lib/diagnostics";
import { JOB_TYPES, type Job, type JobStep, type JobQuestion, type JobType, type StepAttempt } from "@/services/jobs";
import { getBuildRunnerConfig, type BuildRunnerConfigSnapshot } from "@/services/build-runner.functions";
import { partitionFailures, getResolvingSuccess } from "@/lib/job-resolution";

interface JobsPanelProps {
  projectId: string | null;
  workspaceId: string | null;
  className?: string;
  initialExpandedJobId?: string | null;
}

const QUICK_JOBS: { type: JobType; title: string }[] = [
  { type: "build.typecheck", title: "Run TypeScript check" },
  { type: "build.production", title: "Run production build" },
  { type: "vercel.create_preview_deploy", title: "Create preview deploy" },
  { type: "github.commit_changes", title: "Commit pending changes" },
];

export function JobsPanel({ projectId, workspaceId, className, initialExpandedJobId }: JobsPanelProps) {
  const {
    jobs, source, error, sqlFile, loading, ticking, lastTick,
    stepsByJob, questionsByJob, attemptsByJob,
    enqueue, cancel, retry, retryStep, answer, refreshSteps, refreshQuestions, refreshAttempts,
  } = useProjectJobs(projectId, workspaceId);
  const diag = useDiagnostics();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [enqueuing, setEnqueuing] = useState<string | null>(null);
  const [buildCfg, setBuildCfg] = useState<BuildRunnerConfigSnapshot | null>(null);
  const [showResolvedHistory, setShowResolvedHistory] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBuildRunnerConfig()
      .then((cfg) => { if (!cancelled) setBuildCfg(cfg); })
      .catch(() => { if (!cancelled) setBuildCfg(null); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!initialExpandedJobId) return;
    setExpanded((p) => ({ ...p, [initialExpandedJobId]: true }));
    void refreshSteps(initialExpandedJobId);
    void refreshQuestions(initialExpandedJobId);
    void refreshAttempts(initialExpandedJobId);
  }, [initialExpandedJobId, refreshSteps, refreshQuestions, refreshAttempts]);

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
        {(() => {
          const { resolvedFailed } = partitionFailures(jobs);
          const resolvedIds = new Set(resolvedFailed.map((j) => j.id));
          const activeJobs = jobs.filter((j) => !resolvedIds.has(j.id));
          const renderRow = (j: Job) => (
            <JobRow key={j.id}
              job={j}
              expanded={!!expanded[j.id]}
              steps={stepsByJob[j.id] ?? []}
              questions={questionsByJob[j.id] ?? []}
              attempts={attemptsByJob[j.id] ?? []}
              diagBlock={
                <RunnerDiagnostics
                  job={j}
                  steps={stepsByJob[j.id] ?? []}
                  questions={questionsByJob[j.id] ?? []}
                  lastTick={lastTick}
                  providerStatus={diag.state.providerConnectionStatus}
                  lastError={diag.state.lastError}
                  buildCfg={buildCfg}
                />
              }
              onToggle={() => toggle(j.id)}
              onCancel={() => cancel(j.id)}
              onRetry={() => retry(j.id)}
              onRetryStep={(stepId) => retryStep(j.id, stepId)}
              onAnswer={(input) => answer({ ...input, jobId: j.id })}
            />
          );
          return (
            <>
              <ul className="divide-y divide-white/5">
                {activeJobs.map(renderRow)}
              </ul>
              {resolvedFailed.length > 0 && (
                <details className="border-t border-white/5">
                  <summary className="px-4 py-2.5 text-[11.5px] text-muted-foreground cursor-pointer hover:text-foreground select-none">
                    Resolved history ({resolvedFailed.length}) · superseded by a later success
                  </summary>
                  <ul className="divide-y divide-white/5 opacity-70">
                    {resolvedFailed.map(renderRow)}
                  </ul>
                </details>
              )}
            </>
          );
        })()}
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
      <p className="mb-2">Run the SQL migrations to create <code className="text-foreground">project_jobs</code>, <code className="text-foreground">project_job_steps</code>, <code className="text-foreground">project_secrets</code>, <code className="text-foreground">project_job_questions</code>, and <code className="text-foreground">project_job_step_attempts</code>.</p>
      {sqlFile && <p className="font-mono text-[11px] text-foreground/80">{sqlFile}</p>}
      <p className="font-mono text-[11px] text-foreground/80">docs/sql/2026-04-30-project-job-questions.sql</p>
      <p className="font-mono text-[11px] text-foreground/80">docs/sql/2026-04-30-project-job-step-attempts.sql</p>
      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function JobRow({ job, expanded, steps, questions, attempts, diagBlock, onToggle, onCancel, onRetry, onRetryStep, onAnswer }: {
  job: Job;
  expanded: boolean;
  steps: JobStep[];
  questions: JobQuestion[];
  attempts: StepAttempt[];
  diagBlock: ReactNode;
  onToggle: () => void;
  onCancel: () => Promise<unknown>;
  onRetry: () => Promise<unknown>;
  onRetryStep: (stepId: string) => Promise<unknown>;
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
            <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => void onCancel()} title="Cancel job">
              <X className="h-3 w-3" />
            </Button>
          )}
          {canRetry && (
            <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => void onRetry()} title="Retry whole job">
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
          {steps.map((s) => (
            <StepRow
              key={s.id}
              step={s}
              attempts={attempts.filter((a) => a.stepId === s.id)}
              onRetryStep={() => onRetryStep(s.id)}
            />
          ))}
          {questions.length > 0 && <QuestionHistory questions={questions} />}
          <ProofReport job={job} steps={steps} questions={questions} />
          {diagBlock}
        </div>
      )}
    </li>
  );
}

function StepRow({ step, attempts, onRetryStep }: {
  step: JobStep;
  attempts: StepAttempt[];
  onRetryStep: () => Promise<unknown>;
}) {
  const canRetryStep = step.status === "failed" || step.status === "cancelled";
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <StatusDot status={step.status} />
        <div className="text-[12px] flex-1 truncate">{step.title}</div>
        <span className="text-[10px] text-muted-foreground font-mono">{step.stepKey}</span>
        {step.attemptNumber > 1 && (
          <span className="text-[10px] text-muted-foreground font-mono">·attempt {step.attemptNumber}</span>
        )}
        {canRetryStep && (
          <Button size="sm" variant="ghost" className="h-5 px-1" onClick={() => void onRetryStep()} title="Retry this step only">
            <RotateCcw className="h-3 w-3" /> <span className="text-[10px] ml-0.5">step</span>
          </Button>
        )}
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
      {attempts.length > 1 && (
        <details className="mt-1.5">
          <summary className="text-[10.5px] text-muted-foreground cursor-pointer hover:text-foreground">
            Attempt history ({attempts.length})
          </summary>
          <ul className="mt-1 space-y-1 pl-3 border-l border-white/10">
            {attempts.map((a) => (
              <li key={a.id} className="text-[10.5px] font-mono">
                <span className="text-muted-foreground">#{a.attemptNumber}</span>{" "}
                <span className={cn(
                  a.status === "succeeded" && "text-success",
                  a.status === "failed" && "text-destructive",
                )}>{a.status}</span>
                {a.error && <span className="text-destructive"> — {a.error}</span>}
                {" · "}<span className="text-muted-foreground/70">
                  {new Date(a.startedAt).toLocaleTimeString()}
                  {a.finishedAt && ` → ${new Date(a.finishedAt).toLocaleTimeString()}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
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

// Strict proof report — refuses to say "done" until every step is terminal,
// and clearly says "Not done" when anything is in progress or required steps
// failed. Built directly from persisted DB state.
const TERMINAL: ReadonlyArray<string> = ["succeeded", "failed", "skipped", "cancelled"];

function ProofReport({ job, steps, questions }: { job: Job; steps: JobStep[]; questions: JobQuestion[] }) {
  const inProgress = steps.filter((s) => s.status === "queued" || s.status === "running" || s.status === "waiting_for_input");
  const failed = steps.filter((s) => s.status === "failed");
  const allTerminal = steps.length > 0 && steps.every((s) => TERMINAL.includes(s.status));

  let verdict: { kind: "done" | "not-done-progress" | "not-done-failed" | "empty"; line: string };
  if (steps.length === 0) {
    verdict = { kind: "empty", line: "Not done — no steps recorded." };
  } else if (inProgress.length > 0) {
    verdict = { kind: "not-done-progress", line: "Not done — job is still in progress." };
  } else if (failed.length > 0) {
    verdict = { kind: "not-done-failed", line: "Not done — required step failed." };
  } else if (allTerminal && job.status === "succeeded") {
    verdict = { kind: "done", line: "Done — all required steps terminal." };
  } else {
    verdict = { kind: "not-done-progress", line: `Not done — job status is "${job.status}".` };
  }

  const verdictColor = verdict.kind === "done" ? "text-success" : "text-destructive";

  return (
    <div className="rounded-md border border-white/10 bg-black/30">
      <div className={cn("px-2.5 py-1.5 text-[11.5px] font-medium flex items-center gap-1.5", verdictColor)}>
        {verdict.kind === "done" ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
        Proof report
      </div>
      <div className="px-2.5 pb-2 space-y-1.5">
        <div className={cn("text-[11.5px]", verdictColor)}>{verdict.line}</div>
        <div className="text-[10.5px] font-mono text-muted-foreground">
          job id: {job.id}<br />
          job type: {job.type}<br />
          job status: {job.status}<br />
          retries: {job.retryCount}
        </div>
        <ol className="space-y-1.5 mt-1.5">
          {steps.map((s) => {
            const q = questions.find((qq) => qq.stepId === s.id);
            return (
              <li key={s.id} className="border-l-2 pl-2 border-white/10">
                <div className="text-[11.5px] flex items-center gap-1.5">
                  <StatusDot status={s.status} />
                  <span className="font-medium">{s.title}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">{s.stepKey}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">·attempt {s.attemptNumber}</span>
                </div>
                <div className="text-[10.5px] font-mono text-muted-foreground/80">
                  step id: {s.id}
                </div>
                {Object.keys(s.input ?? {}).length > 0 && (
                  <div className="text-[10.5px] font-mono text-muted-foreground/70 truncate">input: {JSON.stringify(s.input)}</div>
                )}
                {q && (
                  <div className="text-[10.5px] text-muted-foreground">
                    Q: {q.question} → {q.answeredAt ? JSON.stringify(q.answer) : <span className="text-warning">(unanswered)</span>}
                  </div>
                )}
                {s.error && <div className="text-[10.5px] text-destructive whitespace-pre-wrap">error: {s.error}</div>}
                {s.output && Object.keys(s.output).length > 0 && (
                  <div className="text-[10.5px] font-mono text-muted-foreground/70 truncate">output: {JSON.stringify(s.output)}</div>
                )}
                {s.logs && s.logs.length > 0 && (
                  <div className="text-[10.5px] font-mono text-muted-foreground/60 truncate">
                    last log: {s.logs[s.logs.length - 1].msg}
                  </div>
                )}
                <div className="text-[10px] font-mono text-muted-foreground/60">
                  {s.startedAt && `started ${new Date(s.startedAt).toLocaleTimeString()}`}
                  {s.finishedAt && ` · finished ${new Date(s.finishedAt).toLocaleTimeString()}`}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// Detailed runner diagnostics for the selected job. Surfaces server-side
// runner state and clearly distinguishes failure causes.
function RunnerDiagnostics({ job, steps, questions, lastTick, providerStatus, lastError, buildCfg }: {
  job: Job;
  steps: JobStep[];
  questions: JobQuestion[];
  lastTick: { advanced: boolean; jobId?: string; stepKey?: string; status?: string; error?: string; questionId?: string; cancelled?: boolean } | null;
  providerStatus: Record<string, string> | null;
  lastError: string | null;
  buildCfg: BuildRunnerConfigSnapshot | null;
}) {
  const currentStep = steps.find((s) => s.status === "running")
    ?? steps.find((s) => s.status === "waiting_for_input")
    ?? steps.find((s) => s.status === "queued");
  const openQuestion = questions.find((q) => !q.answeredAt);
  const tickForThisJob = lastTick && lastTick.jobId === job.id ? lastTick : null;
  const failureCause = classifyFailure(tickForThisJob?.error ?? lastError ?? job.error);
  const lastLog = currentStep?.logs?.[currentStep.logs.length - 1] ?? steps.flatMap((s) => s.logs).slice(-1)[0];
  const isBuildJob = job.type === "build.typecheck" || job.type === "build.production";

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-primary mb-1.5">
          <Wrench className="h-3 w-3" /> Runner diagnostics
        </div>
        <dl className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5 text-[11px]">
          <Row k="job status" v={job.status} />
          <Row k="current step" v={currentStep ? `${currentStep.title} (${currentStep.stepKey}) · ${currentStep.status}` : "—"} />
          <Row k="last server tick" v={tickForThisJob
            ? `${tickForThisJob.advanced ? "advanced" : "no-op"}${tickForThisJob.status ? ` · ${tickForThisJob.status}` : ""}${tickForThisJob.cancelled ? " · cancelled" : ""}`
            : "—"} />
          <Row k="server error" v={tickForThisJob?.error ?? lastError ?? "—"} highlight={!!(tickForThisJob?.error ?? lastError)} />
          <Row k="failure cause" v={failureCause} />
          <Row k="provider connections" v={providerStatus ? Object.entries(providerStatus).map(([p, s]) => `${p}=${s}`).join(", ") || "none" : "—"} />
          <Row k="waiting for input" v={openQuestion ? `yes — "${openQuestion.question}"` : "no"} highlight={!!openQuestion} />
          <Row k="retry count" v={String(job.retryCount)} />
          <Row k="cancelled" v={job.status === "cancelled" ? "yes" : "no"} />
          <Row k="last log" v={lastLog ? `${new Date(lastLog.ts).toLocaleTimeString()} — ${lastLog.msg}` : "—"} />
        </dl>
      </div>

      {isBuildJob && (
        <div className="rounded-md border border-warning/20 bg-warning/5 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-warning mb-1.5">
            <Wrench className="h-3 w-3" /> Build runner config
          </div>
          {buildCfg ? (
            <>
              <dl className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5 text-[11px]">
                <Row k="mode" v={buildCfg.mode} highlight={buildCfg.mode === "none"} />
                <Row k="BUILD_RUNNER_URL" v={buildCfg.hasBuildRunnerUrl ? "set" : "missing"} highlight={!buildCfg.hasBuildRunnerUrl && buildCfg.mode !== "local"} />
                <Row k="BUILD_RUNNER_TOKEN" v={buildCfg.hasBuildRunnerToken ? "set" : "missing"} />
                <Row k="BUILD_RUNNER_MODE" v={buildCfg.hasBuildRunnerMode ? "set" : "missing"} />
                <Row k="BUILD_COMMAND" v={buildCfg.hasBuildCommand ? "set (override)" : "default: npm run build"} />
                <Row k="TYPECHECK_COMMAND" v={buildCfg.hasTypecheckCommand ? "set (override)" : "default: npm run typecheck"} />
                <Row k="BUILD_PREVIEW_COMMAND" v={buildCfg.hasBuildPreviewCommand ? "set (override)" : "—"} />
              </dl>
              <div className="text-[10.5px] text-muted-foreground/80 mt-1.5">{buildCfg.reason}</div>
            </>
          ) : (
            <div className="text-[11px] text-muted-foreground">Loading build runner config…</div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground font-mono">{k}</dt>
      <dd className={cn("font-mono break-all", highlight ? "text-warning" : "text-foreground/90")}>{v}</dd>
    </>
  );
}

// Map a server error message to a clear failure category so the user sees
// WHY a step failed without reading raw provider strings.
function classifyFailure(err: string | null | undefined): string {
  if (!err) return "—";
  const s = err.toLowerCase();
  if (s.includes("not connected for this project") || s.includes("connection is")) return "missing provider connection";
  if (s.includes("is not configured")) return "missing server env secret";
  if (s.includes("provider call is not wired yet")) return "provider API not wired yet";
  if (s.includes("row-level security") || s.includes("rls") || s.includes("permission denied")) return "RLS/database error";
  if (s.includes("not authenticated") || s.includes("no bearer")) return "auth missing";
  if (s.includes("cancelled")) return "job cancelled";
  if (s.includes("awaiting") || s.includes("waiting_for_input")) return "user input required";
  return "unknown";
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
