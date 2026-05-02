import { describe, it, expect } from "vitest";
import { regenerateOutcome, type RegenerateJobLike } from "./regenerate-watcher";

const job = (s: RegenerateJobLike["status"], error?: string | null): RegenerateJobLike => ({
  id: "j1",
  status: s,
  error: error ?? null,
});

describe("regenerateOutcome", () => {
  it("pending when no jobId tracked", () => {
    expect(regenerateOutcome([], null)).toEqual({ kind: "pending" });
  });
  it("missing when job not found yet (e.g. before list refresh)", () => {
    expect(regenerateOutcome([], "j1")).toEqual({ kind: "missing" });
  });
  it("pending while queued/running/waiting", () => {
    expect(regenerateOutcome([job("queued")], "j1").kind).toBe("pending");
    expect(regenerateOutcome([job("running")], "j1").kind).toBe("pending");
    expect(regenerateOutcome([job("waiting_for_input")], "j1").kind).toBe("pending");
  });
  it("succeeded triggers success outcome", () => {
    expect(regenerateOutcome([job("succeeded")], "j1")).toEqual({ kind: "succeeded" });
  });
  it("failed surfaces real error", () => {
    expect(regenerateOutcome([job("failed", "boom")], "j1")).toEqual({
      kind: "failed",
      message: "boom",
    });
  });
  it("failed with no error gets a sensible default", () => {
    expect(regenerateOutcome([job("failed")], "j1")).toEqual({
      kind: "failed",
      message: "Regenerate design failed",
    });
  });
  it("cancelled is treated as failed", () => {
    expect(regenerateOutcome([job("cancelled", "user cancelled")], "j1")).toEqual({
      kind: "failed",
      message: "user cancelled",
    });
  });
});
