import { describe, it, expect } from "vitest";
import { generateProjectFiles, computeVisualFingerprint, type DesignMode } from "./monster-brain-generator";

const project = { id: "p-test", name: "Goodhand", description: "scanner that praises kind humans" };

function indexHtml(p: typeof project, ctx: Parameters<typeof generateProjectFiles>[1]) {
  return generateProjectFiles(p, ctx).find((f) => f.path === "index.html")!.content;
}

describe("Monster Brain v1 — designMode override", () => {
  it("forces the selected designMode regardless of regenerationSeed", () => {
    for (const seed of ["seed-A", "seed-B", "seed-C"]) {
      const fp = computeVisualFingerprint(project, { designMode: "neon-command", regenerationSeed: seed });
      expect(fp.designMode).toBe("neon-command");
    }
  });

  it("Luxury Editorial vs Neon Command produce different index.html for the same project", () => {
    const lux = indexHtml(project, { designMode: "editorial-luxury", regenerationSeed: "x", forceVariant: true });
    const neon = indexHtml(project, { designMode: "neon-command", regenerationSeed: "x", forceVariant: true });
    expect(lux).not.toEqual(neon);
    expect(lux).toContain('name="yawb-design-mode" content="editorial-luxury"');
    expect(neon).toContain('name="yawb-design-mode" content="neon-command"');
  });

  it("emits proof meta tags including hero-layout and palette", () => {
    const html = indexHtml(project, { designMode: "minimal-light" });
    expect(html).toContain('name="yawb-design-mode" content="minimal-light"');
    expect(html).toContain('name="yawb-hero-layout"');
    expect(html).toContain('name="yawb-palette"');
    expect(html).toContain('name="yawb-visual-fingerprint"');
  });

  it("each angle produces its expected designMode meta", () => {
    const angles: DesignMode[] = [
      "editorial-luxury", "glass-dashboard", "civic-map",
      "neon-command", "magazine-cards", "minimal-light", "brutalist-data",
    ];
    for (const a of angles) {
      const html = indexHtml(project, { designMode: a });
      expect(html).toContain(`name="yawb-design-mode" content="${a}"`);
    }
  });

  it("seed varies internal section order but does NOT change selected designMode", () => {
    const a = indexHtml(project, { designMode: "glass-dashboard", regenerationSeed: "S1", forceVariant: true });
    const b = indexHtml(project, { designMode: "glass-dashboard", regenerationSeed: "S2", forceVariant: true });
    expect(a).toContain('content="glass-dashboard"');
    expect(b).toContain('content="glass-dashboard"');
    expect(a).not.toEqual(b);
  });
});
