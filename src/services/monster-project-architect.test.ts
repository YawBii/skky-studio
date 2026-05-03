import { describe, expect, it } from "vitest";
import { createMonsterBlueprint } from "./monster-director";
import { generateMonsterArchitectFiles } from "./monster-project-architect";

const project = { id: "p1", name: "LawForge", description: "AI law firm platform" };

describe("Monster project architect", () => {
  it("generates app-specific route/component/style/doc files", () => {
    const blueprint = createMonsterBlueprint({
      project,
      chatRequest:
        "Build a premium AI law firm app with auth, dashboard, admin panel, payments, and Supabase backend.",
    });
    const result = generateMonsterArchitectFiles(blueprint);
    expect(result.generator).toBe("monster-project-architect-v1");
    expect(result.files.some((file) => file.path === "src/routes/index.tsx")).toBe(true);
    expect(
      result.files.some((file) => file.path === "src/components/monster/MatterCommandCenter.tsx"),
    ).toBe(true);
    expect(
      result.files.some((file) => file.path === "src/components/monster/MonsterProofRail.tsx"),
    ).toBe(true);
    expect(result.files.some((file) => file.path === "src/styles/monster-app.css")).toBe(true);
    expect(result.designCritique.join(" ")).toContain("not a recolored template");
  });

  it("ties generated files to blueprint routes and backend tables", () => {
    const blueprint = createMonsterBlueprint({
      project: { id: "p2", name: "OpsPulse", description: "analytics dashboard" },
      chatRequest: "Create an analytics admin dashboard for operators with metrics and audit logs",
    });
    const result = generateMonsterArchitectFiles(blueprint);
    expect(result.routes.length).toBeGreaterThan(2);
    expect(result.backendArtifacts).toContain("profiles");
    expect(result.files.map((file) => file.path)).toContain("src/routes/dashboard.tsx");
  });
});
