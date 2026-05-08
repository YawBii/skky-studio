import { describe, it, expect } from "vitest";
import { verifyArtifact } from "./verify";
import { buildLawFirmHomepage } from "./homepage-builder";
import { FORBIDDEN_DASHBOARD_TOKENS } from "./preview-mismatch";

describe("verifyArtifact — homepage gate", () => {
  it("passes for 'Redesign homepage for law firm' deterministic homepage output", () => {
    const out = buildLawFirmHomepage({ project: { id: "p", name: "Pillar" } });
    const r = verifyArtifact({
      artifactType: "homepage",
      files: { indexHtml: out.indexHtml, stylesCss: out.stylesCss },
    });
    expect(r.passed).toBe(true);
    expect(r.failedGates).toEqual([]);
  });

  it("rejects homepage output containing forbidden dashboard/app-shell tokens in HTML or CSS", () => {
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{min-height:100vh}</style></head><body><nav>Home</nav><section class="hero"><a class="cta">Schedule</a></section><section>Practice Areas</section><section>Our Team</section><section>Pricing</section><section>Contact</section><h1>LexOS — Case cockpit</h1><div>Matter board</div><p>Active matters</p><p>RLS policies</p><p>Supabase locked</p><p>Client intake queue</p><p>Invoices dashboard</p><p>Roles & access</p></body></html>`;
    const css = `.admin-panel{display:block}.kpi-grid{display:grid}/* Schema / RLS */`;
    const r = verifyArtifact({
      artifactType: "homepage",
      files: { indexHtml: html, stylesCss: css },
    });
    expect(r.passed).toBe(false);
    expect(r.failedGates[0]).toBe(
      "Homepage contains forbidden dashboard tokens: Matter board, Case cockpit, Active matters, RLS policies, Supabase locked, Admin panel, KPI grid, LexOS, Client intake queue, Invoices dashboard, Roles & access, Schema / RLS",
    );
    expect(r.failedGates.join(", ")).not.toContain("No cockpit/matter board first-screen");
    expect(r.failedGates.join(", ")).not.toContain("No app-dashboard/admin shell");
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
    expect(r.failedGates).toEqual([]);
    expect(r.checks.map((c) => c.label)).not.toContain("No cockpit/matter board first-screen");
    expect(r.checks.map((c) => c.label)).not.toContain("No app-dashboard/admin shell");
  });

  it("generated homepage scans both indexHtml and stylesCss and contains no forbidden dashboard tokens", () => {
    const out = buildLawFirmHomepage({ project: { id: "p", name: "Pillar" } });
    const all = `${out.indexHtml}\n${out.stylesCss}`;
    for (const t of FORBIDDEN_DASHBOARD_TOKENS) {
      expect(t.re.test(all), `${t.id} must be absent from generated homepage output`).toBe(false);
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

  it("regression: clean homepage never reports observed bad cockpit/admin-shell failure labels", () => {
    const out = buildLawFirmHomepage({ project: { id: "p", name: "Pillar" } });
    const r = verifyArtifact({
      artifactType: "homepage",
      files: { indexHtml: out.indexHtml, stylesCss: out.stylesCss },
    });
    expect(r.passed).toBe(true);
    const failureText = r.failedGates.join("\n");
    expect(failureText).not.toContain("No cockpit/matter board first-screen");
    expect(failureText).not.toContain("No app-dashboard/admin shell");
  });

  it("dashboard verification can require cockpit/admin shell separately", () => {
    const r = verifyArtifact({
      artifactType: "app_dashboard",
      files: {
        indexHtml: `<!doctype html><html><body><nav>App</nav><main><h1>Case cockpit</h1><section class="matter-board"><div class="kpi-grid">Metrics</div></section><section>Admin panel <button>Action</button></section></main></body></html>`,
        stylesCss: null,
      },
    });
    expect(r.passed).toBe(true);
    expect(r.checks.map((c) => c.id)).toEqual(["nav", "cockpit", "data", "admin-shell"]);
  });
});
