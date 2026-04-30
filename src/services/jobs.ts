// yawB job system — Supabase-backed.
//
// Browser responsibilities (this file):
//   - create jobs, plan steps, list jobs/steps/questions
//   - answer questions, cancel/retry jobs
//   - poll progress and TRIGGER the server runner
//
// Browser MUST NOT execute provider actions, read provider tokens, or read
// service-role keys. All privileged work lives in src/server/jobs-runner.server.ts
// and is invoked via the createServerFn wrapper in src/services/jobs-runner.functions.ts.
import { supabase } from "@/integrations/supabase/client";
import { setDiag, pushDiag } from "@/lib/diagnostics";
import { runNextJobStep } from "@/services/jobs-runner.functions";

export type JobStatus = "queued" | "running" | "waiting_for_input" | "succeeded" | "failed" | "cancelled";
export type StepStatus = "queued" | "running" | "waiting_for_input" | "succeeded" | "failed" | "skipped" | "cancelled";
export type QuestionKind = "single_choice" | "multi_choice" | "text" | "confirm";

export interface JobQuestion {
  id: string;
  jobId: string;
  stepId: string | null;
  question: string;
  kind: QuestionKind;
  options: Array<{ value: string; label: string; description?: string }>;
  answer: unknown;
  required: boolean;
  createdAt: string;
  answeredAt: string | null;
}

export const JOB_TYPES = [
  "github.connect_repo",
  "github.create_repo",
  "github.create_branch",
  "github.commit_changes",
  "github.open_pr",
  "vercel.connect_project",
  "vercel.set_env",
  "vercel.create_preview_deploy",
  "vercel.promote_production",
  "supabase.apply_migration",
  "supabase.verify_rls",
  "build.typecheck",
  "build.production",
  "ai.plan",
  "ai.generate_changes",
  "ai.repair_failure",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export interface Job {
  id: string;
  projectId: string;
  workspaceId: string;
  type: string;
  status: JobStatus;
  title: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  retryCount: number;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface JobStep {
  id: string;
  jobId: string;
  stepKey: string;
  title: string;
  status: StepStatus;
  position: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  logs: Array<{ ts: string; msg: string }>;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export type JobsSource = "supabase" | "empty" | "table-missing" | "error" | "no-project";

export const JOBS_SQL_FILE = "docs/sql/2026-04-30-project-jobs.sql";

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return error.code === "42P01" || error.code === "PGRST205" || msg.includes("does not exist");
}

function rowToJob(r: Record<string, unknown>): Job {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    workspaceId: String(r.workspace_id),
    type: String(r.type),
    status: r.status as JobStatus,
    title: String(r.title),
    input: (r.input as Record<string, unknown>) ?? {},
    output: (r.output as Record<string, unknown>) ?? {},
    error: (r.error as string | null) ?? null,
    retryCount: Number(r.retry_count ?? 0),
    createdBy: String(r.created_by),
    createdAt: String(r.created_at),
    startedAt: (r.started_at as string | null) ?? null,
    finishedAt: (r.finished_at as string | null) ?? null,
  };
}

function rowToStep(r: Record<string, unknown>): JobStep {
  return {
    id: String(r.id),
    jobId: String(r.job_id),
    stepKey: String(r.step_key),
    title: String(r.title),
    status: r.status as StepStatus,
    position: Number(r.position ?? 0),
    input: (r.input as Record<string, unknown>) ?? {},
    output: (r.output as Record<string, unknown>) ?? {},
    logs: (r.logs as Array<{ ts: string; msg: string }>) ?? [],
    error: (r.error as string | null) ?? null,
    startedAt: (r.started_at as string | null) ?? null,
    finishedAt: (r.finished_at as string | null) ?? null,
  };
}

// ---------- Step planning ----------

interface StepPlan { key: string; title: string; input?: Record<string, unknown> }

function planStepsForType(type: string, input: Record<string, unknown>): StepPlan[] {
  switch (type) {
    case "github.connect_repo":
      return [
        { key: "verify_connection", title: "Verify GitHub connection" },
        { key: "link_repo", title: "Link repository", input },
      ];
    case "github.create_repo":
      return [
        { key: "verify_connection", title: "Verify GitHub connection" },
        { key: "create_repo", title: "Create GitHub repository", input },
      ];
    case "github.create_branch":
      return [
        { key: "verify_connection", title: "Verify GitHub connection" },
        { key: "create_branch", title: "Create branch", input },
      ];
    case "github.commit_changes":
      return [
        { key: "verify_connection", title: "Verify GitHub connection" },
        { key: "commit", title: "Commit changes", input },
      ];
    case "github.open_pr":
      return [
        { key: "verify_connection", title: "Verify GitHub connection" },
        { key: "open_pr", title: "Open pull request", input },
      ];
    case "vercel.connect_project":
      return [
        { key: "verify_connection", title: "Verify Vercel connection" },
        { key: "link_project", title: "Link Vercel project", input },
      ];
    case "vercel.set_env":
      return [
        { key: "verify_connection", title: "Verify Vercel connection" },
        { key: "set_env", title: "Push environment variables", input },
      ];
    case "vercel.create_preview_deploy":
      return [
        { key: "verify_connection", title: "Verify Vercel connection" },
        { key: "trigger_deploy", title: "Trigger preview deployment", input },
      ];
    case "vercel.promote_production":
      return [
        { key: "verify_connection", title: "Verify Vercel connection" },
        { key: "promote", title: "Promote to production", input },
      ];
    case "supabase.apply_migration":
      return [
        { key: "verify_connection", title: "Verify Supabase connection" },
        { key: "apply", title: "Apply migration", input },
      ];
    case "supabase.verify_rls":
      return [
        { key: "verify_connection", title: "Verify Supabase connection" },
        { key: "verify_rls", title: "Verify RLS policies", input },
      ];
    case "build.typecheck":
      return [{ key: "typecheck", title: "Run TypeScript check", input }];
    case "build.production":
      return [{ key: "build", title: "Run production build", input }];
    case "ai.plan":
      return [{ key: "plan", title: "Plan changes", input }];
    case "ai.generate_changes":
      return [{ key: "generate", title: "Generate changes", input }];
    case "ai.repair_failure":
      return [{ key: "repair", title: "Repair failure", input }];
    default:
      return [{ key: "run", title: type, input }];
  }
}

// ---------- Public API ----------

export async function listJobs(projectId: string | null | undefined): Promise<{
  jobs: Job[]; source: JobsSource; error?: string; sqlFile?: string;
}> {
  if (!projectId) return { jobs: [], source: "no-project" };
  try {
    const { data, error } = await supabase
      .from("project_jobs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      if (isMissingTable(error)) return { jobs: [], source: "table-missing", error: error.message, sqlFile: JOBS_SQL_FILE };
      return { jobs: [], source: "error", error: error.message };
    }
    if (!data || data.length === 0) return { jobs: [], source: "empty" };
    return { jobs: data.map(rowToJob), source: "supabase" };
  } catch (e) {
    return { jobs: [], source: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

export async function listJobSteps(jobId: string): Promise<{ steps: JobStep[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("project_job_steps")
      .select("*")
      .eq("job_id", jobId)
      .order("position", { ascending: true });
    if (error) return { steps: [], error: error.message };
    return { steps: (data ?? []).map(rowToStep) };
  } catch (e) {
    return { steps: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export type EnqueueResult =
  | { ok: true; job: Job }
  | { ok: false; error: string; code?: string; tableMissing?: boolean; sqlFile?: string };

export async function enqueueJob(input: {
  projectId: string;
  workspaceId: string;
  type: JobType | string;
  title: string;
  input?: Record<string, unknown>;
}): Promise<EnqueueResult> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { ok: false, error: "Not signed in", code: "NO_SESSION" };

    const payload = {
      project_id: input.projectId,
      workspace_id: input.workspaceId,
      type: input.type,
      title: input.title,
      input: input.input ?? {},
      created_by: u.user.id,
    };
    pushDiag("job.enqueue", payload);

    const { data: jobRow, error: jobErr } = await supabase
      .from("project_jobs")
      .insert(payload)
      .select("*")
      .maybeSingle();

    if (jobErr) {
      if (isMissingTable(jobErr)) {
        return { ok: false, error: jobErr.message, code: jobErr.code, tableMissing: true, sqlFile: JOBS_SQL_FILE };
      }
      return { ok: false, error: jobErr.message, code: jobErr.code };
    }
    if (!jobRow) return { ok: false, error: "Insert returned no row" };
    const job = rowToJob(jobRow);

    const steps = planStepsForType(input.type, input.input ?? {});
    const stepRows = steps.map((s, i) => ({
      job_id: job.id,
      step_key: s.key,
      title: s.title,
      position: i,
      input: s.input ?? {},
    }));
    if (stepRows.length > 0) {
      const { error: stepErr } = await supabase.from("project_job_steps").insert(stepRows);
      if (stepErr) {
        // Best-effort: mark job failed if we couldn't even plan it.
        await supabase.from("project_jobs").update({ status: "failed", error: `step plan failed: ${stepErr.message}`, finished_at: new Date().toISOString() }).eq("id", job.id);
        return { ok: false, error: stepErr.message, code: stepErr.code };
      }
    }

    setDiag({ jobId: job.id, jobType: job.type, jobStatus: job.status, retryCount: job.retryCount, lastError: null });
    return { ok: true, job };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function cancelJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("project_jobs")
      .update({ status: "cancelled", finished_at: now })
      .eq("id", jobId)
      .in("status", ["queued", "running"]);
    if (error) return { ok: false, error: error.message };
    await supabase
      .from("project_job_steps")
      .update({ status: "cancelled", finished_at: now })
      .eq("job_id", jobId)
      .in("status", ["queued", "running"]);
    setDiag({ jobStatus: "cancelled" });
    pushDiag("job.cancel", { jobId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function retryJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    // Re-queue the job and reset failed/cancelled steps.
    const { data: jobRow, error: getErr } = await supabase
      .from("project_jobs").select("retry_count").eq("id", jobId).maybeSingle();
    if (getErr) return { ok: false, error: getErr.message };
    const nextRetry = Number(jobRow?.retry_count ?? 0) + 1;
    const { error } = await supabase
      .from("project_jobs")
      .update({ status: "queued", error: null, started_at: null, finished_at: null, retry_count: nextRetry })
      .eq("id", jobId);
    if (error) return { ok: false, error: error.message };
    await supabase
      .from("project_job_steps")
      .update({ status: "queued", error: null, started_at: null, finished_at: null, output: {}, logs: [] })
      .eq("job_id", jobId)
      .in("status", ["failed", "cancelled"]);
    setDiag({ jobStatus: "queued", retryCount: nextRetry, lastError: null });
    pushDiag("job.retry", { jobId, retryCount: nextRetry });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------- Step types (kept for UI/contract; runner now lives server-side) ----------

interface StepResult {
  status: "succeeded" | "failed" | "skipped" | "waiting_for_input";
  output?: Record<string, unknown>;
  error?: string;
  log?: string;
  ask?: AskInput;
}

export interface AskInput {
  question: string;
  kind: QuestionKind;
  options?: Array<{ value: string; label: string; description?: string }>;
  required?: boolean;
}

function rowToQuestion(r: Record<string, unknown>): JobQuestion {
  return {
    id: String(r.id),
    jobId: String(r.job_id),
    stepId: (r.step_id as string | null) ?? null,
    question: String(r.question),
    kind: r.kind as QuestionKind,
    options: (r.options as JobQuestion["options"]) ?? [],
    answer: r.answer ?? null,
    required: Boolean(r.required),
    createdAt: String(r.created_at),
    answeredAt: (r.answered_at as string | null) ?? null,
  };
}

export async function listJobQuestions(jobId: string): Promise<{ questions: JobQuestion[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("project_job_questions")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });
    if (error) return { questions: [], error: error.message };
    return { questions: (data ?? []).map(rowToQuestion) };
  } catch (e) {
    return { questions: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function answerJobQuestion(input: {
  questionId: string;
  jobId: string;
  stepId: string | null;
  answer: unknown;
  skipped?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();
    setDiag({ questionId: input.questionId, answerSaved: false, resumeTriggered: false });

    const { data: qRow, error: qErr } = await supabase
      .from("project_job_questions")
      .select("required, answered_at")
      .eq("id", input.questionId)
      .maybeSingle();
    if (qErr) return { ok: false, error: qErr.message };
    if (!qRow) return { ok: false, error: "Question not found" };
    if (qRow.answered_at) return { ok: false, error: "Question already answered" };
    if (input.skipped && qRow.required) {
      return { ok: false, error: "Question is required and cannot be skipped." };
    }

    const { error: aErr } = await supabase
      .from("project_job_questions")
      .update({ answer: input.skipped ? { skipped: true } : { value: input.answer }, answered_at: now })
      .eq("id", input.questionId);
    if (aErr) return { ok: false, error: aErr.message };

    setDiag({ answerSaved: true });
    pushDiag("job.question.answered", { questionId: input.questionId, jobId: input.jobId, skipped: !!input.skipped });

    if (input.stepId) {
      const { error: sErr } = await supabase
        .from("project_job_steps")
        .update({ status: "queued", error: null, started_at: null, finished_at: null })
        .eq("id", input.stepId)
        .eq("status", "waiting_for_input");
      if (sErr) return { ok: false, error: `step resume failed: ${sErr.message}` };
    }
    const { error: jErr } = await supabase
      .from("project_jobs")
      .update({ status: "running", error: null, finished_at: null })
      .eq("id", input.jobId)
      .eq("status", "waiting_for_input");
    if (jErr) return { ok: false, error: `job resume failed: ${jErr.message}` };

    setDiag({ resumeTriggered: true, jobStatus: "running", lastError: null });
    pushDiag("job.resume", { jobId: input.jobId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------- Server-backed runner trigger ----------
//
// The browser DOES NOT execute provider work. tickJobs() asks the server
// function to claim and run exactly one step. RLS still applies because the
// server function uses a Supabase client built from the caller's bearer.

export interface TickResult {
  advanced: boolean;
  jobId?: string;
  stepKey?: string;
  status?: StepResult["status"];
  error?: string;
  questionId?: string;
}

export async function tickJobs(projectId: string): Promise<TickResult> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const accessToken = sess.session?.access_token;
    if (!accessToken) {
      const msg = "Not signed in — cannot trigger server runner.";
      setDiag({ lastError: msg });
      return { advanced: false, error: msg };
    }
    const r = await runNextJobStep({
      data: { projectId },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (r.error) {
      setDiag({ lastError: r.error });
      pushDiag("job.tick.error", { projectId, error: r.error });
    } else if (r.advanced) {
      setDiag({
        jobId: r.jobId ?? null,
        currentStep: r.stepKey ?? null,
        jobStatus: r.status === "waiting_for_input" ? "waiting_for_input" : "running",
        questionId: r.questionId ?? null,
        lastError: r.status === "failed" ? (r.error ?? "step failed") : null,
      });
      pushDiag("job.tick", { jobId: r.jobId, stepKey: r.stepKey, status: r.status });
    }
    return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setDiag({ lastError: msg });
    pushDiag("job.tick.exception", { projectId, error: msg });
    return { advanced: false, error: msg };
  }
}

export async function reportProviderConnections(projectId: string) {
  try {
    const { data, error } = await supabase
      .from("project_connections")
      .select("provider, status")
      .eq("project_id", projectId);
    if (error) return;
    const map: Record<string, string> = {};
    for (const row of data ?? []) map[String(row.provider)] = String(row.status);
    setDiag({ providerConnectionStatus: map });
  } catch {
    // ignore — observational only
  }
}

