import { describe, expect, it } from "vitest";
import { generateAndPersistProjectFiles, type JobRow } from "./jobs-runner.server";

const project = {
  id: "p-goodhand",
  name: "Goodhand",
  description: "scanner that finds people who did something good to humanity and praises them",
};

function fakeSupabase() {
  const upserts: Array<Record<string, unknown>> = [];
  const sb = {
    upserts,
    from(table: string) {
      if (table === "projects") {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() { return { data: project, error: null }; },
        };
      }
      if (table === "project_files") {
        return {
          async upsert(row: Record<string, unknown>) {
            upserts.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return sb;
}

function job(type: "build.production" | "ai.generate_changes"): JobRow {
  return {
    id: `${type}-1`,
    project_id: project.id,
    workspace_id: "w1",
    type,
    status: "running",
    title: type,
    input: { chatRequest: project.description },
  };
}

describe("jobs-runner project_files persistence", () => {
  it("build.production writes index.html/app.css/app.js with Monster Brain proof", async () => {
    const sb = fakeSupabase();
    const result = await generateAndPersistProjectFiles(sb, job("build.production"));

    expect(result.ok).toBe(true);
    expect(result.generator).toBe("monster-brain-v1");
    expect(result.previewReady).toBe(true);
    expect(result.archetype).toBe("social-good");
    expect(result.written).toEqual(["app.css", "app.js", "index.html"]);
    expect(sb.upserts.map((r) => r.path).sort()).toEqual(["app.css", "app.js", "index.html"]);
    expect(String(sb.upserts.find((r) => r.path === "index.html")?.content).toLowerCase()).toContain("scanner");
  });

  it("ai.generate_changes writes index.html/app.css/app.js with Monster Brain proof", async () => {
    const sb = fakeSupabase();
    const result = await generateAndPersistProjectFiles(sb, job("ai.generate_changes"));

    expect(result.ok).toBe(true);
    expect(result.generator).toBe("monster-brain-v1");
    expect(result.previewReady).toBe(true);
    expect(result.designSignature).toContain("mb-v1:social-good");
    expect(result.written).toEqual(["app.css", "app.js", "index.html"]);
    expect(sb.upserts).toHaveLength(3);
  });
});