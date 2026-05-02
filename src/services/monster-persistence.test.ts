import { describe, expect, it } from "vitest";
import { generateMonsterProject } from "./monster-orchestrator";
import { persistMonsterGeneratedFiles, splitMonsterGeneratedFiles } from "./monster-persistence";

function fakeSupabase() {
  const rows: Array<Record<string, unknown>> = [];
  return {
    rows,
    from(table: string) {
      return {
        upsert(payload: Record<string, unknown>) {
          rows.push({ table, ...payload });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

describe("Monster persistence", () => {
  it("persists all generated frontend and backend files into project_files", async () => {
    const generation = generateMonsterProject({
      project: { id: "p1", name: "LawForge", description: "AI law firm" },
      chatRequest: "Build a premium AI law firm with auth, dashboard, admin and payments",
    });
    const sb = fakeSupabase();
    const result = await persistMonsterGeneratedFiles({ sb, projectId: "p1", generation });
    expect(result.ok).toBe(true);
    expect(result.written).toContain("index.html");
    expect(result.written.some((path) => path.startsWith("supabase/migrations/"))).toBe(true);
    expect(result.output?.generator).toBe("monster-orchestrator-v1");
    expect(sb.rows).toHaveLength(generation.files.length);
  });

  it("splits generated files into frontend and backend groups", () => {
    const generation = generateMonsterProject({
      project: { id: "p1", name: "OpsPulse", description: "dashboard" },
      chatRequest: "Create an analytics admin dashboard",
    });
    const split = splitMonsterGeneratedFiles(generation.files);
    expect(split.frontend.some((file) => file.path === "index.html")).toBe(true);
    expect(split.backend.some((file) => file.path.startsWith("supabase/"))).toBe(true);
  });
});
