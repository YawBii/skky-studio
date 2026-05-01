import { describe, it, expect } from "vitest";
import { resolvePreviewSource, hasLocalPreview } from "./preview-source";
import type { ProjectConnection } from "@/services/project-connections";
import type { Project } from "@/services/projects";

const project: Project = {
  id: "p1",
  workspaceId: "w1",
  name: "Goodhand",
  slug: "goodhand",
  description: null,
  createdAt: "",
};

function vercelConn(overrides: Partial<ProjectConnection> = {}): ProjectConnection {
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

describe("resolvePreviewSource", () => {
  it("returns live when activeDeployUrl exists", () => {
    const r = resolvePreviewSource({
      project,
      connections: [vercelConn({ url: "https://goodhand.vercel.app" })],
    });
    expect(r.kind).toBe("live");
    expect(r.url).toBe("https://goodhand.vercel.app");
    expect(r.externalOpenable).toBe(true);
  });

  it("returns local without /preview/$projectId URL when no deploy URL but project exists", () => {
    const r = resolvePreviewSource({ project, connections: [] });
    expect(r.kind).toBe("local");
    expect(r.url).toBeUndefined();
    expect(r.srcDoc).toBeUndefined();
    expect(r.label).toBe("Local preview");
    expect(r.externalOpenable).toBe(false);
  });

  it("renders srcDoc when generated index.html is available", () => {
    const r = resolvePreviewSource({
      project,
      connections: [],
      generated: { indexHtml: "<!doctype html><title>x</title>", hasFiles: true },
    });
    expect(r.kind).toBe("local");
    expect(r.srcDoc).toContain("<!doctype html>");
    expect(r.url).toBe("project_files/index.html");
    expect(r.source).toBe("project_files/index.html");
    expect(r.label).toBe("project_files/index.html");
    expect(r.externalOpenable).toBe(false);
  });

  it("returns empty when no project and no generated files", () => {
    const r = resolvePreviewSource({ project: null, connections: [] });
    expect(r.kind).toBe("empty");
    expect(r.externalOpenable).toBe(false);
  });

  it("preferred=local forces local even when live URL exists", () => {
    const r = resolvePreviewSource({
      project,
      connections: [vercelConn({ url: "https://goodhand.vercel.app" })],
      preferred: "local",
    });
    expect(r.kind).toBe("local");
  });

  it("preferred=live falls back to local when no deploy URL", () => {
    const r = resolvePreviewSource({ project, connections: [], preferred: "live" });
    expect(r.kind).toBe("local");
  });

  it("hasLocalPreview reports true only with content", () => {
    expect(hasLocalPreview(null)).toBe(false);
    expect(hasLocalPreview({})).toBe(false);
    expect(hasLocalPreview({ hasFiles: true })).toBe(true);
    expect(hasLocalPreview({ indexHtml: "<!doctype html>" })).toBe(true);
  });
});
