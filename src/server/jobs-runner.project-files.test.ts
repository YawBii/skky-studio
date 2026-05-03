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
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            return { data: project, error: null };
          },
        };
      }
      if (table === "project_connections") {
        // No GitHub link — Monster orchestrator is allowed to generate.
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          limit() {
            return this;
          },
          async maybeSingle() {
            return { data: null, error: null };
          },
        };
      }
      if (table === "project_files") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            return { data: null, error: null };
          },
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

// Hard-blocked, user-visible preset strings. The internal design-mode tokens
// ("editorial-luxury", "minimal-light") are allowed because they are emitted
// only as <meta name="yawb-design-mode"> identifiers — not visible preset copy.
const BANNED_PRESET_STRINGS = ["Luxury Editorial", "Clean Minimal", "Money operations"];

describe("jobs-runner project_files persistence (Monster orchestrator)", () => {
  it("build.production writes files via monster-orchestrator-v1", async () => {
    const sb = fakeSupabase();
    const result = await generateAndPersistProjectFiles(sb, job("build.production"));

    expect(result.ok).toBe(true);
    expect(result.generator).toBe("monster-orchestrator-v1");
    expect(result.previewReady).toBe(true);
    expect(result.written).toContain("index.html");
    expect(sb.upserts.some((r) => r.path === "index.html")).toBe(true);
  });

  it("ai.generate_changes writes files via monster-orchestrator-v1", async () => {
    const sb = fakeSupabase();
    const result = await generateAndPersistProjectFiles(sb, job("ai.generate_changes"));

    expect(result.ok).toBe(true);
    expect(result.generator).toBe("monster-orchestrator-v1");
    expect(result.previewReady).toBe(true);
    expect(result.designSignature).toMatch(/^monster-orchestrator-v1:/);
  });

  it("ai.generate_changes with regenerationSeed records the seed in the signature", async () => {
    const sb = fakeSupabase();
    const seededJob: JobRow = {
      ...job("ai.generate_changes"),
      input: {
        chatRequest: project.description,
        regenerationSeed: "regen-XYZ",
        forceVariant: true,
      },
    };
    const result = await generateAndPersistProjectFiles(sb, seededJob);
    expect(result.regenerationSeed).toBe("regen-XYZ");
    expect(result.designSignature).toMatch(/seed-regen-XYZ/);
  });

  it("generated index.html never contains banned legacy preset strings", async () => {
    const sb = fakeSupabase();
    await generateAndPersistProjectFiles(sb, job("ai.generate_changes"));
    const indexHtml = String(sb.upserts.find((r) => r.path === "index.html")?.content ?? "");
    for (const banned of BANNED_PRESET_STRINGS) {
      expect(indexHtml).not.toContain(banned);
    }
  });

  it("refuses to generate when the project has a GitHub connection", async () => {
    const sb = {
      upserts: [] as Array<Record<string, unknown>>,
      from(table: string) {
        if (table === "project_connections") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            limit() {
              return this;
            },
            async maybeSingle() {
              return { data: { id: "c1" }, error: null };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    const result = await generateAndPersistProjectFiles(sb, job("ai.generate_changes"));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/linked to GitHub/i);
  });
});
