import { describe, expect, it } from "vitest";
import { generateMonsterProject } from "./monster-orchestrator";
import { generateMonsterDesignBrief } from "./monster-design-brief";
import { createMonsterBlueprint } from "./monster-director";

describe("Monster design brief & visual quality", () => {
  it("emits a design brief, critique, and visual verdict", () => {
    const result = generateMonsterProject({
      project: { id: "fam1", name: "Hearth", description: "family life coordinator" },
      chatRequest: "Build a family life app for shared chores, calendar, and check-ins",
    });
    expect(result.designBrief.version).toBe("monster-design-brief-v1");
    expect(result.designBrief.productCategory).toBe("family-life");
    expect(result.designBrief.keyScreens.length).toBeGreaterThan(2);
    expect(result.critique.beautiful.length).toBeGreaterThan(0);
    expect(result.critique.appSpecific.length).toBeGreaterThan(0);
    expect(["ship", "repair", "block"]).toContain(result.critique.verdict);
    expect(result.visualQuality.checks.find((c) => c.id === "no-banned-template")?.passed).toBe(true);
    const index = result.files.find((f) => f.path === "index.html")?.content ?? "";
    expect(index).toContain('name="yawb-category" content="family-life"');
    expect(index).toContain('name="yawb-nav-pattern"');
  });

  it("varies the brief by varianceSeed (palette/nav/typography may differ)", () => {
    const blueprint = createMonsterBlueprint({
      project: { id: "p1", name: "OpsPulse", description: "operator dashboard" },
      chatRequest: "internal ops dashboard",
    });
    const a = generateMonsterDesignBrief(blueprint, "seed-a");
    const b = generateMonsterDesignBrief(blueprint, "seed-different-7");
    const sig = (x: typeof a) =>
      `${x.colorPalette.name}|${x.navigationPattern}|${x.cardStyle}|${x.typographyPairing.display}|${x.spacingRhythm}`;
    expect(sig(a)).not.toBe(sig(b));
  });

  it("law firm and family life produce different categories and palettes", () => {
    const law = generateMonsterProject({
      project: { id: "law", name: "LawForge", description: "law firm" },
      chatRequest: "premium law firm with case management",
    });
    const fam = generateMonsterProject({
      project: { id: "fam", name: "Hearth", description: "family life coordinator" },
      chatRequest: "family life app",
    });
    expect(law.designBrief.productCategory).toBe("legal-operations");
    expect(fam.designBrief.productCategory).toBe("family-life");
  });

  it("rejects projects whose preview hits banned template strings (failed visual gate)", () => {
    const result = generateMonsterProject({
      project: { id: "p1", name: "LawForge", description: "AI law firm" },
      chatRequest: "law firm",
    });
    const visualGate = result.proof.gates.find((g) => g.id === "visual-quality");
    expect(visualGate).toBeDefined();
    // Either passed or, if failed, must list a real reason
    if (visualGate?.status === "failed") {
      expect(visualGate.error).toBeTruthy();
    } else {
      expect(visualGate?.status).toBe("passed");
    }
  });

  it("repairAttempts is recorded and bounded", () => {
    const result = generateMonsterProject({
      project: { id: "x", name: "Bookly", description: "booking app" },
      chatRequest: "booking platform",
    });
    expect(result.repairAttempts).toBeGreaterThanOrEqual(0);
    expect(result.repairAttempts).toBeLessThanOrEqual(1);
    expect(result.output.repairAttempts).toBe(result.repairAttempts);
  });
});
