// Server-only helper for the Lovable AI Gateway.
// Used by /api/public/ai-chat route to provide chat (streaming + non-streaming)
// and structured plan extraction. Never bundled to the client.

export const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const AI_DEFAULT_MODEL = "google/gemini-3-flash-preview";
export const AI_NOT_CONFIGURED = "AI gateway is not configured (set LOVABLE_API_KEY).";

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

function getKey(): string | null {
  return process.env.LOVABLE_API_KEY || process.env.AI_GATEWAY_KEY || null;
}

export function isAiGatewayConfigured(): boolean {
  return Boolean(getKey());
}

const SYSTEM_PROMPT =
  "You are yawB, a helpful build assistant. Be concise, concrete, and propose " +
  "next steps the user can act on. Use markdown when useful.";

export type GatewayResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number; setupError?: boolean };

/** Non-streaming chat completion. */
export async function chatCompletion(args: {
  messages: ChatMsg[];
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<GatewayResult<{ content: string; model: string }>> {
  const key = getKey();
  if (!key) return { ok: false, error: AI_NOT_CONFIGURED, setupError: true };
  const model = args.model || AI_DEFAULT_MODEL;
  const f = args.fetchImpl || fetch;
  let resp: Response;
  try {
    resp = await f(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...args.messages],
      }),
    });
  } catch (e) {
    return { ok: false, error: `AI gateway network error: ${e instanceof Error ? e.message : e}` };
  }
  if (!resp.ok) return mapHttpError(resp);
  let body: unknown;
  try {
    body = await resp.json();
  } catch (e) {
    return {
      ok: false,
      error: `AI gateway non-JSON response: ${e instanceof Error ? e.message : e}`,
    };
  }
  const content =
    (body as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message
      ?.content ?? "";
  if (!content) return { ok: false, error: "AI gateway returned empty content." };
  return { ok: true, value: { content, model } };
}

/** Streaming chat completion. Returns the upstream Response so the route can
 *  pipe the body straight to the client as SSE. */
export async function streamChatCompletion(args: {
  messages: ChatMsg[];
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<GatewayResult<Response>> {
  const key = getKey();
  if (!key) return { ok: false, error: AI_NOT_CONFIGURED, setupError: true };
  const model = args.model || AI_DEFAULT_MODEL;
  const f = args.fetchImpl || fetch;
  let resp: Response;
  try {
    resp = await f(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...args.messages],
      }),
    });
  } catch (e) {
    return { ok: false, error: `AI gateway network error: ${e instanceof Error ? e.message : e}` };
  }
  if (!resp.ok) return mapHttpError(resp);
  return { ok: true, value: resp };
}

export interface BuildPlanStep {
  title: string;
  detail: string;
}
export interface BuildPlan {
  steps: BuildPlanStep[];
  estimatedMinutes: number;
}

const PLAN_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_build_plan",
    description: "Return a short ordered build plan for the user prompt.",
    parameters: {
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
            additionalProperties: false,
          },
        },
        estimatedMinutes: { type: "number", minimum: 1, maximum: 240 },
      },
      required: ["steps", "estimatedMinutes"],
      additionalProperties: false,
    },
  },
};

/** Structured plan via tool-calling. */
export async function planFromPrompt(args: {
  prompt: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<GatewayResult<BuildPlan>> {
  const key = getKey();
  if (!key) return { ok: false, error: AI_NOT_CONFIGURED, setupError: true };
  const model = args.model || AI_DEFAULT_MODEL;
  const f = args.fetchImpl || fetch;
  let resp: Response;
  try {
    resp = await f(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are yawB's build planner. Convert the user's prompt into a short, " +
              "ordered build plan and call submit_build_plan.",
          },
          { role: "user", content: args.prompt },
        ],
        tools: [PLAN_TOOL],
        tool_choice: { type: "function", function: { name: "submit_build_plan" } },
      }),
    });
  } catch (e) {
    return { ok: false, error: `AI gateway network error: ${e instanceof Error ? e.message : e}` };
  }
  if (!resp.ok) return mapHttpError(resp);
  let body: unknown;
  try {
    body = await resp.json();
  } catch (e) {
    return {
      ok: false,
      error: `AI gateway non-JSON response: ${e instanceof Error ? e.message : e}`,
    };
  }
  const argStr = (
    body as {
      choices?: Array<{
        message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
      }>;
    }
  )?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argStr) return { ok: false, error: "AI gateway plan response missing tool_calls." };
  let parsed: { steps?: BuildPlanStep[]; estimatedMinutes?: number };
  try {
    parsed = JSON.parse(argStr);
  } catch (e) {
    return {
      ok: false,
      error: `AI gateway plan arguments not JSON: ${e instanceof Error ? e.message : e}`,
    };
  }
  const steps = Array.isArray(parsed.steps)
    ? parsed.steps
        .filter((s) => s && typeof s.title === "string" && typeof s.detail === "string")
        .map((s) => ({ title: String(s.title), detail: String(s.detail) }))
    : [];
  if (!steps.length) return { ok: false, error: "AI gateway plan has no steps." };
  const estimatedMinutes =
    typeof parsed.estimatedMinutes === "number" && Number.isFinite(parsed.estimatedMinutes)
      ? Math.max(1, Math.min(240, Math.round(parsed.estimatedMinutes)))
      : Math.max(2, steps.length * 3);
  return { ok: true, value: { steps, estimatedMinutes } };
}

function mapHttpError(resp: Response): GatewayResult<never> {
  if (resp.status === 429)
    return { ok: false, status: 429, error: "AI gateway rate limited (429). Try again shortly." };
  if (resp.status === 402)
    return {
      ok: false,
      status: 402,
      error: "AI gateway credits exhausted (402). Add credits in Settings → Workspace → Usage.",
    };
  return { ok: false, status: resp.status, error: `AI gateway error ${resp.status}.` };
}
