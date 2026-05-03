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

  it("warns when status is not connected", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [conn({ status: "pending" })]);
    expect(r.warnings.some((w) => w.includes("status"))).toBe(true);
  });

  it("warns when GitHub and Vercel repos do not match", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [
      conn({ id: "c1", provider: "github", externalId: "1", repoFullName: "YawBii/ujob" }),
      conn({ id: "c2", provider: "vercel", externalId: "v1", repoFullName: "other/other" }),
    ]);
    expect(r.warnings.some((w) => w.toLowerCase().includes("does not match"))).toBe(true);
  });

  it("ignores unsupported providers", () => {
    const r = checkProjectConnectionConsistency("p1", "w1", [
      // @ts-expect-error testing filter
      conn({ provider: "bitbucket" }),
    ]);
    expect(r.proof).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("returns error when projectId is null", () => {
    const r = checkProjectConnectionConsistency(null, "w1", []);
    expect(r.ok).toBe(false);
  });
});
