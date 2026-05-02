import { describe, it, expect } from "vitest";
import {
  isFailedJobResolved,
  getResolvingSuccess,
  partitionFailures,
  groupResolvedFailuresByType,
  describeUnresolvedReason,
} from "./job-resolution";
import type { Job, JobStatus } from "@/services/jobs";

function mkJob(p: {
  id: string;
  type: string;
  status: JobStatus;
  createdAt: string;
  error?: string | null;
}): Job {
  return {
    id: p.id,
    projectId: "p",
    workspaceId: "w",
    type: p.type,
    status: p.status,
    title: p.id,
    input: {},
    output: {},
    error: p.error ?? null,
    retryCount: 0,
    createdBy: "u",
    createdAt: p.createdAt,
    startedAt: null,
    finishedAt: null,
  };
}

describe("isFailedJobResolved", () => {
  it("resolves when newer same-type success exists", () => {
    const failed = mkJob({
      id: "f1",
      type: "build.production",
      status: "failed",
      createdAt: "2026-05-01T10:00:00Z",
    });
    const succ = mkJob({
      id: "s1",
      type: "build.production",
      status: "succeeded",
      createdAt: "2026-05-01T11:00:00Z",
    });
    expect(isFailedJobResolved(failed, [failed, succ])).toBe(true);
    expect(getResolvingSuccess(failed, [failed, succ])?.id).toBe("s1");
  });

  it("does NOT resolve when failure is newer than success", () => {
    const succ = mkJob({
      id: "s1",
      type: "build.production",
      status: "succeeded",
      createdAt: "2026-05-01T10:00:00Z",
    });
    const failed = mkJob({
      id: "f1",
      type: "build.production",
      status: "failed",
      createdAt: "2026-05-01T11:00:00Z",
    });
    expect(isFailedJobResolved(failed, [failed, succ])).toBe(false);
  });

  it("does NOT resolve cross-type (failed ai.plan, succeeded build.production)", () => {
    const failed = mkJob({
      id: "f1",
      type: "ai.plan",
      status: "failed",
      createdAt: "2026-05-01T10:00:00Z",
    });
    const succ = mkJob({
      id: "s1",
      type: "build.production",
      status: "succeeded",
      createdAt: "2026-05-01T11:00:00Z",
    });
    expect(isFailedJobResolved(failed, [failed, succ])).toBe(false);
  });

  it("resolves transient invalid bearer token build.production failure with later build.production success", () => {
    const failed = mkJob({
      id: "f1",
      type: "build.production",
      status: "failed",
      createdAt: "2026-05-01T10:00:00Z",
      error: "invalid bearer token",
    });
    const succ = mkJob({
      id: "s1",
      type: "build.production",
      status: "succeeded",
      createdAt: "2026-05-01T11:00:00Z",
    });
    expect(isFailedJobResolved(failed, [failed, succ])).toBe(true);
  });
});

describe("partitionFailures + grouping", () => {
  it("partitions correctly and groups by type", () => {
    const oldBuildFail = mkJob({
      id: "f1",
      type: "build.production",
      status: "failed",
      createdAt: "2026-05-01T08:00:00Z",
    });
    const buildSucc = mkJob({
      id: "s1",
      type: "build.production",
      status: "succeeded",
      createdAt: "2026-05-01T09:00:00Z",
    });
    const newAiFail = mkJob({
      id: "f2",
      type: "ai.plan",
      status: "failed",
      createdAt: "2026-05-01T12:00:00Z",
    });
    const jobs = [oldBuildFail, buildSucc, newAiFail];
    const { activeFailed, resolvedFailed } = partitionFailures(jobs);
    expect(activeFailed.map((j) => j.id)).toEqual(["f2"]);
    expect(resolvedFailed.map((j) => j.id)).toEqual(["f1"]);
    const groups = groupResolvedFailuresByType(jobs);
    expect(groups.get("build.production")?.length).toBe(1);
    expect(groups.has("ai.plan")).toBe(false);
  });
});

describe("describeUnresolvedReason", () => {
  it("reports 'no newer success' when no success of that type exists", () => {
    const failed = mkJob({
      id: "f1",
      type: "build.production",
      status: "failed",
      createdAt: "2026-05-01T10:00:00Z",
    });
    expect(describeUnresolvedReason(failed, [failed])).toMatch(
      /No newer build\.production success/,
    );
  });
  it("reports 'failure is newer' when failure post-dates the success", () => {
    const succ = mkJob({
      id: "s1",
      type: "build.production",
      status: "succeeded",
      createdAt: "2026-05-01T10:00:00Z",
    });
    const failed = mkJob({
      id: "f1",
      type: "build.production",
      status: "failed",
      createdAt: "2026-05-01T11:00:00Z",
    });
    expect(describeUnresolvedReason(failed, [failed, succ])).toMatch(/Latest failure is newer/);
  });
});
