import { describe, expect, it, vi } from "vitest";
import { streamChat, chat } from "./ai";

describe("AI build prompt guard", () => {
  it("does not stream ChatGPT-style advice for build prompts", async () => {
    const onDelta = vi.fn();
    const result = await streamChat({
      messages: [{ role: "user", content: "Build an app for sending money to mobile phones" }],
      onDelta,
    });

    expect(result.model).toBe("yawb-build-guard");
    expect(onDelta).toHaveBeenCalledTimes(1);
    const text = onDelta.mock.calls[0][0] as string;
    expect(text).toContain("Building now");
    expect(text).not.toMatch(/mkdir|npm install|shall i provide|next steps for you/i);
  });

  it("non-streaming chat also guards build prompts", async () => {
    const result = await chat([
      { role: "user", content: "Build the app" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model).toBe("yawb-build-guard");
    expect(result.content).toContain("Building now");
  });
});
