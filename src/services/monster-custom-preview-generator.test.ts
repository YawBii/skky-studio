import { describe, expect, it } from "vitest";
import { createMonsterBlueprint } from "./monster-director";
import { generateMonsterCustomPreviewFiles } from "./monster-custom-preview-generator";

const project = { id: "p1", name: "LawForge", description: "AI law firm platform" };

describe("Monster custom preview generator", () => {
  it("generates law apps with case cockpit layout instead of editorial template shell", () => {
    const blueprint = createMonsterBlueprint({
      project,
      chatRequest: "Build a premium AI law firm app with auth, dashboard, admin panel, payments, and Supabase backend.",
    });
    const files = generateMonsterCustomPreviewFiles(blueprint);
    const index = files.find((file) => file.path === "index.html")?.content ?? "";
    expect(index).toContain('name="yawb-generator" content="monster-custom-preview-v1"');
    expect(index).toContain('name="yawb-layout" content="case-cockpit"');
    expect(index).toContain("legal operations with a case cockpit");
    expect(index).not.toContain("Money operations");
  });

  it("generates identity prompts with trust radar layout", () => {
    const blueprint = createMonsterBlueprint({
      project: { id: "p2", name: "Proofly", description: "identity verification" },
      chatRequest: "Build an identity verification platform with profile trust graph, compliance and fraud signals.",
    });
    const index = generateMonsterCustomPreviewFiles(blueprint).find((file) => file.path === "index.html")?.content ?? "";
    expect(index).toContain('name="yawb-layout" content="trust-radar"');
    expect(index).toContain("verification radar");
  });
});
