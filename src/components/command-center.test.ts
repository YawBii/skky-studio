import { describe, it, expect } from "vitest";
import { deriveCommandCenterState } from "./command-center";
import type { Job, JobStatus } from "@/services/jobs";

function mkJob(p: { id: string; type: string; status: JobStatus; createdAt: string; error?: string }): Job {
  return {
    id: p.id, projectId: "p", workspaceId: "w", type: p.type, status: p.status,
    title: p.id, input: {}, output: {}, error: p.error ?? null, retryCount: 0,
    createdBy: "u", createdAt: p.createdAt, startedAt: null, finishedAt: null,
  };
}

describe("deriveCommandCenterState", () => {
  it("ignores resolved failures and returns succeeded mode", () => {
    const jobs = [
      mkJob({ id: "s1", type: "build.production", status: "succeeded", createdAt: "2026-05-01T12:00:00Z" }),
      mkJob({ id: "f1", type: "build.production", status: "failed", createdAt: "2026-05-01T11:00:00Z", error: "invalid bearer token" }),
    ];
    const s = deriveCommandCenterState(jobs);
    expect(s.mode).toBe("succeeded");
    expect(s.failedJob).toBeNull();
  });

  it("reports failed mode when latest failure is unresolved", () => {
    const jobs = [
      mkJob({ id: "f1", type: "build.production", status: "failed", createdAt: "2026-05-01T13:00:00Z" }),
      mkJob({ id: "s1", type: "build.production", status: "succeeded", createdAt: "2026-05-01T12:00:00Z" }),
    ];
    const s = deriveCommandCenterState(jobs);
    expect(s.mode).toBe("failed");
    expect(s.failedJob?.id).toBe("f1");
  });

  it("does NOT mark failed for ai.plan placeholder when infra is green", () => {
    const jobs = [
      mkJob({ id: "build1", type: "build.production", status: "succeeded", createdAt: "2026-05-01T10:00:00Z" }),
      mkJob({ id: "f1", type: "ai.plan", status: "failed", createdAt: "2026-05-01T13:00:00Z", error: "Provider call is not wired yet" }),
    ];
    const s = deriveCommandCenterState(jobs);
    expect(s.mode).not.toBe("failed");
    expect(s.failedJob).toBeNull();
  });
});
