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
    const r = verifyArtifact({
      artifactType: "homepage",
      files: { indexHtml: html, stylesCss: null },
    });
    expect(r.passed).toBe(false);
  });

  it("fails for blog/article/library framing", () => {
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{}</style></head><body><h1>Article series — manifesto</h1><p>publication library archive journal entry</p></body></html>`;
    const r = verifyArtifact({
      artifactType: "homepage",
      files: { indexHtml: html, stylesCss: null },
    });
    expect(r.passed).toBe(false);
    expect(r.failedGates.join(",")).toMatch(/blog|article|library|archive/i);
  });

  it("fails for raw unstyled HTML", () => {
    const html = `<!doctype html><html><body><h1>hi</h1></body></html>`;
    const r = verifyArtifact({
      artifactType: "homepage",
      files: { indexHtml: html, stylesCss: null },
    });
    expect(r.passed).toBe(false);
  });

  it("homepage gate does NOT require dashboard tokens (cockpit/matter board/RLS/Supabase/admin)", () => {
    const out = buildLawFirmHomepage({ project: { id: "p", name: "Pillar" } });
    const r = verifyArtifact({
      artifactType: "homepage",
      files: { indexHtml: out.indexHtml, stylesCss: out.stylesCss },
    });
    expect(r.passed).toBe(true);
    const requiredLabels = r.checks
      .filter((c) => c.id !== "no-cockpit" && c.id !== "no-app-shell" && c.id !== "no-blog")
      .map((c) => c.label.toLowerCase())
      .join("|");
    expect(requiredLabels).not.toMatch(/cockpit|matter board|rls|supabase|admin panel|kpi/);
  });

  it("generated homepage contains none of the banned dashboard tokens", () => {
    const out = buildLawFirmHomepage({ project: { id: "p", name: "Pillar" } });
    const all = (out.indexHtml + "\n" + out.stylesCss).toLowerCase();
    for (const banned of [
      "matter board",
      "case cockpit",
      "active matters",
      "rls polic",
      "supabase locked",
      "admin panel",
      "kpi grid",
    ]) {
      expect(all.includes(banned)).toBe(false);
    }
  });

  it("requires nav, hero, practice, team, pricing, contact, styled, responsive", () => {
    const out = buildLawFirmHomepage({ project: { id: "p", name: "Pillar" } });
    const r = verifyArtifact({
      artifactType: "homepage",
      files: { indexHtml: out.indexHtml, stylesCss: out.stylesCss },
    });
    const ids = r.checks.filter((c) => c.passed).map((c) => c.id);
    for (const id of [
      "nav",
      "hero",
      "practice",
      "team",
      "pricing",
      "contact",
      "styled",
      "responsive",
    ]) {
      expect(ids).toContain(id);
    }
  });
});
