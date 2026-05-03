// Monster job runner shim.
//
// This file routes explicit command-first app build jobs through Monster
// generation while preserving the legacy runner for provider/build jobs and
// normal planning conversations.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runNextJobStepServer as runLegacyNextJobStepServer } from "./jobs-runner.server";
import { generateMonsterProject } from "../services/monster-orchestrator";
import { persistMonsterGeneratedFiles } from "../services/monster-persistence";
import type { DesignMode } from "../services/monster-brain-generator";

export interface MonsterRunnerTickResult {
  advanced: boolean;
  jobId?: string;
  stepKey?: string;
  status?: "succeeded" | "failed" | "skipped" | "waiting_for_input";
  error?: string;
  questionId?: string;
}

interface JobRow {
  id: string;
  project_id: string;
  workspace_id: string;
  type: string;
  status: string;
  title: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
}

interface StepRow {
  id: string;
  job_id: string;
  step_key: string;
  title: string;
  status: string;
  position: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  logs?: Array<{ ts: string; msg: string }>;
}

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

function now() {
  return new Date().toISOString();
}

async function findNextJob(sb: SupabaseClient, projectId: string): Promise<JobRow | null> {
  const { data, error } = await sb
    .from("project_jobs")
    .select("id, project_id, workspace_id, type, status, title, input, output")
    .eq("project_id", projectId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`job lookup failed: ${error.message}`);
  return (data as JobRow | null) ?? null;
}

async function findMonsterStep(sb: SupabaseClient, job: JobRow): Promise<StepRow | null> {
  const keys = job.type === "ai.plan" ? ["plan", "generate"] : ["generate", "plan"];
  const { data, error } = await sb
    .from("project_job_steps")
    .select("id, job_id, step_key, title, status, position, input, output, logs")
    .eq("job_id", job.id)
    .in("step_key", keys)
    .in("status", ["queued", "running"])
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`step lookup failed: ${error.message}`);
  return (data as StepRow | null) ?? null;
}

function jobPrompt(job: JobRow): string {
  const input = (job.input ?? {}) as Record<string, unknown>;
  return [
    job.title ?? "",
    typeof input.chatRequest === "string" ? input.chatRequest : "",
    typeof input.prompt === "string" ? input.prompt : "",
    typeof input.message === "string" ? input.message : "",
    typeof input.request === "string" ? input.request : "",
  ]
    .join(" ")
    .trim();
}

function isExplicitMonsterBuildIntent(job: JobRow): boolean {
  const text = jobPrompt(job).toLowerCase();
  if (!text) return false;

  if (
    /\b(rollout plan|migration strategy|implementation plan|project plan|go[- ]to[- ]market plan|roadmap|strategy|proposal|spec|prd|requirements|architecture review|explain|summari[sz]e|compare|audit|review)\b/.test(
      text,
    )
  ) {
    return false;
  }

  if (
    /\b(build|create|make|ship|scaffold|implement)\b.{0,80}\b(app|site|website|web app|dashboard|admin panel|portal|landing page|saas|marketplace|crm|tool|backend|frontend|full first version|first version)\b/.test(
      text,
    )
  ) {
    return true;
  }

  if (
    /\b(build this as|generate the full first version|generate first version|build the first screen|build first screen)\b/.test(
      text,
    )
  ) {
    return true;
  }

  if (
    /\b(auth|supabase|backend|database|admin panel|payments?)\b/.test(text) &&
    /\b(app|site|website|dashboard|portal|platform|saas|marketplace)\b/.test(text)
  ) {
    return true;
  }

  return false;
}

function shouldMonsterHandle(job: JobRow): boolean {
  if (job.type === "ai.generate_changes") return true;
  if (job.type === "ai.plan" && isExplicitMonsterBuildIntent(job)) return true;
  return false;
}

async function listConnectedProviders(sb: SupabaseClient, projectId: string): Promise<string[]> {
  const { data } = await sb
    .from("project_connections")
    .select("provider, status")
    .eq("project_id", projectId)
    .eq("status", "connected");
  return (data ?? [])
    .map((row: { provider?: string }) => String(row.provider ?? ""))
    .filter(Boolean);
}

async function hasGithubConnection(sb: SupabaseClient, projectId: string): Promise<boolean> {
  const { data } = await sb
    .from("project_connections")
    .select("id")
    .eq("project_id", projectId)
    .eq("provider", "github")
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

async function readPreviousIndexHtml(
  sb: SupabaseClient,
  projectId: string,
): Promise<string | null> {
  const { data } = await sb
    .from("project_files")
    .select("content")
    .eq("project_id", projectId)
    .eq("path", "index.html")
    .maybeSingle();
  return typeof data?.content === "string" ? data.content : null;
}

async function markJobAndStep(input: {
  sb: SupabaseClient;
  jobId: string;
  stepId: string;
  status: "running" | "succeeded" | "failed";
  output?: Record<string, unknown>;
  error?: string | null;
  log?: string;
}) {
  const stamp = now();
  const stepPatch: Record<string, unknown> = {
    status: input.status,
    ...(input.status === "running" ? { started_at: stamp } : { finished_at: stamp }),
    ...(input.output ? { output: input.output } : {}),
    ...(input.error !== undefined ? { error: input.error } : {}),
  };
  if (input.log) stepPatch.logs = [{ ts: stamp, msg: input.log }];
  await input.sb.from("project_job_steps").update(stepPatch).eq("id", input.stepId);

  const jobPatch: Record<string, unknown> = {
    status: input.status === "running" ? "running" : input.status,
    ...(input.status === "running" ? { started_at: stamp } : { finished_at: stamp }),
    ...(input.output ? { output: input.output } : {}),
    ...(input.error !== undefined ? { error: input.error } : {}),
  };
  await input.sb.from("project_jobs").update(jobPatch).eq("id", input.jobId);
}

async function runMonsterGenerateChanges(input: {
  sb: SupabaseClient;
  job: JobRow;
  step: StepRow;
}): Promise<MonsterRunnerTickResult> {
  await markJobAndStep({
    sb: input.sb,
    jobId: input.job.id,
    stepId: input.step.id,
    status: "running",
    log: `Monster generation started from ${input.job.type}.`,
  });

  if (await hasGithubConnection(input.sb, input.job.project_id)) {
    const error =
      "This project is linked to GitHub, so yawB will not redesign or regenerate it as a new project.";
    await markJobAndStep({
      sb: input.sb,
      jobId: input.job.id,
      stepId: input.step.id,
      status: "failed",
      error,
    });
    return {
      advanced: true,
      jobId: input.job.id,
      stepKey: input.step.step_key,
      status: "failed",
      error,
    };
  }

  const { data: project, error: projectErr } = await input.sb
    .from("projects")
    .select("id, name, description")
    .eq("id", input.job.project_id)
    .maybeSingle();
  if (projectErr || !project) {
    const error = projectErr?.message ?? "project not found";
    await markJobAndStep({
      sb: input.sb,
      jobId: input.job.id,
      stepId: input.step.id,
      status: "failed",
      error,
    });
    return {
      advanced: true,
      jobId: input.job.id,
      stepKey: input.step.step_key,
      status: "failed",
      error,
    };
  }

  const jobInput = (input.job.input ?? {}) as Record<string, unknown>;
  const chatRequest =
    typeof jobInput.chatRequest === "string"
      ? jobInput.chatRequest
      : typeof jobInput.prompt === "string"
        ? jobInput.prompt
        : typeof jobInput.message === "string"
          ? jobInput.message
          : typeof jobInput.request === "string"
            ? jobInput.request
            : input.job.title;
  const regenerationSeed =
    typeof jobInput.regenerationSeed === "string" ? jobInput.regenerationSeed : null;
  const forceVariant = jobInput.forceVariant === true || Boolean(regenerationSeed);
  const requestedDesignMode =
    typeof jobInput.designMode === "string" ? (jobInput.designMode as DesignMode) : null;

  try {
    const generation = generateMonsterProject({
      project: {
        id: String(project.id),
        name: String(project.name ?? ""),
        description: (project.description as string | null) ?? null,
      },
      chatRequest,
      connectedProviders: await listConnectedProviders(input.sb, input.job.project_id),
      requestedDesignMode,
      previousIndexHtml: await readPreviousIndexHtml(input.sb, input.job.project_id),
      regenerationSeed,
      forceVariant,
      production: true,
    });

    const persisted = await persistMonsterGeneratedFiles({
      sb: input.sb,
      projectId: input.job.project_id,
      generation,
    });

    if (!persisted.ok) {
      const error = persisted.error ?? "Monster persistence failed";
      await markJobAndStep({
        sb: input.sb,
        jobId: input.job.id,
        stepId: input.step.id,
        status: "failed",
        error,
        output: { written: persisted.written },
      });
      return {
        advanced: true,
        jobId: input.job.id,
        stepKey: input.step.step_key,
        status: "failed",
        error,
      };
    }

    const output = {
      ...(persisted.output ?? generation.output),
      written: persisted.written,
      handledJobType: input.job.type,
      handledStepKey: input.step.step_key,
    };
    await markJobAndStep({
      sb: input.sb,
      jobId: input.job.id,
      stepId: input.step.id,
      status: "succeeded",
      output,
      error: null,
      log: `Monster generated ${persisted.written.length} files: ${generation.output.blueprintSummary}`,
    });
    return {
      advanced: true,
      jobId: input.job.id,
      stepKey: input.step.step_key,
      status: "succeeded",
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await markJobAndStep({
      sb: input.sb,
      jobId: input.job.id,
      stepId: input.step.id,
      status: "failed",
      error,
    });
    return {
      advanced: true,
      jobId: input.job.id,
      stepKey: input.step.step_key,
      status: "failed",
      error,
    };
  }
}

export async function runNextJobStepServer(input: {
  accessToken: string;
  projectId: string;
}): Promise<MonsterRunnerTickResult> {
  const sb = buildUserScopedClient(input.accessToken);
  const job = await findNextJob(sb, input.projectId);
  if (!job || !shouldMonsterHandle(job)) {
    return runLegacyNextJobStepServer(input);
  }
  const step = await findMonsterStep(sb, job);
  if (!step) {
    return runLegacyNextJobStepServer(input);
  }
  return runMonsterGenerateChanges({ sb, job, step });
}
