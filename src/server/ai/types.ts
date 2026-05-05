// Shared types for the yawB AI provider abstraction.
// All providers (OpenAI, Anthropic, Google, Lovable) implement AiProvider so
// the route layer is provider-agnostic.

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface BuildPlanStep {
  title: string;
  detail: string;
}
export interface BuildPlan {
  steps: BuildPlanStep[];
  estimatedMinutes: number;
}

export type AiProviderName = "openai" | "anthropic" | "google" | "lovable";

export type AiErrorCategory =
  | "missing_key"
  | "invalid_key"
  | "rate_limit"
  | "credits"
  | "permission"
  | "network"
  | "upstream"
  | "parse"
  | "unknown";

export type AiResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: string;
      status?: number;
      setupError?: boolean;
      category?: AiErrorCategory;
      provider?: AiProviderName;
    };

export interface AiChatArgs {
  messages: ChatMsg[];
  model?: string;
  fetchImpl?: typeof fetch;
}

export interface AiPlanArgs {
  prompt: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export interface AiProvider {
  readonly name: AiProviderName;
  readonly defaultModel: string;
  isConfigured(): boolean;
  chat(args: AiChatArgs): Promise<AiResult<{ content: string; model: string }>>;
  /** Returns an async iterable of text deltas (raw token chunks). */
  streamChat(args: AiChatArgs): Promise<AiResult<AsyncIterable<string>>>;
  plan(args: AiPlanArgs): Promise<AiResult<BuildPlan>>;
}

export const SYSTEM_PROMPT =
  "You are yawB, a helpful build assistant. Be concise, concrete, and propose " +
  "next steps the user can act on. Use markdown when useful.";

export const PLAN_SYSTEM =
  "You are yawB's build planner. Convert the user's prompt into a short, " +
  "ordered build plan and return it via the structured tool/function call.";

export function notConfiguredError(provider: AiProviderName): AiResult<never> {
  return {
    ok: false,
    setupError: true,
    error: `AI provider "${provider}" is not configured. Set the matching API key env var or change YAWB_AI_PROVIDER.`,
  };
}

export function networkError(e: unknown): AiResult<never> {
  return {
    ok: false,
    error: `AI provider network error: ${e instanceof Error ? e.message : String(e)}`,
  };
}

export function httpError(provider: AiProviderName, status: number): AiResult<never> {
  if (status === 429)
    return {
      ok: false,
      status,
      error: `${provider} rate limited (429). Try again shortly.`,
    };
  if (status === 402 || status === 403)
    return {
      ok: false,
      status,
      error: `${provider} returned ${status}. Check credits / API key permissions.`,
    };
  if (status === 401)
    return {
      ok: false,
      status,
      setupError: true,
      error: `${provider} returned 401. The API key is invalid or missing.`,
    };
  return { ok: false, status, error: `${provider} error ${status}.` };
}

export function clampPlan(steps: BuildPlanStep[], estimatedMinutes: unknown): BuildPlan {
  const safeSteps = steps
    .filter((s) => s && typeof s.title === "string" && typeof s.detail === "string")
    .map((s) => ({ title: String(s.title), detail: String(s.detail) }));
  const minutes =
    typeof estimatedMinutes === "number" && Number.isFinite(estimatedMinutes)
      ? Math.max(1, Math.min(240, Math.round(estimatedMinutes)))
      : Math.max(2, safeSteps.length * 3);
  return { steps: safeSteps, estimatedMinutes: minutes };
}

/** JSON Schema used for structured plan extraction across providers. */
export const PLAN_PARAMETERS_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
    estimatedMinutes: { type: "number", minimum: 1, maximum: 240 },
  },
  required: ["steps", "estimatedMinutes"],
} as const;

export const PLAN_TOOL_NAME = "submit_build_plan";
export const PLAN_TOOL_DESCRIPTION = "Return a short ordered build plan for the user prompt.";
