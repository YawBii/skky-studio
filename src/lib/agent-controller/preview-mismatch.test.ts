import { describe, it, expect } from "vitest";
import { detectPreviewMismatch, FORBIDDEN_DASHBOARD_TOKENS } from "./preview-mismatch";

describe("detectPreviewMismatch", () => {
  it("returns no mismatch for a clean homepage HTML", () => {
    const r = detectPreviewMismatch({
      expectedArtifact: "homepage",
      html: "<html><body><nav></nav><section class='hero'>Counsel</section></body></html>",
    });
    expect(r.previewMismatch).toBe(false);
    expect(r.forbiddenTokensFound).toEqual([]);
  });

  it.each([
    "Matter board",
    "Case cockpit",
    "Active matters",
    "RLS policies",
    "Supabase locked",
    "Admin panel",
    "KPI grid",
    "LexOS",
  ])("flags forbidden token: %s", (token) => {
    const r = detectPreviewMismatch({
      expectedArtifact: "homepage",
      html: `<html><body><h1>${token}</h1></body></html>`,
    });
    expect(r.previewMismatch).toBe(true);
    expect(r.forbiddenTokensFound.length).toBeGreaterThan(0);
  });

  it("returns no mismatch when expectedArtifact is not homepage", () => {
    const r = detectPreviewMismatch({
      expectedArtifact: "app_dashboard",
      html: "<h1>Matter board</h1>",
    });
    expect(r.previewMismatch).toBe(false);
  });

  it("exports the canonical forbidden token list", () => {
    const ids = FORBIDDEN_DASHBOARD_TOKENS.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "Matter board",
        "Case cockpit",
        "Active matters",
        "RLS policies",
        "Supabase locked",
        "Admin panel",
        "KPI grid",
        "LexOS",
      ]),
    );
  });
});
