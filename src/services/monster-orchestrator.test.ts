import { describe, expect, it } from "vitest";
import { generateMonsterProject } from "./monster-orchestrator";

const project = { id: "p1", name: "LawForge", description: "AI law firm platform" };

describe("Monster orchestrator", () => {
  it("combines command-first blueprint, custom preview, backend, architect files, and proof", () => {
    const result = generateMonsterProject({
      project,
      chatRequest: "Build a premium AI law firm with auth, dashboard, admin and payments",
      production: true,
    });
    expect(result.generator).toBe("monster-orchestrator-v1");
    expect(result.output.previewGenerator).toBe("monster-custom-preview-v1");
    expect(result.blueprint.appType).toBe("professional-services");
    expect(result.blueprint.design.mode).toBe("editorial-luxury");
    expect(result.output.previewReady).toBe(true);
    expect(result.files.some((file) => file.path === "index.html")).toBe(true);
    expect(result.files.some((file) => file.path.endsWith("_monster_backend.md"))).toBe(true);
    expect(result.files.some((file) => file.path.endsWith("_monster_blueprint.json"))).toBe(true);
    expect(result.files.some((file) => file.path.startsWith("supabase/migrations/"))).toBe(true);
    expect(result.files.some((file) => file.path === "src/routes/index.tsx")).toBe(true);
    expect(result.files.some((file) => file.path === "src/components/monster/MatterCommandCenter.tsx")).toBe(true);
    expect(result.output.architectFileCount).toBeGreaterThan(3);
    expect(result.output.written).toContain("src/routes/index.tsx");
    expect(result.output.designCritique?.join(" ")).toContain("old design-mode template shell");
    expect(result.output.tableCount).toBeGreaterThan(0);
    expect(result.output.policyCount).toBeGreaterThan(0);
    expect(result.proof.canDeclareDone).toBe(false);
  });

  it("uses blueprint design while replacing the old preset preview shell", () => {
    const result = generateMonsterProject({
      project: { id: "p2", name: "OpsPulse", description: "operator metrics dashboard" },
      chatRequest: "Create an analytics admin dashboard for operators with metrics and audit logs",
    });
    expect(result.blueprint.design.mode).toBe("glass-dashboard");
    const index = result.files.find((file) => file.path === "index.html")?.content ?? "";
    expect(index).toContain('name="yawb-generator" content="monster-custom-preview-v1"');
    expect(index).toContain('name="yawb-design-mode" content="glass-dashboard"');
    expect(index).toContain('name="yawb-layout"');
  });
});
