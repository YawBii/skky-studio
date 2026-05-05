// Server-only AI planner. Now uses the yawB-owned AI provider abstraction
// (`src/server/ai/tool-call.ts`) so YAWB_AI_PROVIDER / YAWB_AI_MODEL govern
// which underlying provider runs the planner. SECURITY: server-only file.

import type { SupabaseClient } from "@supabase/supabase-js";
import { runToolCall } from "./ai/tool-call";
import { resolveProvider } from "./ai/resolver";

export const AI_PLANNER_NOT_CONFIGURED_ERROR = "AI planner provider is not configured.";

export type PlanCategory =
  | "build_next"
  | "improve_quality"
  | "fix_failure"
  | "publish_deploy"
  | "inspect_proof";

export type PlanRisk = "low" | "medium" | "high";

export interface PlanRecommendedAction {
  label: string;
  reason: string;
  confidence: number;
  risk: PlanRisk;
  category: PlanCategory;
  prompt: string;
  requiredProviders: string[];
}

export interface PlanResult {
  summary: string;
  recommendedActions: PlanRecommendedAction[];
  missingContext: string[];
  proof: {
    model: string;
    provider: string;
    durationMs: number;
    contextSources: string[];
  };
}

export interface PlanContext {
  workspace: { id: string | null; name: string | null } | null;
  project: { id: string; name: string | null; description: string | null } | null;
  selectedPage: string | null;
  selectedEnvironment: string | null;
  recentJobs: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
    error: string | null;
  }>;
  latestProofs: Array<{ jobId: string; stepKey: string; output: Record<string, unknown> }>;
  github: { connected: boolean; repo?: string | null };
  vercel: { connected: boolean; project?: string | null; deployUrl?: string | null };
  supabase: { connected: boolean };
  chatRequest: string | null;
}

/** True iff the active yawB AI provider has a configured key. */
export function isAiPlannerConfigured(): boolean {
  return resolveProvider().configured;
}

export async function gatherPlanContext(
  sb: SupabaseClient,
  args: {
    projectId: string;
    workspaceId: string | null;
    selectedPage?: string | null;
    selectedEnvironment?: string | null;
    chatRequest?: string | null;
  },
): Promise<{ context: PlanContext; missing: string[]; sources: string[] }> {
  const missing: string[] = [];
  const sources: string[] = [];
  type ProjectRow = { id: string; name: string | null; description: string | null };
  type WorkspaceRow = { id: string; name: string | null };
  let projectRow: ProjectRow | null = null;
  let workspaceRow: WorkspaceRow | null = null;

  try {
    const { data, error } = await sb
      .from("projects")
      .select("id,name,description")
      .eq("id", args.projectId)
      .maybeSingle();
    if (error || !data) missing.push("project");
    else {
      projectRow = data as unknown as ProjectRow;
      sources.push("projects");
    }
  } catch {
    missing.push("project");
  }

  if (args.workspaceId) {
    try {
      const { data, error } = await sb
        .from("workspaces")
        .select("id,name")
        .eq("id", args.workspaceId)
        .maybeSingle();
      if (error || !data) missing.push("workspace");
      else {
        workspaceRow = data as unknown as WorkspaceRow;
        sources.push("workspaces");
      }
    } catch {
      missing.push("workspace");
    }
  } else {
    missing.push("workspace");
  }

  let recentJobs: PlanContext["recentJobs"] = [];
  try {
    const { data, error } = await sb
      .from("project_jobs")
      .select("id,type,status,created_at,error")
      .eq("project_id", args.projectId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) missing.push("recent_jobs");
    else {
      sources.push("project_jobs");
      recentJobs = (data ?? []).map((r) => ({
        id: String(r.id),
        type: String(r.type),
        status: String(r.status),
        createdAt: String(r.created_at),
        error: (r.error as string | null) ?? null,
      }));
    }
  } catch {
    missing.push("recent_jobs");
  }

  let latestProofs: PlanContext["latestProofs"] = [];
  try {
    if (recentJobs.length) {
      const ids = recentJobs.slice(0, 5).map((j) => j.id);
      const { data, error } = await sb
        .from("project_job_steps")
        .select("job_id,step_key,output,status,finished_at")
        .in("job_id", ids)
        .eq("status", "succeeded")
        .order("finished_at", { ascending: false })
        .limit(10);
      if (error) missing.push("step_proofs");
      else {
        sources.push("project_job_steps");
        latestProofs = (data ?? []).map((r) => ({
          jobId: String(r.job_id),
          stepKey: String(r.step_key),
          output: (r.output as Record<string, unknown>) ?? {},
        }));
      }
    }
  } catch {
    missing.push("step_proofs");
  }

  let github: PlanContext["github"] = { connected: false };
  let vercel: PlanContext["vercel"] = { connected: false };
  let supabaseConn: PlanContext["supabase"] = { connected: false };
  try {
    const { data, error } = await sb
      .from("project_connections")
      .select("provider,status,metadata,url")
      .eq("project_id", args.projectId);
    if (error) missing.push("connections");
    else {
      sources.push("project_connections");
      for (const row of data ?? []) {
        const provider = String(row.provider);
        const connected = String(row.status) === "connected";
        const meta = (row.metadata as Record<string, unknown> | null) ?? {};
        if (provider === "github") {
          github = {
            connected,
            repo:
              typeof meta.repo === "string"
                ? meta.repo
                : typeof meta.fullName === "string"
                  ? meta.fullName
                  : null,
          };
        } else if (provider === "vercel") {
          vercel = {
            connected,
            project:
              typeof meta.projectName === "string"
                ? meta.projectName
                : typeof meta.projectId === "string"
                  ? meta.projectId
                  : null,
            deployUrl: (row.url as string | null) ?? null,
          };
        } else if (provider === "supabase") {
          supabaseConn = { connected };
        }
      }
    }
  } catch {
    missing.push("connections");
  }

  return {
    context: {
      workspace: workspaceRow ? { id: workspaceRow.id, name: workspaceRow.name } : null,
      project: projectRow,
      selectedPage: args.selectedPage ?? null,
      selectedEnvironment: args.selectedEnvironment ?? null,
      recentJobs,
      latestProofs,
      github,
      vercel,
      supabase: supabaseConn,
      chatRequest: args.chatRequest ?? null,
    },
    missing,
    sources,
  };
}

const PLAN_TOOL_PARAMS: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: { type: "string", description: "1-2 sentence summary of recommended next moves." },
    recommendedActions: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          reason: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          risk: { type: "string", enum: ["low", "medium", "high"] },
          category: {
            type: "string",
            enum: [
              "build_next",
              "improve_quality",
              "fix_failure",
              "publish_deploy",
              "inspect_proof",
            ],
          },
          prompt: { type: "string" },
          requiredProviders: { type: "array", items: { type: "string" } },
        },
        required: ["label", "reason", "confidence", "risk", "category", "prompt", "requiredProviders"],
      },
    },
    missingContext: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "recommendedActions", "missingContext"],
};

const SYSTEM_PROMPT =
  "You are Monster Brain v1, the build planner for yawB. Inspect the project " +
  "context (workspace, project, jobs, proofs, connections, chat) and recommend " +
  "the next 2–4 high-leverage actions. Prefer fixing failures, then unblocking " +
  "the user's chat request, then advancing the build. Always call submit_plan.";

export async function runAiPlan(args: {
  context: PlanContext;
  contextSources: string[];
  baseMissing: string[];
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<
  | { ok: true; plan: PlanResult }
  | {
      ok: false;
      error: string;
      setupError?: boolean;
      httpStatus?: number;
      category?: string;
      raw?: string;
    }
> {
  if (!isAiPlannerConfigured()) {
    return { ok: false, error: AI_PLANNER_NOT_CONFIGURED_ERROR, setupError: true, category: "missing_key" };
  }
  const startedAt = Date.now();
  const userMessage = JSON.stringify({
    instruction:
      "Inspect this yawB project context and call submit_plan with the next actions. " +
      "Tie each action to specific signals (jobs, proofs, connections, chat).",
    context: args.context,
  });

  const r = await runToolCall({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    tool: {
      name: "submit_plan",
      description: "Return a structured build plan with recommended next actions for a yawB project.",
      parameters: PLAN_TOOL_PARAMS,
    },
    model: args.model,
    fetchImpl: args.fetchImpl,
  });
  if (!r.ok) {
    return {
      ok: false,
      error: r.error,
      setupError: r.setupError,
      httpStatus: r.status,
      category: r.category,
    };
  }

  const value = r.value.value;
  const durationMs = Date.now() - startedAt;
  const plan: PlanResult = {
    summary: String(value.summary ?? ""),
    recommendedActions: normalizeActions(value.recommendedActions),
    missingContext: dedupeStrings([
      ...args.baseMissing,
      ...((Array.isArray(value.missingContext) ? value.missingContext : []) as string[]),
    ]),
    proof: {
      model: r.value.model,
      provider: r.value.provider,
      durationMs,
      contextSources: dedupeStrings(args.contextSources),
    },
  };
  if (!plan.recommendedActions.length) {
    return { ok: false, error: "AI planner returned no actions.", category: "parse" };
  }
  return { ok: true, plan };
}

function normalizeActions(input: unknown): PlanRecommendedAction[] {
  if (!Array.isArray(input)) return [];
  const out: PlanRecommendedAction[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const category = String(o.category ?? "build_next") as PlanCategory;
    const allowedCat: PlanCategory[] = [
      "build_next",
      "improve_quality",
      "fix_failure",
      "publish_deploy",
      "inspect_proof",
    ];
    const risk = String(o.risk ?? "low") as PlanRisk;
    const allowedRisk: PlanRisk[] = ["low", "medium", "high"];
    const conf = Number(o.confidence);
    out.push({
      label: String(o.label ?? "").slice(0, 80),
      reason: String(o.reason ?? ""),
      confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5,
      risk: allowedRisk.includes(risk) ? risk : "low",
      category: allowedCat.includes(category) ? category : "build_next",
      prompt: String(o.prompt ?? ""),
      requiredProviders: Array.isArray(o.requiredProviders)
        ? o.requiredProviders.filter((x) => typeof x === "string").map(String)
        : [],
    });
  }
  return out;
}

function dedupeStrings(xs: string[]): string[] {
  return Array.from(new Set(xs.filter((s) => typeof s === "string" && s.length > 0)));
}
