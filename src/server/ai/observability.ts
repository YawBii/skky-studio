// In-process AI observability ring buffer. Tracks recent calls (provider,
// model, route, latency, status, error category). Never logs prompts,
// responses, or API keys.

import type { AiErrorCategory, AiProviderName } from "./types";

export type AiRoute = "chat" | "stream" | "plan" | "tool";

export interface AiCallEvent {
  ts: string;
  provider: AiProviderName;
  model: string;
  route: AiRoute;
  latencyMs: number;
  ok: boolean;
  status?: number;
  category?: AiErrorCategory;
}

const MAX = 50;
const ring: AiCallEvent[] = [];

export function recordAiCall(ev: AiCallEvent): void {
  ring.push(ev);
  if (ring.length > MAX) ring.splice(0, ring.length - MAX);
}

export function getRecentAiCalls(): AiCallEvent[] {
  return ring.slice().reverse();
}

export function clearAiCalls(): void {
  ring.length = 0;
}
