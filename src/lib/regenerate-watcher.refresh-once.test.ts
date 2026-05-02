import { describe, it, expect } from "vitest";
import { regenerateOutcome, type RegenerateJobLike } from "./regenerate-watcher";

// Simulates the builder route's handled-jobs guard so we can prove a
// succeeded job lingering in ccJobs.jobs cannot trigger refresh() twice.
function makeWatcher() {
  const handled = new Set<string>();
  let refreshCount = 0;
  let regeneratingJobId: string | null = null;
  function setRegen(id: string | null) {
    regeneratingJobId = id;
  }
  function tick(jobs: RegenerateJobLike[]) {
    if (!regeneratingJobId) return;
    if (handled.has(regeneratingJobId)) return;
    const out = regenerateOutcome(jobs, regeneratingJobId);
    if (out.kind === "succeeded") {
      handled.add(regeneratingJobId);
      refreshCount += 1;
      regeneratingJobId = null;
    } else if (out.kind === "failed") {
      handled.add(regeneratingJobId);
      regeneratingJobId = null;
    }
  }
  return {
    setRegen,
    tick,
    get refreshCount() { return refreshCount; },
    get regeneratingJobId() { return regeneratingJobId; },
  };
}

describe("regenerate watcher — refresh-once guard", () => {
  it("succeeded triggers refresh exactly once", () => {
    const w = makeWatcher();
    w.setRegen("j1");
    w.tick([{ id: "j1", status: "succeeded" }]);
    expect(w.refreshCount).toBe(1);
    expect(w.regeneratingJobId).toBeNull();
  });

  it("same succeeded job appearing in jobs list twice does not refresh twice", () => {
    const w = makeWatcher();
    w.setRegen("j1");
    const jobs: RegenerateJobLike[] = [{ id: "j1", status: "succeeded" }];
    w.tick(jobs);
    // simulate further polling ticks while the same succeeded job remains
    w.tick(jobs);
    w.tick(jobs);
    expect(w.refreshCount).toBe(1);
  });

  it("does not refresh while pending", () => {
    const w = makeWatcher();
    w.setRegen("j1");
    w.tick([{ id: "j1", status: "running" }]);
    w.tick([{ id: "j1", status: "queued" }]);
    expect(w.refreshCount).toBe(0);
    expect(w.regeneratingJobId).toBe("j1");
  });

  it("failed does not refresh", () => {
    const w = makeWatcher();
    w.setRegen("j1");
    w.tick([{ id: "j1", status: "failed", error: "boom" }]);
    expect(w.refreshCount).toBe(0);
    expect(w.regeneratingJobId).toBeNull();
  });
});
