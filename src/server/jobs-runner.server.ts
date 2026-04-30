// Server-only job runner. Privileged work (provider tokens, service-role
// access) lives here and NEVER runs in the browser. The runner uses a
// Supabase client built per-request with the caller's bearer token, so RLS
// still enforces project membership — but secret resolution and outbound
// provider calls happen on the server.
//
// SECURITY: this module imports `process.env` and is intentionally suffixed
// `.server.ts` so Vite import-protection blocks it from any client bundle.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------- Types (mirrored from client; kept inline to keep this module
// importable without dragging in client-only code paths) ----------

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
}

interface AskInput {
  question: string;
  kind: QuestionKind;
  options?: Array<{ value: string; label: string; description?: string }>;
  required?: boolean;
}
interface StepResult {
  status: "succeeded" | "failed" | "skipped" | "waiting_for_input";
  output?: Record<string, unknown>;
  error?: string;
  log?: string;
  ask?: AskInput;
}

// ---------- Per-request Supabase client (RLS as the caller) ----------

function buildUserScopedClient(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "";
  if (!url || !key) {
    throw new Error("Server Supabase env not configured (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY).");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// ---------- Server-side secret resolution ----------
// project_secrets.value_ref points to an env var name. The actual value is
// only ever read here on the server.

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
    const labels: Record<string, string> = {
      github: "GitHub token", vercel: "Vercel token",
      supabase: "Supabase admin access",
    };
    return { ok: false, error: `${labels[provider] ?? `${provider}.${key}`} is not configured.` };
  }
  const env = process.env[data.value_ref];
  if (!env) {
    return { ok: false, error: `${provider}.${key} env var "${data.value_ref}" is not set on the server.` };
  }
  return { ok: true, value: env };
}

async function requireConnection(
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

// ---------- Provider step execution (server-side) ----------
//
// Phase 1 keeps the actual provider HTTP calls as clean failures when the
// required env var is missing. When the secret IS present, we still report a
// "not wired yet" error rather than fake success — the goal of this phase is
// to prove the architecture is server-side end-to-end.

async function runGitHubStep(sb: SupabaseClient, job: JobRow, step: StepRow): Promise<StepResult> {
  const conn = await requireConnection(sb, job.project_id, "github");
  if (!conn.ok) return { status: "failed", error: conn.error };
  const tok = await resolveSecret(sb, job.project_id, "github", "token");
  if (!tok.ok) return { status: "failed", error: tok.error };
  return {
    status: "failed",
    error: `github.${step.step_key}: token resolved server-side, but provider call is not wired yet (Phase 1).`,
  };
}

async function runVercelStep(sb: SupabaseClient, job: JobRow, step: StepRow): Promise<StepResult> {
  const conn = await requireConnection(sb, job.project_id, "vercel");
  if (!conn.ok) return { status: "failed", error: conn.error };
  const tok = await resolveSecret(sb, job.project_id, "vercel", "token");
  if (!tok.ok) return { status: "failed", error: tok.error };
  return {
    status: "failed",
    error: `vercel.${step.step_key}: token resolved server-side, but provider call is not wired yet (Phase 1).`,
  };
}

async function runSupabaseAdminStep(sb: SupabaseClient, job: JobRow, step: StepRow): Promise<StepResult> {
  const conn = await requireConnection(sb, job.project_id, "supabase");
  if (!conn.ok) return { status: "failed", error: conn.error };
  // Service-role lookup goes via project_secrets → process.env. Browser never sees it.
  const tok = await resolveSecret(sb, job.project_id, "supabase", "service_role");
  if (!tok.ok) return { status: "failed", error: "Supabase admin access is not configured." };
  return {
    status: "failed",
    error: `supabase.${step.step_key}: service role resolved server-side, but admin call is not wired yet (Phase 1).`,
  };
}

async function runBuildStep(_sb: SupabaseClient, _job: JobRow, step: StepRow): Promise<StepResult> {
  return {
    status: "failed",
    error: `build.${step.step_key}: requires a server-side build worker. Not wired in Phase 1.`,
  };
}

async function runAIStep(_sb: SupabaseClient, job: JobRow, _step: StepRow): Promise<StepResult> {
  if (!process.env.LOVABLE_API_KEY && !process.env.AI_GATEWAY_KEY) {
    return { status: "failed", error: "AI gateway key is not configured on the server." };
  }
  return {
    status: "failed",
    error: `${job.type}: AI gateway resolved server-side, but provider call is not wired yet (Phase 1).`,
  };
}

// ---------- Step dispatch ----------

async function runStep(sb: SupabaseClient, job: JobRow, step: StepRow): Promise<StepResult> {
  // Connection verification step — common across providers.
  if (step.step_key === "verify_connection") {
    const provider = job.type.startsWith("github.") ? "github"
      : job.type.startsWith("vercel.") ? "vercel"
      : job.type.startsWith("supabase.") ? "supabase"
      : null;
    if (!provider) return { status: "skipped", log: "no provider verification needed" };
    const r = await requireConnection(sb, job.project_id, provider);
    if (!r.ok) return { status: "failed", error: r.error };
    return { status: "succeeded", log: `${provider} connection ok` };
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
    return runBuildStep(sb, job, step);
  }

  if (job.type.startsWith("github.")) return runGitHubStep(sb, job, step);
  if (job.type.startsWith("vercel.")) return runVercelStep(sb, job, step);
  if (job.type.startsWith("supabase.")) return runSupabaseAdminStep(sb, job, step);
  if (job.type === "build.typecheck" || job.type === "build.production") return runBuildStep(sb, job, step);
  if (job.type.startsWith("ai.")) return runAIStep(sb, job, step);

  return { status: "failed", error: `Unknown job type: ${job.type}` };
}

// ---------- Public entry: claim and run one step ----------

export interface TickResult {
  advanced: boolean;
  jobId?: string;
  stepKey?: string;
  status?: StepResult["status"];
  error?: string;
  questionId?: string;
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
      const errorMsg = anyFailed ? (steps.find((s) => s.status === "failed")?.logs?.slice(-1)[0]?.msg ?? "step failed") : null;
      await sb.from("project_jobs").update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        error: errorMsg,
      }).eq("id", jobRow.id);
    }
    return { advanced: false, jobId: jobRow.id };
  }

  await sb.from("project_job_steps")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", next.id);

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
      return { advanced: true, jobId: jobRow.id, stepKey: next.step_key, status: "failed", error: qErr.message };
    }
    await sb.from("project_job_steps").update({
      status: "waiting_for_input",
      logs: [...(next.logs ?? []), { ts: new Date().toISOString(), msg: `awaiting answer: ${result.ask.question}` }],
    }).eq("id", next.id);
    await sb.from("project_jobs").update({ status: "waiting_for_input" }).eq("id", jobRow.id);
    return {
      advanced: true, jobId: jobRow.id, stepKey: next.step_key,
      status: "waiting_for_input", questionId: qRow?.id,
    };
  }

  await sb.from("project_job_steps").update({
    status: result.status,
    output: result.output ?? {},
    error: result.error ?? null,
    logs: [...(next.logs ?? []), logEntry],
    finished_at: new Date().toISOString(),
  }).eq("id", next.id);

  return {
    advanced: true,
    jobId: jobRow.id,
    stepKey: next.step_key,
    status: result.status,
    error: result.error,
  };
}
