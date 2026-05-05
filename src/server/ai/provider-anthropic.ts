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
  type ChatMsg,
} from "./types";
import { parseAnthropicSse } from "./sse";

const URL = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";
const DEFAULT = "claude-3-5-sonnet-latest";

function key(): string | null {
  return process.env.ANTHROPIC_API_KEY || null;
}

function splitSystem(messages: ChatMsg[]): {
  system: string;
  rest: { role: "user" | "assistant"; content: string }[];
} {
  const sys: string[] = [SYSTEM_PROMPT];
  const rest: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    if (m.role === "system") sys.push(m.content);
    else rest.push({ role: m.role, content: m.content });
  }
  return { system: sys.join("\n\n"), rest };
}

async function send(
  args: AiChatArgs & { stream?: boolean; tools?: unknown; system?: string },
): Promise<AiResult<Response>> {
  const k = key();
  if (!k) return notConfiguredError("anthropic");
  const f = args.fetchImpl || fetch;
  const { system, rest } = splitSystem(args.messages);
  const body: Record<string, unknown> = {
    model: args.model || DEFAULT,
    max_tokens: 2048,
    system: args.system ?? system,
    messages: rest,
  };
  if (args.stream) body.stream = true;
  if (args.tools) {
    body.tools = args.tools;
    body.tool_choice = { type: "tool", name: PLAN_TOOL_NAME };
  }
  let resp: Response;
  try {
    resp = await f(URL, {
      method: "POST",
      headers: {
        "x-api-key": k,
        "anthropic-version": VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return networkError("anthropic", e);
  }
  if (!resp.ok) return httpError("anthropic", resp.status);
  return { ok: true, value: resp };
}

export const anthropicProvider: AiProvider = {
  name: "anthropic",
  defaultModel: DEFAULT,
  isConfigured: () => Boolean(key()),

  async chat(args) {
    const r = await send(args);
    if (!r.ok) return r;
    const body = (await r.value.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const content =
      body.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join("") ?? "";
    if (!content) return { ok: false, error: "anthropic returned empty content." };
    return { ok: true, value: { content, model: args.model || DEFAULT } };
  },

  async streamChat(args) {
    const r = await send({ ...args, stream: true });
    if (!r.ok) return r;
    if (!r.value.body) return { ok: false, error: "anthropic stream missing body" };
    return { ok: true, value: parseAnthropicSse(r.value.body) };
  },

  async plan(args: AiPlanArgs): Promise<AiResult<BuildPlan>> {
    const k = key();
    if (!k) return notConfiguredError("anthropic");
    const f = args.fetchImpl || fetch;
    const tool = {
      name: PLAN_TOOL_NAME,
      description: PLAN_TOOL_DESCRIPTION,
      input_schema: PLAN_PARAMETERS_SCHEMA,
    };
    let resp: Response;
    try {
      resp = await f(URL, {
        method: "POST",
        headers: {
          "x-api-key": k,
          "anthropic-version": VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: args.model || DEFAULT,
          max_tokens: 2048,
          system: PLAN_SYSTEM,
          messages: [{ role: "user", content: args.prompt }],
          tools: [tool],
          tool_choice: { type: "tool", name: PLAN_TOOL_NAME },
        }),
      });
    } catch (e) {
      return networkError("anthropic", e);
    }
    if (!resp.ok) return httpError("anthropic", resp.status);
    const body = (await resp.json()) as {
      content?: Array<{
        type: string;
        name?: string;
        input?: { steps?: unknown; estimatedMinutes?: unknown };
      }>;
    };
    const tu = body.content?.find((c) => c.type === "tool_use" && c.name === PLAN_TOOL_NAME);
    if (!tu?.input) return { ok: false, error: "anthropic plan missing tool_use input." };
    const steps = Array.isArray(tu.input.steps)
      ? (tu.input.steps as { title: string; detail: string }[])
      : [];
    const plan = clampPlan(steps, tu.input.estimatedMinutes);
    if (!plan.steps.length) return { ok: false, error: "anthropic plan has no steps." };
    return { ok: true, value: plan };
  },
};
