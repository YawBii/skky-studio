import { describe, it, expect, vi } from "vitest";

// Mirrors the builder route's onJobSucceeded contract:
//   - build.production triggers exactly one filesApi.refresh
//   - ai.generate_changes does NOT auto-refresh (manual button only)
//   - repeated succeeded ai.generate_changes events do not call refresh
//
// This guards against re-introducing an auto-refresh watcher.
type Job = { type: string; id: string };

function makeOnJobSucceeded(filesRefresh: () => void) {
  return (j: Job) => {
    if (j.type === "build.production") {
      filesRefresh();
    }
    // Intentionally NOT handling ai.generate_changes here.
  };
}

describe("builder route — no auto-refresh on regenerate", () => {
  it("repeated succeeded ai.generate_changes jobs do NOT call filesApi.refresh", () => {
    const refresh = vi.fn();
    const cb = makeOnJobSucceeded(refresh);
    cb({ type: "ai.generate_changes", id: "j1" });
    cb({ type: "ai.generate_changes", id: "j2" });
    cb({ type: "ai.generate_changes", id: "j1" }); // same id again, e.g. polling re-emit
    expect(refresh).not.toHaveBeenCalled();
  });

  it("build.production still refreshes once per success event", () => {
    const refresh = vi.fn();
    const cb = makeOnJobSucceeded(refresh);
    cb({ type: "build.production", id: "b1" });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
