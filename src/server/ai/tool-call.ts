// Provider-agnostic structured tool-call facade. Lets the planner and
// agentic-loop request a JSON-schema-constrained response without knowing
// which underlying provider (OpenAI / Anthropic / Google / Lovable) is active.

import { resolveProvider } from "./resolver";
import { recordAiCall } from "./observability";
import type { AiResult, AiProviderName, ChatMsg } from "./types";

export interface ToolCallArgs {
  system: string;
  messages: ChatMsg[];
  tool: { name: string; description: string; parameters: Record<string, unknown> };
  model?: string;
  fetchImpl?: typeof fetch;
}

interface ProviderRequestShape {
  url: string;
  init: RequestInit;
  parse: (json: unknown) => Record<string, unknown> | null;
}

function buildOpenAi(
  baseUrl: string,
  authHeader: Record<string, string>,
  model: string,
  args: ToolCallArgs,
): ProviderRequestShape {
  return {
    url: baseUrl,
    init: {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: args.system }, ...args.messages],
        tools: [{ type: "function", function: args.tool }],
        tool_choice: { type: "function", function: { name: args.tool.name } },
      }),
    },
    parse: (json) => {
      const argStr = (
        json as {
          choices?: Array<{
            message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
          }>;
        }
      )?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argStr) return null;
      try {
        return JSON.parse(argStr) as Record<string, unknown>;
      } catch {
        return null;
      }
    },
  };
}

function buildAnthropic(model: string, args: ToolCallArgs): ProviderRequestShape | null {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) return null;
  return {
    url: "https://api.anthropic.com/v1/messages",
    init: {
      method: "POST",
      headers: {
        "x-api-key": k,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: args.system,
        messages: args.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
        tools: [
          { name: args.tool.name, description: args.tool.description, input_schema: args.tool.parameters },
        ],
        tool_choice: { type: "tool", name: args.tool.name },
      }),
    },
    parse: (json) => {
      const tu = (json as { content?: Array<{ type: string; name?: string; input?: unknown }> })?.content?.find(
        (c) => c.type === "tool_use" && c.name === args.tool.name,
      );
      return (tu?.input as Record<string, unknown> | undefined) ?? null;
    },
  };
}

function buildGoogle(model: string, args: ToolCallArgs): ProviderRequestShape | null {
  const k = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!k) return null;
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${k}`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents: args.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        tools: [
          {
            functionDeclarations: [
              { name: args.tool.name, description: args.tool.description, parameters: args.tool.parameters },
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: { mode: "ANY", allowedFunctionNames: [args.tool.name] },
        },
      }),
    },
    parse: (json) => {
      const fc = (
        json as {
          candidates?: Array<{
            content?: { parts?: Array<{ functionCall?: { name?: string; args?: unknown } }> };
          }>;
        }
      )?.candidates?.[0]?.content?.parts?.find((p) => p.functionCall?.name === args.tool.name)
        ?.functionCall?.args;
      return (fc as Record<string, unknown> | undefined) ?? null;
    },
  };
}

function buildOpenAiAuth(model: string, args: ToolCallArgs): ProviderRequestShape | null {
  const k = process.env.OPENAI_API_KEY;
  if (!k) return null;
  return buildOpenAi(
    "https://api.openai.com/v1/chat/completions",
    { Authorization: `Bearer ${k}` },
    model,
    args,
  );
}

function buildLovable(model: string, args: ToolCallArgs): ProviderRequestShape | null {
  const k = process.env.LOVABLE_API_KEY || process.env.AI_GATEWAY_KEY;
  if (!k) return null;
  return buildOpenAi(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    { Authorization: `Bearer ${k}` },
    model,
    args,
  );
}

function shapeFor(provider: AiProviderName, model: string, args: ToolCallArgs): ProviderRequestShape | null {
  switch (provider) {
    case "openai":
      return buildOpenAiAuth(model, args);
    case "anthropic":
      return buildAnthropic(model, args);
    case "google":
      return buildGoogle(model, args);
    case "lovable":
      return buildLovable(model, args);
  }
}

/** Run a structured tool call against the active yawB provider. */
export async function runToolCall(
  args: ToolCallArgs,
): Promise<AiResult<{ value: Record<string, unknown>; provider: AiProviderName; model: string }>> {
  const r = resolveProvider();
  if (!r.configured) {
    return {
      ok: false,
      setupError: true,
      category: "missing_key",
      error:
        "AI provider not configured. Set YAWB_AI_PROVIDER and the matching API key (OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_AI_API_KEY / LOVABLE_API_KEY).",
    };
  }
  const provider = r.provider.name;
  const model = args.model || r.model || r.provider.defaultModel;
  const shape = shapeFor(provider, model, args);
  if (!shape) {
    return {
      ok: false,
      setupError: true,
      provider,
      category: "missing_key",
      error: `Active provider "${provider}" has no API key in env.`,
    };
  }
  const f = args.fetchImpl || fetch;
  const startedAt = Date.now();
  let resp: Response;
  try {
    resp = await f(shape.url, shape.init);
  } catch (e) {
    recordAiCall({
      ts: new Date().toISOString(),
      provider,
      model,
      route: "tool",
      latencyMs: Date.now() - startedAt,
      ok: false,
      category: "network",
    });
    return {
      ok: false,
      provider,
      category: "network",
      error: `AI provider network error (${provider}): ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const latencyMs = Date.now() - startedAt;
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const category =
      resp.status === 401
        ? "invalid_key"
        : resp.status === 402
          ? "credits"
          : resp.status === 403
            ? "permission"
            : resp.status === 429
              ? "rate_limit"
              : "upstream";
    recordAiCall({
      ts: new Date().toISOString(),
      provider,
      model,
      route: "tool",
      latencyMs,
      ok: false,
      status: resp.status,
      category,
    });
    return {
      ok: false,
      provider,
      status: resp.status,
      category,
      setupError: category === "invalid_key",
      error:
        category === "credits"
          ? `${provider} returned 402 — credits exhausted. Top up your account.`
          : category === "rate_limit"
            ? `${provider} rate limited (429). Try again shortly.`
            : category === "invalid_key"
              ? `${provider} returned 401 — the API key is invalid or missing.`
              : category === "permission"
                ? `${provider} returned 403 — API key lacks permission.`
                : `${provider} tool call ${resp.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
    };
  }
  let body: unknown;
  try {
    body = await resp.json();
  } catch (e) {
    recordAiCall({
      ts: new Date().toISOString(),
      provider,
      model,
      route: "tool",
      latencyMs,
      ok: false,
      status: resp.status,
      category: "parse",
    });
    return {
      ok: false,
      provider,
      category: "parse",
      error: `${provider} returned non-JSON: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const parsed = shape.parse(body);
  if (!parsed) {
    recordAiCall({
      ts: new Date().toISOString(),
      provider,
      model,
      route: "tool",
      latencyMs,
      ok: false,
      status: resp.status,
      category: "parse",
    });
    return {
      ok: false,
      provider,
      category: "parse",
      error: `${provider} response missing tool-call arguments.`,
    };
  }
  recordAiCall({
    ts: new Date().toISOString(),
    provider,
    model,
    route: "tool",
    latencyMs,
    ok: true,
    status: resp.status,
  });
  return { ok: true, value: { value: parsed, provider, model } };
}
