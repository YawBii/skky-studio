import { describe, it, expect } from "vitest";
import { buildSmartSuggestions } from "./suggestion-engine";
import type { Job, JobStatus } from "@/services/jobs";

function mkJob(p: { id: string; type: string; status: JobStatus; createdAt: string; error?: string }): Job {
  return {
    id: p.id, projectId: "p", workspaceId: "w", type: p.type, status: p.status,
    title: p.id, input: {}, output: {}, error: p.error ?? null, retryCount: 0,
    createdBy: "u", createdAt: p.createdAt, startedAt: null, finishedAt: null,
  };
}

const baseCtx = {
  workspace: { id: "w", name: "W" } as never,
  project: { id: "p", name: "App", description: "" } as never,
  connections: [],
  diagnostics: { lastError: null, providerConnectionStatus: null } as never,
};

describe("suggestion engine retry suggestions", () => {
  it("emits Retry when latest failure has no resolving success", () => {
    const jobs = [
      mkJob({ id: "f1", type: "build.production", status: "failed", createdAt: "2026-05-01T11:00:00Z", error: "boom" }),
    ];
    const out = buildSmartSuggestions({ ...baseCtx, jobs });
    expect(out.some((s) => s.id.startsWith("retry-"))).toBe(true);
  });

  it("does NOT emit Retry when latest failure is resolved by a newer success", () => {
    const jobs = [
      mkJob({ id: "s1", type: "build.production", status: "succeeded", createdAt: "2026-05-01T12:00:00Z" }),
      mkJob({ id: "f1", type: "build.production", status: "failed", createdAt: "2026-05-01T11:00:00Z", error: "invalid bearer token" }),
    ];
    const out = buildSmartSuggestions({ ...baseCtx, jobs });
    expect(out.some((s) => s.id.startsWith("retry-"))).toBe(false);
  });
});
