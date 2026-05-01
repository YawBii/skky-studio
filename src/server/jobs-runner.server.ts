// Server-only job runner. Privileged work (provider tokens, service-role
// access) lives here and NEVER runs in the browser. The runner uses a
// Supabase client built per-request with the caller's bearer token, so RLS
// still enforces project membership — but secret resolution and outbound
// provider calls happen on the server.
//
// SECURITY: this module imports `process.env` and is intentionally suffixed
// `.server.ts` so Vite import-protection blocks it from any client bundle.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------- Types ----------

export type JobStatus =
  | "queued" | "running" | "waiting_for_input"
  | "succeeded" | "failed" | "cancelled";
export type StepStatus =
  | "queued" | "running" | "waiting_for_input"
  | "succeeded" | "failed" | "skipped" | "cancelled";
export type QuestionKind = "single_choice" | "multi_choice" | "text" | "confirm";

interface JobRow {
  id: string; project_id: string; workspace_id: string; type: string;
  status: JobStatus; title: string; input: Record<string, unknown>;
}
interface StepRow {
  id: string; job_id: string; step_key: string; title: string;
  status: StepStatus; position: number; input: Record<string, unknown>;
  output: Record<string, unknown>; logs: Array<{ ts: string; msg: string }>;
  error?: string | null;
  attempt_number?: number;
}

interface AskInput {
  question: string;
  kind: QuestionKind;
  options?: Array<{ value: string; label: string; description?: string }>;
  required?: boolean;
}
export interface StepResult {
  status: "succeeded" | "failed" | "skipped" | "waiting_for_input";
  output?: Record<string, unknown>;
  error?: string;
  log?: string;
  ask?: AskInput;
}

// ---------- Per-request Supabase client (RLS as the caller) ----------

function buildUserScopedClient(accessToken: string): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    process.env.EXTERNAL_SUPABASE_URL ??
    "";
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.EXTERNAL_SUPABASE_PUBLISHABLE_KEY ??
    "";
  if (!url || !key) {
    throw new Error(
      "Server Supabase env not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, or EXTERNAL_SUPABASE_URL / EXTERNAL_SUPABASE_PUBLISHABLE_KEY) as server env vars and republish the preview.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}


// ---------- Server-side secret resolution ----------

async function resolveSecret(
  sb: SupabaseClient,
  projectId: string,
  provider: string,
  key: string,
): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  const { data, error } = await sb
    .from("project_secrets")
    .select("value_ref")
    .eq("project_id", projectId)
    .eq("provider", provider)
    .eq("key", key)
    .maybeSingle();
  if (error) return { ok: false, error: `secret lookup failed: ${error.message}` };
  if (!data?.value_ref) {
    return { ok: false, error: missingSecretLabel(provider) };
  }
  const env = process.env[data.value_ref];
  if (!env) {
    return { ok: false, error: `${provider}.${key} env var "${data.value_ref}" is not set on the server.` };
  }
  return { ok: true, value: env };
}

function missingSecretLabel(provider: string): string {
  switch (provider) {
    case "github": return "GitHub token is not configured.";
    case "vercel": return "Vercel token is not configured.";
    case "supabase": return "Supabase admin access is not configured.";
    default: return `${provider} secret is not configured.`;
  }
}

async function checkConnection(
  sb: SupabaseClient,
  projectId: string,
  provider: "github" | "vercel" | "supabase",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await sb
    .from("project_connections")
    .select("status")
    .eq("project_id", projectId)
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const labels = { github: "GitHub", vercel: "Vercel", supabase: "Supabase" } as const;
  if (!data) return { ok: false, error: `${labels[provider]} is not connected for this project.` };
  if (data.status !== "connected") {
    return { ok: false, error: `${labels[provider]} connection is "${data.status}", expected "connected".` };
  }
  return { ok: true };
}

// ---------- Provider adapters ----------
//
// Each adapter exposes a uniform shape:
//   isConfigured()              — secret/env availability check
//   verifyConnection(projectId) — DB-side connection row check
//   runStep(job, step)          — execute a step, returning a StepResult
//   missingConfigReason()       — human-readable reason when isConfigured()=false
//
// Phase 1: secret/connection wiring is real; outbound provider HTTP calls are
// intentionally NOT implemented and fail with "<provider>.<step>: provider
// call is not wired yet." rather than fake success.

export interface ProviderAdapter {
  name: string;
  isConfigured(sb: SupabaseClient, projectId: string): Promise<boolean>;
  verifyConnection(sb: SupabaseClient, projectId: string): Promise<{ ok: true } | { ok: false; error: string }>;
  runStep(sb: SupabaseClient, job: JobRow, step: StepRow): Promise<StepResult>;
  missingConfigReason(): string;
}

const githubAdapter: ProviderAdapter = {
  name: "github",
  async isConfigured(sb, projectId) {
    const r = await resolveSecret(sb, projectId, "github", "token");
    return r.ok;
  },
  verifyConnection: (sb, pid) => checkConnection(sb, pid, "github"),
  async runStep(sb, job, step) {
    const conn = await checkConnection(sb, job.project_id, "github");
    if (!conn.ok) return { status: "failed", error: conn.error };
    const tok = await resolveSecret(sb, job.project_id, "github", "token");
    if (!tok.ok) return { status: "failed", error: tok.error };
    return { status: "failed", error: `github.${step.step_key}: provider call is not wired yet.` };
  },
  missingConfigReason: () => "GitHub token is not configured.",
};

const vercelAdapter: ProviderAdapter = {
  name: "vercel",
  async isConfigured(sb, projectId) {
    const r = await resolveSecret(sb, projectId, "vercel", "token");
    return r.ok;
  },
  verifyConnection: (sb, pid) => checkConnection(sb, pid, "vercel"),
  async runStep(sb, job, step) {
    const conn = await checkConnection(sb, job.project_id, "vercel");
    if (!conn.ok) return { status: "failed", error: conn.error };
    const tok = await resolveSecret(sb, job.project_id, "vercel", "token");
    if (!tok.ok) return { status: "failed", error: tok.error };
    return { status: "failed", error: `vercel.${step.step_key}: provider call is not wired yet.` };
  },
  missingConfigReason: () => "Vercel token is not configured.",
};

const supabaseAdminAdapter: ProviderAdapter = {
  name: "supabase",
  async isConfigured(sb, projectId) {
    const r = await resolveSecret(sb, projectId, "supabase", "service_role");
    return r.ok;
  },
  verifyConnection: (sb, pid) => checkConnection(sb, pid, "supabase"),
  async runStep(sb, job, step) {
    const conn = await checkConnection(sb, job.project_id, "supabase");
    if (!conn.ok) return { status: "failed", error: conn.error };
    const tok = await resolveSecret(sb, job.project_id, "supabase", "service_role");
    if (!tok.ok) return { status: "failed", error: "Supabase admin access is not configured." };
    return { status: "failed", error: `supabase.${step.step_key}: provider call is not wired yet.` };
  },
  missingConfigReason: () => "Supabase admin access is not configured.",
};

// ---------- Build runner ----------
//
// Two execution modes are supported:
//
//   1. External worker (recommended for hosted runtime):
//        BUILD_RUNNER_URL    — POST endpoint that runs the command
//        BUILD_RUNNER_TOKEN  — bearer token sent as Authorization
//      The worker receives `{ command, kind, jobId, stepId, projectId, env }`
//      and must respond with `{ ok: boolean, exitCode, stdout, stderr,
//      durationMs, error? }`. The worker is responsible for actually
//      spawning the process — Lovable's Worker SSR runtime cannot.
//
//   2. Local mode (BUILD_RUNNER_MODE=local):
//        Attempts node:child_process.spawn. This works only on a real Node
//        host. Inside Lovable's Worker SSR runtime spawn is stubbed and
//        throws "[unenv] ... is not implemented yet!" — we catch that and
//        return a clear remediation message instead of pretending to build.
//
// In every other case we return the canonical "Build runner is not
// configured." error. We never fake success.

export interface BuildRunnerExecResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
}

function buildRunnerMode(): "external" | "local" | "none" {
  if (process.env.YAWB_BUILD_RUNNER_URL || process.env.BUILD_RUNNER_URL) return "external";
  if ((process.env.BUILD_RUNNER_MODE ?? "").toLowerCase() === "local") return "local";
  return "none";
}

function commandFor(stepKey: string, answerEnv?: string): { kind: "typecheck" | "build"; command: string } {
  if (stepKey === "typecheck") {
    return { kind: "typecheck", command: process.env.TYPECHECK_COMMAND || "npm run typecheck" };
  }
  // build.production "build" step
  const base = process.env.BUILD_COMMAND || "npm run build";
  // If user picked "preview" in the question, prefer a preview script when defined.
  if (answerEnv === "preview" && process.env.BUILD_PREVIEW_COMMAND) {
    return { kind: "build", command: process.env.BUILD_PREVIEW_COMMAND };
  }
  return { kind: "build", command: base };
}

async function execExternalBuild(payload: {
  command: string;
  kind: string;
  jobId: string;
  stepId: string;
  projectId: string;
}): Promise<BuildRunnerExecResult> {
  const url = (process.env.YAWB_BUILD_RUNNER_URL || process.env.BUILD_RUNNER_URL)!;
  const token = process.env.YAWB_BUILD_RUNNER_TOKEN || process.env.BUILD_RUNNER_TOKEN;
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let parsed: Partial<BuildRunnerExecResult> = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { /* non-JSON body */ }
    if (!res.ok) {
      return {
        ok: false,
        exitCode: parsed.exitCode ?? null,
        stdout: parsed.stdout ?? "",
        stderr: parsed.stderr ?? text.slice(0, 4000),
        durationMs: Date.now() - startedAt,
        error: parsed.error ?? `build runner returned HTTP ${res.status}`,
      };
    }
    return {
      ok: parsed.ok ?? (parsed.exitCode === 0),
      exitCode: parsed.exitCode ?? null,
      stdout: parsed.stdout ?? "",
      stderr: parsed.stderr ?? "",
      durationMs: parsed.durationMs ?? (Date.now() - startedAt),
      error: parsed.error,
    };
  } catch (e) {
    return {
      ok: false, exitCode: null, stdout: "", stderr: "",
      durationMs: Date.now() - startedAt,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function execLocalBuild(command: string): Promise<BuildRunnerExecResult> {
  const startedAt = Date.now();
  try {
    // Dynamic import so the Worker bundler does not eagerly resolve native bindings.
    const cp = await import("node:child_process");
    return await new Promise<BuildRunnerExecResult>((resolve) => {
      try {
        const child = cp.spawn(command, { shell: true });
        let stdout = ""; let stderr = "";
        child.stdout?.on("data", (d) => { stdout += d.toString(); });
        child.stderr?.on("data", (d) => { stderr += d.toString(); });
        child.on("error", (err) => {
          resolve({
            ok: false, exitCode: null, stdout, stderr,
            durationMs: Date.now() - startedAt,
            error: err instanceof Error ? err.message : String(err),
          });
        });
        child.on("close", (code) => {
          resolve({
            ok: code === 0,
            exitCode: code,
            stdout: stdout.slice(-16000),
            stderr: stderr.slice(-16000),
            durationMs: Date.now() - startedAt,
          });
        });
      } catch (e) {
        resolve({
          ok: false, exitCode: null, stdout: "", stderr: "",
          durationMs: Date.now() - startedAt,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false, exitCode: null, stdout: "", stderr: "",
      durationMs: Date.now() - startedAt,
      error: /not implemented|unenv/i.test(msg)
        ? "Build runner requires an external worker. Configure YAWB_BUILD_RUNNER_URL (or BUILD_RUNNER_URL)."
        : `local build failed: ${msg}`,
    };
  }
}

const buildAdapter: ProviderAdapter = {
  name: "build",
  async isConfigured() {
    return buildRunnerMode() !== "none";
  },
  async verifyConnection() {
    if (buildRunnerMode() === "none") {
      return { ok: false, error: "Build runner is not configured." };
    }
    return { ok: true };
  },
  async runStep(sb, job, step) {
    const mode = buildRunnerMode();
    if (mode === "none") {
      return { status: "failed", error: "Build runner is not configured." };
    }

    // Pull most recent answer for this step so build.production can branch
    // on preview vs production target.
    let answerEnv: string | undefined;
    if (job.type === "build.production" && step.step_key === "build") {
      const { data: qs } = await sb
        .from("project_job_questions")
        .select("step_id, answer, answered_at")
        .eq("job_id", job.id);
      const ans = (qs ?? []).find((q) => q.step_id === step.id && q.answered_at);
      const v = (ans?.answer as { value?: string } | null)?.value;
      if (typeof v === "string") answerEnv = v;
    }

    const { kind, command } = commandFor(step.step_key, answerEnv);
    const startedAtIso = new Date().toISOString();

    let exec: BuildRunnerExecResult;
    if (mode === "external") {
      exec = await execExternalBuild({
        command, kind, jobId: job.id, stepId: step.id, projectId: job.project_id,
      });
    } else {
      exec = await execLocalBuild(command);
    }

    const finishedAtIso = new Date().toISOString();
    const proof = {
      command,
      kind,
      mode,
      target: answerEnv ?? null,
      exitCode: exec.exitCode,
      durationMs: exec.durationMs,
      startedAt: startedAtIso,
      finishedAt: finishedAtIso,
      stdoutTail: exec.stdout.slice(-4000),
      stderrTail: exec.stderr.slice(-4000),
      ok: exec.ok,
      error: exec.error ?? null,
    };

    if (exec.ok) {
      return {
        status: "succeeded",
        output: proof,
        log: `${kind} ok: \`${command}\` exit ${exec.exitCode ?? 0} in ${exec.durationMs}ms`,
      };
    }
    return {
      status: "failed",
      output: proof,
      error: exec.error
        ? `${kind} failed: ${exec.error}`
        : `${kind} failed: \`${command}\` exited with ${exec.exitCode ?? "non-zero"}`,
      log: (exec.stderr || exec.stdout).slice(-1500) || (exec.error ?? "build failed"),
    };
  },
  missingConfigReason: () => "Build runner is not configured.",
};

// Server-side build runner config snapshot. Returns booleans only — never
// values — so the UI can show env presence without leaking secrets.
export function getBuildRunnerConfigServer(): {
  mode: "external" | "local" | "none";
  hasBuildRunnerUrl: boolean;
  hasBuildRunnerToken: boolean;
  hasBuildRunnerMode: boolean;
  hasBuildCommand: boolean;
  hasTypecheckCommand: boolean;
  hasBuildPreviewCommand: boolean;
  reason: string;
} {
  const mode = buildRunnerMode();
  const reason =
    mode === "external" ? "External build worker configured (BUILD_RUNNER_URL set)."
      : mode === "local" ? "Local mode set (BUILD_RUNNER_MODE=local). Requires a Node host that supports child_process; will fail on Worker runtimes."
        : "Build runner is not configured. Set BUILD_RUNNER_URL (recommended) or BUILD_RUNNER_MODE=local.";
  return {
    mode,
    hasBuildRunnerUrl: Boolean(process.env.BUILD_RUNNER_URL),
    hasBuildRunnerToken: Boolean(process.env.BUILD_RUNNER_TOKEN),
    hasBuildRunnerMode: Boolean(process.env.BUILD_RUNNER_MODE),
    hasBuildCommand: Boolean(process.env.BUILD_COMMAND),
    hasTypecheckCommand: Boolean(process.env.TYPECHECK_COMMAND),
    hasBuildPreviewCommand: Boolean(process.env.BUILD_PREVIEW_COMMAND),
    reason,
  };
}

const aiAdapter: ProviderAdapter = {
  name: "ai",
  async isConfigured() {
    return Boolean(process.env.LOVABLE_API_KEY || process.env.AI_GATEWAY_KEY);
  },
  async verifyConnection() {
    if (!(process.env.LOVABLE_API_KEY || process.env.AI_GATEWAY_KEY)) {
      return { ok: false, error: "AI gateway key is not configured." };
    }
    return { ok: true };
  },
  async runStep(_sb, job, _step) {
    if (!(process.env.LOVABLE_API_KEY || process.env.AI_GATEWAY_KEY)) {
      return { status: "failed", error: "AI gateway key is not configured." };
    }
    return { status: "failed", error: `${job.type}: provider call is not wired yet.` };
  },
  missingConfigReason: () => "AI gateway key is not configured.",
};

function adapterForJobType(type: string): ProviderAdapter | null {
  if (type.startsWith("github.")) return githubAdapter;
  if (type.startsWith("vercel.")) return vercelAdapter;
  if (type.startsWith("supabase.")) return supabaseAdminAdapter;
  if (type === "build.typecheck" || type === "build.production") return buildAdapter;
  if (type.startsWith("ai.")) return aiAdapter;
  return null;
}

// ---------- Step dispatch ----------

async function runStep(sb: SupabaseClient, job: JobRow, step: StepRow): Promise<StepResult> {
  // Common provider verification step.
  if (step.step_key === "verify_connection") {
    const adapter = adapterForJobType(job.type);
    if (!adapter) return { status: "skipped", log: "no provider verification needed" };
    if (adapter.name === "build" || adapter.name === "ai") {
      return { status: "skipped", log: `${adapter.name} verification not applicable` };
    }
    const r = await adapter.verifyConnection(sb, job.project_id);
    if (!r.ok) return { status: "failed", error: r.error };
    return { status: "succeeded", log: `${adapter.name} connection ok` };
  }

  // build.production demonstrates the waiting_for_input round-trip.
  if (job.type === "build.production" && step.step_key === "build") {
    const { data: qs } = await sb
      .from("project_job_questions")
      .select("step_id, answered_at")
      .eq("job_id", job.id);
    const answered = (qs ?? []).find((q) => q.step_id === step.id && q.answered_at);
    if (!answered) {
      return {
        status: "waiting_for_input",
        ask: {
          question: "Which environment should this build target?",
          kind: "single_choice",
          required: true,
          options: [
            { value: "preview",    label: "Preview",    description: "Run a preview build only." },
            { value: "production", label: "Production", description: "Run a production build." },
          ],
        },
      };
    }
    return buildAdapter.runStep(sb, job, step);
  }

  const adapter = adapterForJobType(job.type);
  if (!adapter) return { status: "failed", error: `Unknown job type: ${job.type}` };
  return adapter.runStep(sb, job, step);
}

// ---------- Public entry: claim and run one step ----------

export interface TickResult {
  advanced: boolean;
  jobId?: string;
  stepKey?: string;
  status?: StepResult["status"];
  error?: string;
  questionId?: string;
  cancelled?: boolean;
}

export async function runNextJobStepServer(input: {
  accessToken: string;
  projectId: string;
}): Promise<TickResult> {
  const sb = buildUserScopedClient(input.accessToken);

  const { data: jobRows, error: jErr } = await sb
    .from("project_jobs")
    .select("*")
    .eq("project_id", input.projectId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(1);
  if (jErr) return { advanced: false, error: jErr.message };
  const jobRow = (jobRows ?? [])[0] as JobRow | undefined;
  if (!jobRow) return { advanced: false };

  // Cancellation guard BEFORE we start any step.
  const { data: liveStatus } = await sb
    .from("project_jobs").select("status").eq("id", jobRow.id).maybeSingle();
  if (liveStatus?.status === "cancelled") {
    return { advanced: false, jobId: jobRow.id, cancelled: true };
  }

  if (jobRow.status === "queued") {
    await sb.from("project_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobRow.id);
    jobRow.status = "running";
  }

  const { data: stepRows, error: sErr } = await sb
    .from("project_job_steps")
    .select("*")
    .eq("job_id", jobRow.id)
    .order("position", { ascending: true });
  if (sErr) return { advanced: false, error: sErr.message };

  const steps = (stepRows ?? []) as StepRow[];
  const next = steps.find((s) => s.status === "queued");

  if (!next) {
    const anyFailed = steps.some((s) => s.status === "failed");
    const anyWaiting = steps.some((s) => s.status === "waiting_for_input");
    const allTerminal = !anyWaiting && steps.every((s) =>
      s.status === "succeeded" || s.status === "skipped" || s.status === "failed" || s.status === "cancelled"
    );
    if (allTerminal) {
      const finalStatus: JobStatus = anyFailed ? "failed" : "succeeded";
      const errorMsg = anyFailed
        ? (steps.find((s) => s.status === "failed")?.error ?? "step failed")
        : null;
      await sb.from("project_jobs").update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        error: errorMsg,
      }).eq("id", jobRow.id);
    }
    return { advanced: false, jobId: jobRow.id };
  }

  // Re-check cancellation right before claiming the step.
  const { data: liveStatus2 } = await sb
    .from("project_jobs").select("status").eq("id", jobRow.id).maybeSingle();
  if (liveStatus2?.status === "cancelled") {
    return { advanced: false, jobId: jobRow.id, cancelled: true };
  }

  const attemptNumber = Math.max(1, Number(next.attempt_number ?? 1));
  const startedAt = new Date().toISOString();

  await sb.from("project_job_steps")
    .update({ status: "running", started_at: startedAt })
    .eq("id", next.id);

  // Open an attempt row (best-effort; table may not exist on older deployments).
  const { data: attemptRow } = await sb.from("project_job_step_attempts")
    .insert({
      step_id: next.id,
      job_id: jobRow.id,
      attempt_number: attemptNumber,
      status: "running",
      input: next.input ?? {},
      started_at: startedAt,
    })
    .select("id")
    .maybeSingle();

  let result: StepResult;
  try {
    result = await runStep(sb, jobRow, next);
  } catch (e) {
    result = { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }

  const logEntry = { ts: new Date().toISOString(), msg: result.log ?? result.error ?? `step ${result.status}` };

  if (result.status === "waiting_for_input" && result.ask) {
    const { data: qRow, error: qErr } = await sb.from("project_job_questions")
      .insert({
        job_id: jobRow.id,
        step_id: next.id,
        question: result.ask.question,
        kind: result.ask.kind,
        options: result.ask.options ?? [],
        required: result.ask.required ?? true,
      })
      .select("id")
      .maybeSingle();
    if (qErr) {
      await sb.from("project_job_steps").update({
        status: "failed",
        error: `question insert failed: ${qErr.message}`,
        finished_at: new Date().toISOString(),
        logs: [...(next.logs ?? []), { ts: new Date().toISOString(), msg: `question insert failed: ${qErr.message}` }],
      }).eq("id", next.id);
      if (attemptRow?.id) {
        await sb.from("project_job_step_attempts").update({
          status: "failed", error: qErr.message,
          finished_at: new Date().toISOString(),
        }).eq("id", attemptRow.id);
      }
      return { advanced: true, jobId: jobRow.id, stepKey: next.step_key, status: "failed", error: qErr.message };
    }
    await sb.from("project_job_steps").update({
      status: "waiting_for_input",
      logs: [...(next.logs ?? []), { ts: new Date().toISOString(), msg: `awaiting answer: ${result.ask.question}` }],
    }).eq("id", next.id);
    await sb.from("project_jobs").update({ status: "waiting_for_input" }).eq("id", jobRow.id);
    if (attemptRow?.id) {
      await sb.from("project_job_step_attempts").update({
        status: "waiting_for_input",
        finished_at: new Date().toISOString(),
      }).eq("id", attemptRow.id);
    }
    return {
      advanced: true, jobId: jobRow.id, stepKey: next.step_key,
      status: "waiting_for_input", questionId: qRow?.id,
    };
  }

  const finishedAt = new Date().toISOString();
  await sb.from("project_job_steps").update({
    status: result.status,
    output: result.output ?? {},
    error: result.error ?? null,
    logs: [...(next.logs ?? []), logEntry],
    finished_at: finishedAt,
  }).eq("id", next.id);

  if (attemptRow?.id) {
    await sb.from("project_job_step_attempts").update({
      status: result.status,
      output: result.output ?? {},
      error: result.error ?? null,
      logs: [logEntry],
      finished_at: finishedAt,
    }).eq("id", attemptRow.id);
  }

  return {
    advanced: true,
    jobId: jobRow.id,
    stepKey: next.step_key,
    status: result.status,
    error: result.error,
  };
}
