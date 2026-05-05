// yawB-owned AI provider layer. The route at /api/public/ai-chat calls into
// these helpers; provider selection happens via YAWB_AI_PROVIDER /
// YAWB_AI_MODEL env vars. No keys ever ship to the browser.

import type { ChatMsg, BuildPlan } from "./ai/types";
import { resolveProvider, listProviders } from "./ai/resolver";
import { deltasToOpenAiSse } from "./ai/sse";

export type { ChatMsg, BuildPlan } from "./ai/types";

export const AI_NOT_CONFIGURED =
  'AI provider not configured. Set YAWB_AI_PROVIDER and the matching API key (OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_AI_API_KEY / LOVABLE_API_KEY).';

export type GatewayResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number; setupError?: boolean };

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
  };
}

function notConfigured<T>(): GatewayResult<T> {
  return { ok: false, error: AI_NOT_CONFIGURED, setupError: true };
}

export async function chatCompletion(args: {
  messages: ChatMsg[];
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<GatewayResult<{ content: string; model: string }>> {
  const r = resolveProvider();
  if (!r.configured) return notConfigured();
  return r.provider.chat({
    messages: args.messages,
    model: args.model || r.model,
    fetchImpl: args.fetchImpl,
  });
}

/** Streaming chat completion. Returns a Response whose body is OpenAI-shape
 *  SSE so the existing client parser keeps working across providers. */
export async function streamChatCompletion(args: {
  messages: ChatMsg[];
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<GatewayResult<Response>> {
  const r = resolveProvider();
  if (!r.configured) return notConfigured();
  const upstream = await r.provider.streamChat({
    messages: args.messages,
    model: args.model || r.model,
    fetchImpl: args.fetchImpl,
  });
  if (!upstream.ok) return upstream;
  const model = args.model || r.model || r.provider.defaultModel;
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
  return r.provider.plan({
    prompt: args.prompt,
    model: args.model || r.model,
    fetchImpl: args.fetchImpl,
  });
}
