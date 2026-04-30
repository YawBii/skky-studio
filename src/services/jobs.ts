// yawB job system — Supabase-backed.
// Jobs and steps are persisted in public.project_jobs / public.project_job_steps.
// The runner is a "claim and run one step" loop driven from the browser using
// the user's authenticated Supabase session. RLS enforces project membership.
//
// Provider step handlers (github.*, vercel.*, supabase.*) are STUBS in Phase 1:
// they validate that the required project_connections row exists and otherwise
// fail cleanly with a clear error. Real provider calls land in Phase 2 via
// server-side workers; the browser must never receive provider tokens.
import { supabase } from "@/integrations/supabase/client";
import { setDiag, pushDiag } from "@/lib/diagnostics";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type StepStatus = "queued" | "running" | "succeeded" | "failed" | "skipped" | "cancelled";

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

// ---------- Step handlers (Phase 1 stubs) ----------

interface StepContext {
  job: Job;
  step: JobStep;
}

interface StepResult {
  status: "succeeded" | "failed" | "skipped";
  output?: Record<string, unknown>;
  error?: string;
  log?: string;
}

async function checkConnection(projectId: string, provider: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { data, error } = await supabase
    .from("project_connections")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: `${provider} connections table missing — run ${JOBS_SQL_FILE}` };
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: `${provider} is not connected for this project.` };
  if (data.status !== "connected") return { ok: false, status: data.status, error: `${provider} connection is "${data.status}", expected "connected".` };
  return { ok: true, status: data.status };
}

async function runStep(ctx: StepContext): Promise<StepResult> {
  const { job, step } = ctx;
  // Provider verify steps
  if (step.stepKey === "verify_connection") {
    const provider = job.type.startsWith("github.") ? "github"
      : job.type.startsWith("vercel.") ? "vercel"
      : job.type.startsWith("supabase.") ? "supabase"
      : null;
    if (!provider) return { status: "skipped", log: "no provider verification needed" };
    const res = await checkConnection(job.projectId, provider);
    if (!res.ok) return { status: "failed", error: res.error ?? "connection check failed" };
    return { status: "succeeded", output: { provider, status: res.status }, log: `${provider} connection ok` };
  }

  // Provider action steps — Phase 1 stubs. They require the connection to be
  // verified earlier, and they explicitly do not pretend to succeed.
  if (job.type.startsWith("github.") || job.type.startsWith("vercel.") || job.type.startsWith("supabase.")) {
    return {
      status: "failed",
      error: `${job.type}:${step.stepKey} is not executable yet — server-side worker is not wired in this build. Required connection is verified; Phase 2 will perform the real provider call.`,
    };
  }

  // Build / typecheck / AI steps — same posture: fail cleanly until wired.
  if (job.type === "build.typecheck" || job.type === "build.production") {
    return { status: "failed", error: `${job.type} requires a server-side build runner. Not wired yet.` };
  }
  if (job.type.startsWith("ai.")) {
    return { status: "failed", error: `${job.type} requires the AI gateway worker. Not wired yet.` };
  }

  return { status: "failed", error: `Unknown job type: ${job.type}` };
}

// Claim the next job that is ready to run, run ONE step, and return.
// The UI calls this in a polling loop. This avoids long-lived requests and
// allows multiple browser tabs / users to cooperate via Supabase RLS.
export async function tickJobs(projectId: string): Promise<{
  advanced: boolean;
  jobId?: string;
  stepKey?: string;
  result?: StepResult;
  error?: string;
}> {
  try {
    // Find a queued or running job for this project.
    const { data: jobRows, error: jErr } = await supabase
      .from("project_jobs")
      .select("*")
      .eq("project_id", projectId)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: true })
      .limit(1);
    if (jErr) return { advanced: false, error: jErr.message };
    const jobRow = jobRows?.[0];
    if (!jobRow) return { advanced: false };
    const job = rowToJob(jobRow);

    // Mark running on first claim.
    if (job.status === "queued") {
      await supabase
        .from("project_jobs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", job.id);
      job.status = "running";
    }

    // Find the next queued step.
    const { data: stepRows, error: sErr } = await supabase
      .from("project_job_steps")
      .select("*")
      .eq("job_id", job.id)
      .order("position", { ascending: true });
    if (sErr) return { advanced: false, error: sErr.message };
    const steps = (stepRows ?? []).map(rowToStep);
    const next = steps.find((s) => s.status === "queued");

    if (!next) {
      // No queued step left — finalize job based on step outcomes.
      const anyFailed = steps.some((s) => s.status === "failed");
      const allDone = steps.every((s) => s.status === "succeeded" || s.status === "skipped" || s.status === "failed" || s.status === "cancelled");
      if (allDone) {
        const finalStatus: JobStatus = anyFailed ? "failed" : "succeeded";
        const errorMsg = anyFailed ? (steps.find((s) => s.status === "failed")?.error ?? "step failed") : null;
        await supabase
          .from("project_jobs")
          .update({ status: finalStatus, finished_at: new Date().toISOString(), error: errorMsg })
          .eq("id", job.id);
        setDiag({ jobId: job.id, jobType: job.type, jobStatus: finalStatus, currentStep: null, lastError: errorMsg });
        pushDiag("job.finalize", { jobId: job.id, status: finalStatus, error: errorMsg });
      }
      return { advanced: false, jobId: job.id };
    }

    // Run the step.
    setDiag({ jobId: job.id, jobType: job.type, jobStatus: "running", currentStep: next.stepKey });
    pushDiag("job.step.start", { jobId: job.id, stepKey: next.stepKey });
    await supabase
      .from("project_job_steps")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", next.id);

    const result = await runStep({ job, step: next });

    const logEntry = { ts: new Date().toISOString(), msg: result.log ?? result.error ?? `step ${result.status}` };
    await supabase
      .from("project_job_steps")
      .update({
        status: result.status,
        output: result.output ?? {},
        error: result.error ?? null,
        logs: [...next.logs, logEntry],
        finished_at: new Date().toISOString(),
      })
      .eq("id", next.id);

    if (result.status === "failed") {
      setDiag({ lastError: result.error ?? "step failed" });
      pushDiag("job.step.failed", { jobId: job.id, stepKey: next.stepKey, error: result.error });
    } else {
      pushDiag("job.step.done", { jobId: job.id, stepKey: next.stepKey, status: result.status });
    }

    return { advanced: true, jobId: job.id, stepKey: next.stepKey, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setDiag({ lastError: msg });
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
    // ignore — this is observational only
  }
}
