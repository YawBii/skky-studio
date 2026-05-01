import { describe, it, expect } from "vitest";
import { resolveDeployUrl } from "./deploy-url";
import type { ProjectConnection } from "@/services/project-connections";

function conn(overrides: Partial<ProjectConnection>): ProjectConnection {
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
    workspaceId: null,
    externalId: null,
    url: null,
    tokenOwnerType: null,
    providerAccountId: null,
    ...overrides,
  };
}

describe("resolveDeployUrl", () => {
  it("uses metadata.lastPreviewDeployment.url first", () => {
    const r = resolveDeployUrl([
      conn({
        url: "https://fallback.vercel.app",
        metadata: { lastPreviewDeployment: { url: "https://preview-abc.vercel.app" } },
      }),
    ]);
    expect(r.url).toBe("https://preview-abc.vercel.app");
    expect(r.source).toBe("vercel.lastPreviewDeployment");
  });

  it("falls back to project_connections.url", () => {
    const r = resolveDeployUrl([conn({ url: "https://my-proj.vercel.app", metadata: {} })]);
    expect(r.url).toBe("https://my-proj.vercel.app");
    expect(r.source).toBe("vercel.connection.url");
  });

  it("normalizes bare host to https://", () => {
    const r = resolveDeployUrl([
      conn({ metadata: { lastPreviewDeployment: { url: "preview-abc.vercel.app" } } }),
    ]);
    expect(r.url).toBe("https://preview-abc.vercel.app");
  });

  it("falls back to project metadata previewUrl", () => {
    const r = resolveDeployUrl([], { previewUrl: "https://meta.example.com" });
    expect(r.source).toBe("project.metadata.previewUrl");
    expect(r.url).toBe("https://meta.example.com");
  });

  it("returns none when nothing is available", () => {
    expect(resolveDeployUrl([]).url).toBeNull();
    expect(resolveDeployUrl([]).source).toBe("none");
  });

  it("ignores vercel connections that are not connected", () => {
    const r = resolveDeployUrl([conn({ status: "pending", url: "https://x.vercel.app" })]);
    expect(r.url).toBeNull();
  });
});
