import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  chatCompletion,
  streamChatCompletion,
  planFromPrompt,
  isAiGatewayConfigured,
  AI_NOT_CONFIGURED,
} from "./ai-gateway.server";

describe("ai-gateway.server", () => {
  const origKey = process.env.LOVABLE_API_KEY;
  beforeEach(() => {
    delete process.env.LOVABLE_API_KEY;
    delete process.env.AI_GATEWAY_KEY;
  });
  afterEach(() => {
    if (origKey !== undefined) process.env.LOVABLE_API_KEY = origKey;
    vi.restoreAllMocks();
  });

  it("returns the configured error when no key", async () => {
    expect(isAiGatewayConfigured()).toBe(false);
    const r = await chatCompletion({ messages: [{ role: "user", content: "hi" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(AI_NOT_CONFIGURED);
      expect(r.setupError).toBe(true);
    }
  });

  it("parses gateway success into a real message", async () => {
    process.env.LOVABLE_API_KEY = "test";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "Hello world!" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const r = await chatCompletion({
      messages: [{ role: "user", content: "hi" }],
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.content).toContain("Hello");
  });

  it("streaming returns the upstream response with body", async () => {
    process.env.LOVABLE_API_KEY = "test";
    const fakeBody = 'data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(fakeBody, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
      );
    const r = await streamChatCompletion({
      messages: [{ role: "user", content: "hi" }],
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const txt = await r.value.text();
      expect(txt).toContain("data: ");
      expect(txt).toContain("[DONE]");
    }
  });

  it("planFromPrompt parses tool-call arguments into a structured plan", async () => {
    process.env.LOVABLE_API_KEY = "test";
    const args = JSON.stringify({
      steps: [
        { title: "Scaffold", detail: "Create routes" },
        { title: "Wire DB", detail: "Tables + RLS" },
      ],
      estimatedMinutes: 12,
    });
    const fetchMock = vi.fn().mockResolvedValue(
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
    );
    const r = await planFromPrompt({
      prompt: "Build a notes app",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.steps).toHaveLength(2);
      expect(r.value.steps[0].title).toBe("Scaffold");
      expect(r.value.estimatedMinutes).toBe(12);
    }
  });

  it("maps 402 credits-exhausted to a typed error", async () => {
    process.env.LOVABLE_API_KEY = "test";
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 402 }));
    const r = await chatCompletion({
      messages: [{ role: "user", content: "hi" }],
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(402);
      expect(r.error).toMatch(/credits/i);
    }
  });
});
