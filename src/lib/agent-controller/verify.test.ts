import { describe, it, expect } from "vitest";
import { verifyArtifact } from "./verify";
import { buildLawFirmHomepage } from "./homepage-builder";

describe("verifyArtifact — homepage gate", () => {
  it("passes for the deterministic law-firm homepage", () => {
    const out = buildLawFirmHomepage({ project: { id: "p", name: "Pillar" } });
    const r = verifyArtifact({
      artifactType: "homepage",
      files: { indexHtml: out.indexHtml, stylesCss: out.stylesCss },
    });
    expect(r.passed).toBe(true);
    expect(r.failedGates).toEqual([]);
  });

  it("fails for a dashboard/cockpit first-screen page", () => {
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{}</style></head><body><h1>Case cockpit</h1><div>Matter board command center</div></body></html>`;
    const r = verifyArtifact({ artifactType: "homepage", files: { indexHtml: html, stylesCss: null } });
    expect(r.passed).toBe(false);
  });

  it("fails for blog/article/library framing", () => {
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{}</style></head><body><h1>Article series — manifesto</h1><p>publication library archive journal entry</p></body></html>`;
    const r = verifyArtifact({ artifactType: "homepage", files: { indexHtml: html, stylesCss: null } });
    expect(r.passed).toBe(false);
    expect(r.failedGates.join(",")).toMatch(/blog|article|library|archive/i);
  });

  it("fails for raw unstyled HTML", () => {
    const html = `<!doctype html><html><body><h1>hi</h1></body></html>`;
    const r = verifyArtifact({ artifactType: "homepage", files: { indexHtml: html, stylesCss: null } });
    expect(r.passed).toBe(false);
  });
});
