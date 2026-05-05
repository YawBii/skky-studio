// yawB-owned AI provider layer. The route at /api/public/ai-chat calls into
// these helpers; provider selection happens via YAWB_AI_PROVIDER /
// YAWB_AI_MODEL env vars. No keys ever ship to the browser.

import type { ChatMsg, BuildPlan, AiErrorCategory } from "./ai/types";
import { resolveProvider, listProviders } from "./ai/resolver";
import { deltasToOpenAiSse } from "./ai/sse";
import { recordAiCall, getRecentAiCalls } from "./ai/observability";

export type { ChatMsg, BuildPlan } from "./ai/types";
export { getRecentAiCalls } from "./ai/observability";
export type { AiCallEvent } from "./ai/observability";

export const AI_NOT_CONFIGURED =
  "AI provider not configured. Set YAWB_AI_PROVIDER and the matching API key (OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_AI_API_KEY / LOVABLE_API_KEY).";

export type GatewayResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: string;
      status?: number;
      setupError?: boolean;
      category?: AiErrorCategory;
      provider?: string;
    };

export function isAiGatewayConfigured(): boolean {
  return resolveProvider().configured;
}

export function getActiveProviderInfo() {
  const r = resolveProvider();
  return {
    provider: r.provider.name,
    model: r.model || r.provider.defaultModel,
    source: r.source,
    configured: r.configured,
    available: listProviders(),
    requiredEnvForActive:
      r.provider.name === "openai"
        ? "OPENAI_API_KEY"
        : r.provider.name === "anthropic"
          ? "ANTHROPIC_API_KEY"
          : r.provider.name === "google"
            ? "GOOGLE_AI_API_KEY"
            : "LOVABLE_API_KEY",
  };
}

function notConfigured<T>(): GatewayResult<T> {
  return { ok: false, error: AI_NOT_CONFIGURED, setupError: true, category: "missing_key" };
}

export async function chatCompletion(args: {
  messages: ChatMsg[];
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<GatewayResult<{ content: string; model: string }>> {
  const r = resolveProvider();
  if (!r.configured) return notConfigured();
  const model = args.model || r.model || r.provider.defaultModel;
  const startedAt = Date.now();
  const out = await r.provider.chat({
    messages: args.messages,
    model: args.model || r.model,
    fetchImpl: args.fetchImpl,
  });
  recordAiCall({
    ts: new Date().toISOString(),
    provider: r.provider.name,
    model,
    route: "chat",
    latencyMs: Date.now() - startedAt,
    ok: out.ok,
    status: out.ok ? 200 : out.status,
    category: out.ok ? undefined : out.category,
  });
  if (!out.ok) return { ...out, provider: r.provider.name };
  return out;
}

export async function streamChatCompletion(args: {
  messages: ChatMsg[];
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<GatewayResult<Response>> {
  const r = resolveProvider();
  if (!r.configured) return notConfigured();
  const model = args.model || r.model || r.provider.defaultModel;
  const startedAt = Date.now();
  const upstream = await r.provider.streamChat({
    messages: args.messages,
    model: args.model || r.model,
    fetchImpl: args.fetchImpl,
  });
  recordAiCall({
    ts: new Date().toISOString(),
    provider: r.provider.name,
    model,
    route: "stream",
    latencyMs: Date.now() - startedAt,
    ok: upstream.ok,
    status: upstream.ok ? 200 : upstream.status,
    category: upstream.ok ? undefined : upstream.category,
  });
  if (!upstream.ok) return { ...upstream, provider: r.provider.name };
  const sse = deltasToOpenAiSse(upstream.value, model);
  return {
    ok: true,
    value: new Response(sse, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
    }),
  };
}

export async function planFromPrompt(args: {
  prompt: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<GatewayResult<BuildPlan>> {
  const r = resolveProvider();
  if (!r.configured) return notConfigured();
  const model = args.model || r.model || r.provider.defaultModel;
  const startedAt = Date.now();
  const out = await r.provider.plan({
    prompt: args.prompt,
    model: args.model || r.model,
    fetchImpl: args.fetchImpl,
  });
  recordAiCall({
    ts: new Date().toISOString(),
    provider: r.provider.name,
    model,
    route: "plan",
    latencyMs: Date.now() - startedAt,
    ok: out.ok,
    status: out.ok ? 200 : out.status,
    category: out.ok ? undefined : out.category,
  });
  if (!out.ok) return { ...out, provider: r.provider.name };
  return out;
}
