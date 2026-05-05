// Resolves the active yawB AI provider from env. Owned abstraction layer:
// the rest of the app never touches OpenAI/Anthropic/Google/Lovable directly.

import type { AiProvider, AiProviderName } from "./types";
import { openaiProvider } from "./provider-openai";
import { anthropicProvider } from "./provider-anthropic";
import { googleProvider } from "./provider-google";
import { lovableProvider } from "./provider-lovable";

const REGISTRY: Record<AiProviderName, AiProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  google: googleProvider,
  lovable: lovableProvider,
};

const VALID = new Set<AiProviderName>(["openai", "anthropic", "google", "lovable"]);

function envProvider(): AiProviderName | null {
  const raw = (process.env.YAWB_AI_PROVIDER || "").toLowerCase().trim();
  return VALID.has(raw as AiProviderName) ? (raw as AiProviderName) : null;
}

function envModel(): string | undefined {
  const m = process.env.YAWB_AI_MODEL;
  return m && m.trim() ? m.trim() : undefined;
}

/** The provider order tried when YAWB_AI_PROVIDER is unset: prefer real
 *  branded providers, fall back to Lovable Gateway only as a temporary bridge. */
const FALLBACK_ORDER: AiProviderName[] = ["openai", "anthropic", "google", "lovable"];

export interface ResolvedProvider {
  provider: AiProvider;
  model: string | undefined;
  source: "env" | "auto" | "default-unconfigured";
  configured: boolean;
}

export function resolveProvider(): ResolvedProvider {
  const explicit = envProvider();
  const model = envModel();
  if (explicit) {
    const p = REGISTRY[explicit];
    return { provider: p, model, source: "env", configured: p.isConfigured() };
  }
  for (const name of FALLBACK_ORDER) {
    const p = REGISTRY[name];
    if (p.isConfigured()) return { provider: p, model, source: "auto", configured: true };
  }
  // Nothing configured. Return openai as the canonical default so the route
  // can emit a clear "not configured" error.
  return {
    provider: REGISTRY.openai,
    model,
    source: "default-unconfigured",
    configured: false,
  };
}

export function getProviderByName(name: AiProviderName): AiProvider {
  return REGISTRY[name];
}

export function listProviders(): { name: AiProviderName; configured: boolean }[] {
  return (Object.keys(REGISTRY) as AiProviderName[]).map((n) => ({
    name: n,
    configured: REGISTRY[n].isConfigured(),
  }));
}
