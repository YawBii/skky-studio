import {
  type AiProvider,
  type AiChatArgs,
  type AiPlanArgs,
  type AiResult,
  type BuildPlan,
  SYSTEM_PROMPT,
  PLAN_SYSTEM,
  PLAN_TOOL_NAME,
  PLAN_TOOL_DESCRIPTION,
  PLAN_PARAMETERS_SCHEMA,
  notConfiguredError,
  networkError,
  httpError,
  clampPlan,
} from "./types";
import { parseOpenAiSse } from "./sse";

const URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT = "gpt-4o-mini";

function key(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

async function call(
  args: AiChatArgs & { stream?: boolean; tools?: unknown },
): Promise<AiResult<Response>> {
  const k = key();
  if (!k) return notConfiguredError("openai");
  const f = args.fetchImpl || fetch;
  const body: Record<string, unknown> = {
    model: args.model || DEFAULT,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...args.messages],
  };
  if (args.stream) body.stream = true;
  if (args.tools) {
    body.tools = args.tools;
    body.tool_choice = { type: "function", function: { name: PLAN_TOOL_NAME } };
  }
  let resp: Response;
  try {
    resp = await f(URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return networkError(e);
  }
  if (!resp.ok) return httpError("openai", resp.status);
  return { ok: true, value: resp };
}

export const openaiProvider: AiProvider = {
  name: "openai",
  defaultModel: DEFAULT,
  isConfigured: () => Boolean(key()),

  async chat(args) {
    const r = await call(args);
    if (!r.ok) return r;
    const body = (await r.value.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content ?? "";
    if (!content) return { ok: false, error: "openai returned empty content." };
    return { ok: true, value: { content, model: args.model || DEFAULT } };
  },

  async streamChat(args) {
    const r = await call({ ...args, stream: true });
    if (!r.ok) return r;
    if (!r.value.body) return { ok: false, error: "openai stream missing body" };
    return { ok: true, value: parseOpenAiSse(r.value.body) };
  },

  async plan(args: AiPlanArgs): Promise<AiResult<BuildPlan>> {
    const k = key();
    if (!k) return notConfiguredError("openai");
    const f = args.fetchImpl || fetch;
    const tool = {
      type: "function",
      function: {
        name: PLAN_TOOL_NAME,
        description: PLAN_TOOL_DESCRIPTION,
        parameters: PLAN_PARAMETERS_SCHEMA,
      },
    };
    let resp: Response;
    try {
      resp = await f(URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: args.model || DEFAULT,
          messages: [
            { role: "system", content: PLAN_SYSTEM },
            { role: "user", content: args.prompt },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: PLAN_TOOL_NAME } },
        }),
      });
    } catch (e) {
      return networkError(e);
    }
    if (!resp.ok) return httpError("openai", resp.status);
    const body = (await resp.json()) as {
      choices?: Array<{
        message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
      }>;
    };
    const argStr = body.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argStr) return { ok: false, error: "openai plan missing tool_calls." };
    try {
      const parsed = JSON.parse(argStr) as { steps?: unknown; estimatedMinutes?: unknown };
      const steps = Array.isArray(parsed.steps)
        ? (parsed.steps as { title: string; detail: string }[])
        : [];
      const plan = clampPlan(steps, parsed.estimatedMinutes);
      if (!plan.steps.length) return { ok: false, error: "openai plan has no steps." };
      return { ok: true, value: plan };
    } catch (e) {
      return { ok: false, error: `openai plan arguments not JSON: ${e}` };
    }
  },
};
