// Server-only AI planner. Implements the real provider call for ai.plan jobs.
//
// SECURITY: This file is server-only (`.server.ts`). It reads LOVABLE_API_KEY /
// AI_GATEWAY_KEY from process.env and NEVER ships to the client bundle.
//
// Calls Lovable AI Gateway (OpenAI-compatible) with structured output via tool
// calling so the model can't return malformed JSON. Returns a typed PlanResult
// or a typed error.

import type { SupabaseClient } from "@supabase/supabase-js";

export const AI_PLANNER_NOT_CONFIGURED_ERROR =
  "AI planner provider is not configured.";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

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
    durationMs: number;
    contextSources: string[];
  };
}

export interface PlanContext {
  workspace: { id: string | null; name: string | null } | null;
  project: { id: string; name: string | null; description: string | null } | null;
  selectedPage: string | null;
  selectedEnvironment: string | null;
  recentJobs: Array<{ id: string; type: string; status: string; createdAt: string; error: string | null }>;
  latestProofs: Array<{ jobId: string; stepKey: string; output: Record<string, unknown> }>;
  github: { connected: boolean; repo?: string | null };
  vercel: { connected: boolean; project?: string | null; deployUrl?: string | null };
  supabase: { connected: boolean };
  chatRequest: string | null;
}

function getKey(): string | null {
  return process.env.LOVABLE_API_KEY || process.env.AI_GATEWAY_KEY || null;
}

/** True iff the AI planner provider has an API key configured. */
export function isAiPlannerConfigured(): boolean {
  return Boolean(getKey());
}

/**
 * Gather context needed for ai.plan from the database. Best-effort: each
 * fetch failure becomes a missingContext entry, never a hard failure.
 */
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
      .from("projects").select("id,name,description").eq("id", args.projectId).maybeSingle();
    if (error || !data) missing.push("project");
    else { projectRow = data as unknown as ProjectRow; sources.push("projects"); }
  } catch { missing.push("project"); }

  if (args.workspaceId) {
    try {
      const { data, error } = await sb
        .from("workspaces").select("id,name").eq("id", args.workspaceId).maybeSingle();
      if (error || !data) missing.push("workspace");
      else { workspaceRow = data as unknown as WorkspaceRow; sources.push("workspaces"); }
    } catch { missing.push("workspace"); }
  } else {
    missing.push("workspace");
  }

  // Recent jobs (last 20)
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
        id: String(r.id), type: String(r.type), status: String(r.status),
        createdAt: String(r.created_at), error: (r.error as string | null) ?? null,
      }));
    }
  } catch { missing.push("recent_jobs"); }

  // Latest proofs: take outputs from the most recent succeeded steps across recent jobs.
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
  } catch { missing.push("step_proofs"); }

  // Connections (github / vercel / supabase)
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
            repo: typeof meta.repo === "string" ? meta.repo
              : typeof meta.fullName === "string" ? meta.fullName : null,
          };
        } else if (provider === "vercel") {
          vercel = {
            connected,
            project: typeof meta.projectName === "string" ? meta.projectName
              : typeof meta.projectId === "string" ? meta.projectId : null,
            deployUrl: (row.url as string | null) ?? null,
          };
        } else if (provider === "supabase") {
          supabaseConn = { connected };
        }
      }
    }
  } catch { missing.push("connections"); }

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

const PLAN_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_plan",
    description: "Return a structured build plan with recommended next actions for a yawB project.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "1-2 sentence summary of the recommended next moves.",
        },
        recommendedActions: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Short action label (<=40 chars)." },
              reason: { type: "string", description: "Why this action helps now." },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              risk: { type: "string", enum: ["low", "medium", "high"] },
              category: {
                type: "string",
                enum: ["build_next", "improve_quality", "fix_failure", "publish_deploy", "inspect_proof"],
              },
              prompt: { type: "string", description: "Prefill chat prompt for the user to send." },
              requiredProviders: { type: "array", items: { type: "string" } },
            },
            required: ["label", "reason", "confidence", "risk", "category", "prompt", "requiredProviders"],
            additionalProperties: false,
          },
        },
        missingContext: {
          type: "array",
          items: { type: "string" },
          description: "Names of context pieces that were missing or weakened the plan.",
        },
      },
      required: ["summary", "recommendedActions", "missingContext"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT =
  "You are Monster Brain v1, the build planner for yawB. You inspect a project's " +
  "current state — workspace, project, selected page/environment, recent jobs, " +
  "proofs, and provider connections — and recommend the next 2–4 high-leverage " +
  "actions. Prefer fixing failures, then unblocking the user's chat request, " +
  "then advancing the build. Keep labels short. Be specific to the project's " +
  "name/description; never give generic advice. Always call submit_plan.";

/**
 * Run the AI planner. Returns either a parsed PlanResult or a typed error.
 * Never throws — the runner converts the result to a StepResult.
 */
export async function runAiPlan(args: {
  context: PlanContext;
  contextSources: string[];
  baseMissing: string[];
  model?: string;
}): Promise<
  | { ok: true; plan: PlanResult }
  | { ok: false; error: string; setupError?: boolean; httpStatus?: number; raw?: string }
> {
  const key = getKey();
  if (!key) {
    return { ok: false, error: AI_PLANNER_NOT_CONFIGURED_ERROR, setupError: true };
  }
  const model = args.model || DEFAULT_MODEL;
  const userMessage = JSON.stringify({
    instruction:
      "Inspect this yawB project context and call submit_plan with the next actions. " +
      "Tie each action to specific signals in the context (jobs, proofs, connections, chat).",
    context: args.context,
  });

  const startedAt = Date.now();
  let resp: Response;
  try {
    resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        tools: [PLAN_TOOL],
        tool_choice: { type: "function", function: { name: "submit_plan" } },
      }),
    });
  } catch (e) {
    return { ok: false, error: `AI planner network error: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!resp.ok) {
    const text = await safeText(resp);
    if (resp.status === 429) {
      return { ok: false, error: "AI planner rate limited (429). Try again in a moment.", httpStatus: 429, raw: text };
    }
    if (resp.status === 402) {
      return { ok: false, error: "AI planner credits exhausted (402). Add credits in Settings → Workspace → Usage.", httpStatus: 402, raw: text };
    }
    return { ok: false, error: `AI planner gateway error ${resp.status}.`, httpStatus: resp.status, raw: text };
  }

  let body: unknown;
  try { body = await resp.json(); }
  catch (e) { return { ok: false, error: `AI planner returned non-JSON: ${e instanceof Error ? e.message : String(e)}` }; }

  const parsed = parseToolCall(body);
  if (!parsed.ok) return { ok: false, error: parsed.error, raw: JSON.stringify(body).slice(0, 4000) };

  const durationMs = Date.now() - startedAt;
  const plan: PlanResult = {
    summary: String(parsed.value.summary ?? ""),
    recommendedActions: normalizeActions(parsed.value.recommendedActions),
    missingContext: dedupeStrings([
      ...args.baseMissing,
      ...((Array.isArray(parsed.value.missingContext) ? parsed.value.missingContext : []) as string[]),
    ]),
    proof: {
      model,
      durationMs,
      contextSources: dedupeStrings(args.contextSources),
    },
  };
  if (!plan.recommendedActions.length) {
    return { ok: false, error: "AI planner returned no actions.", raw: JSON.stringify(parsed.value).slice(0, 4000) };
  }
  return { ok: true, plan };
}

async function safeText(r: Response): Promise<string> {
  try { return (await r.text()).slice(0, 4000); } catch { return ""; }
}

function parseToolCall(body: unknown):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string }
{
  const choices = (body as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }> } | null)?.choices;
  const call = choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) {
    return { ok: false, error: "AI planner response missing tool_calls[0].function.arguments." };
  }
  try {
    const value = JSON.parse(call.function.arguments) as Record<string, unknown>;
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: `AI planner tool arguments not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function normalizeActions(input: unknown): PlanRecommendedAction[] {
  if (!Array.isArray(input)) return [];
  const out: PlanRecommendedAction[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const category = String(o.category ?? "build_next") as PlanCategory;
    const allowedCat: PlanCategory[] = ["build_next", "improve_quality", "fix_failure", "publish_deploy", "inspect_proof"];
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
