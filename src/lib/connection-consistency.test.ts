import { describe, expect, it } from "vitest";
import { checkProjectConnectionConsistency } from "./connection-consistency";
import type { ProjectConnection } from "@/services/project-connections";

function conn(over: Partial<ProjectConnection>): ProjectConnection {
  return {
    id: "c1",
    projectId: "p1",
    provider: "vercel",
    status: "connected",
    repoFullName: null,
    repoUrl: null,
    defaultBranch: null,
    metadata: {},
    createdBy: "u1",
    createdAt: "",
    updatedAt: "",
    workspaceId: "w1",
    externalId: "ext-1",
    url: "https://app.vercel.app",
    tokenOwnerType: "workspace",
    providerAccountId: null,
    ...over,
  };
}

describe("checkProjectConnectionConsistency", () => {
  it("returns ok for a healthy single Vercel link", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [conn({})]);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.proof).toHaveLength(1);
  });

  it("flags a connection bound to a different project as an error", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [conn({ projectId: "p2" })]);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/different project/);
  });

  it("flags a connection bound to a different workspace as an error", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [conn({ workspaceId: "w2" })]);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/different workspace/);
  });

  it("does NOT warn when status is not connected (inactive rows are history)", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [conn({ status: "pending" })]);
    expect(r.warnings).toEqual([]);
    expect(r.proof).toHaveLength(0);
    expect(r.inactiveProof).toHaveLength(1);
  });

  it("warns when active GitHub and Vercel repos do not match", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [
      conn({ id: "c1", provider: "github", externalId: "1", repoFullName: "YawBii/ujob" }),
      conn({ id: "c2", provider: "vercel", externalId: "v1", repoFullName: "other/other" }),
    ]);
    expect(r.warnings.some((w) => w.toLowerCase().includes("does not match"))).toBe(true);
  });

  it("does NOT warn for repo mismatch when one side is disconnected", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [
      conn({ id: "c1", provider: "github", externalId: "1", repoFullName: "YawBii/ujob" }),
      conn({
        id: "c2",
        provider: "vercel",
        externalId: "v1",
        repoFullName: "other/other",
        status: "disconnected",
      }),
    ]);
    expect(r.warnings).toEqual([]);
  });

  it("ignores unsupported providers", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [
      conn({ provider: "bitbucket" as ProjectConnection["provider"] }),
    ]);
    expect(r.proof).toHaveLength(0);
    expect(r.inactiveProof).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("returns error when projectId is null", () => {
    const r = checkProjectConnectionConsistency(null, "w1", []);
    expect(r.ok).toBe(false);
  });

  it("errors when more than one Vercel connection is active for the same project", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [
      conn({ id: "c1", provider: "vercel", externalId: "v1" }),
      conn({ id: "c2", provider: "vercel", externalId: "v2" }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.toLowerCase().includes("active vercel"))).toBe(true);
  });

  it("does not error or warn when one Vercel is connected and another is disconnected", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [
      conn({ id: "c1", provider: "vercel", externalId: "v1", status: "connected" }),
      conn({ id: "c2", provider: "vercel", externalId: "v2", status: "disconnected" }),
    ]);
    expect(r.errors.some((e) => e.toLowerCase().includes("active vercel"))).toBe(false);
    expect(r.warnings).toEqual([]);
    expect(r.proof).toHaveLength(1);
    expect(r.inactiveProof).toHaveLength(1);
  });

  it("does not flag duplicate-active errors when extra rows are disconnected", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [
      conn({ id: "c1", provider: "vercel", status: "connected", externalId: "v1" }),
      conn({ id: "c2", provider: "vercel", status: "disconnected", externalId: "v2" }),
      conn({ id: "c3", provider: "vercel", status: "disconnected", externalId: "v3" }),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.inactiveProof).toHaveLength(2);
  });

  it("warns when active Vercel is missing a deployment URL", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [
      conn({ provider: "vercel", url: null }),
    ]);
    expect(r.warnings.some((w) => w.toLowerCase().includes("deployment url"))).toBe(true);
  });

  it("active Vercel + active GitHub matching repo is healthy", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [
      conn({ id: "c1", provider: "github", externalId: "g1", repoFullName: "YawBii/ujob" }),
      conn({
        id: "c2",
        provider: "vercel",
        externalId: "v1",
        repoFullName: "YawBii/ujob",
        url: "https://ujob.vercel.app",
      }),
    ]);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
    expect(r.proof).toHaveLength(2);
  });
});
