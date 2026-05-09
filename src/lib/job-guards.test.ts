import { describe, expect, it } from "vitest";
import { getStaleActiveJobs, hasActiveJob, STALE_QUEUED_JOB_MS } from "./job-guards";
import type { Job } from "@/services/jobs";

function job(overrides: Partial<Job>): Job {
  return {
    id: "j1",
    projectId: "p1",
    workspaceId: "w1",
    type: "ai.generate_changes",
    status: "queued",
    title: "Regenerate design",
    input: {},
    output: {},
    error: null,
    retryCount: 0,
    createdBy: "u1",
    createdAt: "2026-05-09T00:00:00.000Z",
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

describe("job stale timeout guards", () => {
  it("treats old queued jobs as stale instead of active", () => {
    const now = Date.parse("2026-05-09T00:02:00.000Z");
    const jobs = [job({ createdAt: new Date(now - STALE_QUEUED_JOB_MS - 1).toISOString() })];
    expect(getStaleActiveJobs(jobs, now)).toEqual([
      expect.objectContaining({ jobId: "j1", reason: "queued_timeout" }),
    ]);
    expect(hasActiveJob(jobs)).toBe(false);
  });

  it("keeps fresh queued jobs active", () => {
    const now = Date.parse("2026-05-09T00:01:00.000Z");
    const jobs = [job({ createdAt: new Date(now - 1_000).toISOString() })];
    expect(getStaleActiveJobs(jobs, now)).toEqual([]);
    expect(hasActiveJob(jobs)).toBe(true);
  });
});
