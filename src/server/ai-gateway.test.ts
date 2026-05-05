import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  chatCompletion,
  streamChatCompletion,
  planFromPrompt,
  isAiGatewayConfigured,
  AI_NOT_CONFIGURED,
  getActiveProviderInfo,
} from "./ai-gateway.server";

const PROVIDER_KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_AI_API_KEY",
  "GEMINI_API_KEY",
  "LOVABLE_API_KEY",
  "AI_GATEWAY_KEY",
  "YAWB_AI_PROVIDER",
  "YAWB_AI_MODEL",
];

function snapshotEnv() {
  const snap: Record<string, string | undefined> = {};
  for (const k of PROVIDER_KEYS) snap[k] = process.env[k];
  return snap;
}
function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of PROVIDER_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}
function clearEnv() {
  for (const k of PROVIDER_KEYS) delete process.env[k];
}

describe("yawB ai-gateway (provider abstraction)", () => {
  let snap: Record<string, string | undefined>;
  beforeEach(() => {
    snap = snapshotEnv();
    clearEnv();
  });
  afterEach(() => {
    restoreEnv(snap);
    vi.restoreAllMocks();
  });

  it("returns AI_NOT_CONFIGURED when no provider key is present", async () => {
    expect(isAiGatewayConfigured()).toBe(false);
    const r = await chatCompletion({ messages: [{ role: "user", content: "hi" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.setupError).toBe(true);
      expect(r.error).toBe(AI_NOT_CONFIGURED);
      expect(r.error).toMatch(/yawb_ai_provider/i);
    }
  });

  it("getActiveProviderInfo reflects YAWB_AI_PROVIDER override", async () => {
    process.env.YAWB_AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "ant-key";
    process.env.YAWB_AI_MODEL = "claude-3-haiku";
    const info = getActiveProviderInfo();
    expect(info.provider).toBe("anthropic");
    expect(info.model).toBe("claude-3-haiku");
    expect(info.source).toBe("env");
    expect(info.configured).toBe(true);
  });

  it("OpenAI adapter sends OpenAI-shape request and parses content", async () => {
    process.env.YAWB_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    let captured: { url: string; body: Record<string, unknown>; headers: Headers } | null = null;
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      captured = {
        url,
        body: JSON.parse(String(init.body)),
        headers: new Headers(init.headers as HeadersInit),
      };
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "hi from openai" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const r = await chatCompletion({
      messages: [{ role: "user", content: "ping" }],
      fetchImpl,
    });
    expect(r.ok).toBe(true);
    expect(captured!.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(captured!.headers.get("authorization")).toBe("Bearer sk-test");
    expect(captured!.body.model).toMatch(/^gpt-/);
    expect(Array.isArray(captured!.body.messages)).toBe(true);
    if (r.ok) expect(r.value.content).toBe("hi from openai");
  });

  it("Anthropic adapter sends x-api-key + system field and parses content[].text", async () => {
    process.env.YAWB_AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "ant-key";
    let captured: { url: string; body: Record<string, unknown>; headers: Headers } | null = null;
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      captured = {
        url,
        body: JSON.parse(String(init.body)),
        headers: new Headers(init.headers as HeadersInit),
      };
      return new Response(
        JSON.stringify({ content: [{ type: "text", text: "hello from claude" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const r = await chatCompletion({
      messages: [{ role: "user", content: "ping" }],
      fetchImpl,
    });
    expect(r.ok).toBe(true);
    expect(captured!.url).toBe("https://api.anthropic.com/v1/messages");
    expect(captured!.headers.get("x-api-key")).toBe("ant-key");
    expect(captured!.headers.get("anthropic-version")).toBe("2023-06-01");
    expect(typeof captured!.body.system).toBe("string");
    expect(captured!.body.max_tokens).toBeGreaterThan(0);
    if (r.ok) expect(r.value.content).toBe("hello from claude");
  });

  it("Google adapter sends generateContent with key in URL and parses candidates", async () => {
    process.env.YAWB_AI_PROVIDER = "google";
    process.env.GOOGLE_AI_API_KEY = "g-key";
    let capturedUrl = "";
    let capturedBody: Record<string, unknown> = {};
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "hi from gemini" }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const r = await chatCompletion({
      messages: [{ role: "user", content: "ping" }],
      fetchImpl,
    });
    expect(r.ok).toBe(true);
    expect(capturedUrl).toContain("generativelanguage.googleapis.com");
    expect(capturedUrl).toContain("generateContent");
    expect(capturedUrl).toContain("key=g-key");
    expect(capturedBody.systemInstruction).toBeDefined();
    expect(Array.isArray(capturedBody.contents)).toBe(true);
    if (r.ok) expect(r.value.content).toBe("hi from gemini");
  });

  it("Lovable fallback adapter is used when YAWB_AI_PROVIDER=lovable", async () => {
    process.env.YAWB_AI_PROVIDER = "lovable";
    process.env.LOVABLE_API_KEY = "lov-key";
    let capturedUrl = "";
    const fetchImpl = vi.fn(async (url: string) => {
      capturedUrl = url;
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "lovable says hi" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const r = await chatCompletion({
      messages: [{ role: "user", content: "ping" }],
      fetchImpl,
    });
    expect(r.ok).toBe(true);
    expect(capturedUrl).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
    if (r.ok) expect(r.value.content).toBe("lovable says hi");
  });

  it("streaming returns OpenAI-shape SSE regardless of underlying provider", async () => {
    process.env.YAWB_AI_PROVIDER = "google";
    process.env.GOOGLE_AI_API_KEY = "g-key";
    const sse =
      'data: {"candidates":[{"content":{"parts":[{"text":"He"}]}}]}\n\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":"llo"}]}}]}\n\n';
    const fetchImpl = vi.fn(
      async () =>
        new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    ) as unknown as typeof fetch;
    const r = await streamChatCompletion({
      messages: [{ role: "user", content: "hi" }],
      fetchImpl,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const txt = await r.value.text();
      expect(txt).toContain("data: ");
      expect(txt).toContain("[DONE]");
      // Reassemble client-visible content from the OpenAI-shape SSE.
      const content = txt
        .split("\n")
        .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
        .map((l) => {
          const j = JSON.parse(l.slice(6)) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          return j.choices?.[0]?.delta?.content ?? "";
        })
        .join("");
      expect(content).toBe("Hello");
    }
  });

  it("planFromPrompt parses OpenAI tool-call into a structured plan", async () => {
    process.env.YAWB_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    const args = JSON.stringify({
      steps: [
        { title: "Scaffold routes", detail: "/, /dashboard" },
        { title: "Wire DB", detail: "Tables + RLS" },
      ],
      estimatedMinutes: 9,
    });
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [{ function: { name: "submit_build_plan", arguments: args } }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ) as unknown as typeof fetch;
    const r = await planFromPrompt({ prompt: "Build notes app", fetchImpl });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.steps).toHaveLength(2);
      expect(r.value.steps[0].title).toBe("Scaffold routes");
      expect(r.value.estimatedMinutes).toBe(9);
    }
  });

  it("planFromPrompt parses Anthropic tool_use input", async () => {
    process.env.YAWB_AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "ant-key";
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                type: "tool_use",
                name: "submit_build_plan",
                input: {
                  steps: [{ title: "A", detail: "B" }],
                  estimatedMinutes: 4,
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ) as unknown as typeof fetch;
    const r = await planFromPrompt({ prompt: "x", fetchImpl });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.steps[0].title).toBe("A");
  });

  it("maps 401 to a setup error", async () => {
    process.env.YAWB_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-bad";
    const fetchImpl = vi.fn(
      async () => new Response("nope", { status: 401 }),
    ) as unknown as typeof fetch;
    const r = await chatCompletion({
      messages: [{ role: "user", content: "hi" }],
      fetchImpl,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(401);
      expect(r.setupError).toBe(true);
    }
  });
});
