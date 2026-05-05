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
import { parseGoogleSse } from "./sse";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT = "gemini-2.5-flash";

function key(): string | null {
  return process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || null;
}

function toGeminiContents(messages: ChatMsg[]): {
  systemInstruction: { parts: { text: string }[] };
  contents: { role: "user" | "model"; parts: { text: string }[] }[];
} {
  const sys: string[] = [SYSTEM_PROMPT];
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    if (m.role === "system") sys.push(m.content);
    else
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
  }
  return { systemInstruction: { parts: [{ text: sys.join("\n\n") }] }, contents };
}

async function callGenerate(
  args: AiChatArgs & { stream?: boolean; tools?: unknown; system?: string },
): Promise<AiResult<Response>> {
  const k = key();
  if (!k) return notConfiguredError("google");
  const f = args.fetchImpl || fetch;
  const model = args.model || DEFAULT;
  const path = args.stream ? `streamGenerateContent?alt=sse&key=${k}` : `generateContent?key=${k}`;
  const url = `${BASE}/${model}:${path}`;
  const { systemInstruction, contents } = toGeminiContents(args.messages);
  const body: Record<string, unknown> = {
    contents,
    systemInstruction: args.system ? { parts: [{ text: args.system }] } : systemInstruction,
  };
  if (args.tools) {
    body.tools = args.tools;
    body.toolConfig = {
      functionCallingConfig: { mode: "ANY", allowedFunctionNames: [PLAN_TOOL_NAME] },
    };
  }
  let resp: Response;
  try {
    resp = await f(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return networkError(this.name, e);
  }
  if (!resp.ok) return httpError("google", resp.status);
  return { ok: true, value: resp };
}

export const googleProvider: AiProvider = {
  name: "google",
  defaultModel: DEFAULT,
  isConfigured: () => Boolean(key()),

  async chat(args) {
    const r = await callGenerate(args);
    if (!r.ok) return r;
    const body = (await r.value.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = body.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
    if (!content) return { ok: false, error: "google returned empty content." };
    return { ok: true, value: { content, model: args.model || DEFAULT } };
  },

  async streamChat(args) {
    const r = await callGenerate({ ...args, stream: true });
    if (!r.ok) return r;
    if (!r.value.body) return { ok: false, error: "google stream missing body" };
    return { ok: true, value: parseGoogleSse(r.value.body) };
  },

  async plan(args: AiPlanArgs): Promise<AiResult<BuildPlan>> {
    const tool = {
      functionDeclarations: [
        {
          name: PLAN_TOOL_NAME,
          description: PLAN_TOOL_DESCRIPTION,
          parameters: PLAN_PARAMETERS_SCHEMA,
        },
      ],
    };
    const r = await callGenerate({
      messages: [{ role: "user", content: args.prompt }],
      model: args.model,
      fetchImpl: args.fetchImpl,
      tools: [tool],
      system: PLAN_SYSTEM,
    });
    if (!r.ok) return r;
    const body = (await r.value.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            functionCall?: {
              name?: string;
              args?: { steps?: unknown; estimatedMinutes?: unknown };
            };
          }>;
        };
      }>;
    };
    const fc = body.candidates?.[0]?.content?.parts?.find(
      (p) => p.functionCall?.name === PLAN_TOOL_NAME,
    )?.functionCall;
    if (!fc?.args) return { ok: false, error: "google plan missing functionCall args." };
    const steps = Array.isArray(fc.args.steps)
      ? (fc.args.steps as { title: string; detail: string }[])
      : [];
    const plan = clampPlan(steps, fc.args.estimatedMinutes);
    if (!plan.steps.length) return { ok: false, error: "google plan has no steps." };
    return { ok: true, value: plan };
  },
};
