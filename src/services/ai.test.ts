import { describe, it, expect, vi, afterEach } from "vitest";
import { chat, planFromPrompt, streamChat } from "./ai";

afterEach(() => vi.restoreAllMocks());

function mockFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) =>
    impl(typeof input === "string" ? input : (input as Request).url, init ?? {}),
  );
}

describe("services/ai (client wrapper)", () => {
  it("chat() POSTs to /api/public/ai-chat and returns content", async () => {
    mockFetch(async (url) => {
      expect(url).toContain("/api/public/ai-chat");
      return new Response(JSON.stringify({ content: "hello back" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const r = await chat([{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.content).toBe("hello back");
  });

  it("chat() surfaces setup error from server", async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({ error: "AI gateway is not configured (set LOVABLE_API_KEY).", setupError: true }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const r = await chat([{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.setupError).toBe(true);
      expect(r.error).toMatch(/not configured/i);
    }
  });

  it("planFromPrompt() returns a structured plan", async () => {
    mockFetch(async () =>
      new Response(
        JSON.stringify({ plan: { steps: [{ title: "A", detail: "B" }], estimatedMinutes: 5 } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const r = await planFromPrompt("build x");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.steps[0].title).toBe("A");
      expect(r.plan.estimatedMinutes).toBe(5);
    }
  });

  it("streamChat() emits decoded delta chunks", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n' +
      "data: [DONE]\n\n";
    mockFetch(async () =>
      new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    );
    const chunks: string[] = [];
    await streamChat({
      messages: [{ role: "user", content: "hi" }],
      onDelta: (c) => chunks.push(c),
    });
    expect(chunks.join("")).toBe("Hello");
  });
});
