import { describe, expect, it, vi } from "vitest";
import { buildLawFirmHomepage } from "./homepage-builder";
import { verifyArtifact } from "./verify";
import { runAgentController } from "./run";
import type { AgentState } from "./types";

const DIRTY_DESCRIPTION =
  "Build a premium AI law firm app with auth, client intake, case cockpit, invoices, payments, admin panel, and Supabase backend.";

const FORBIDDEN = [
  /case cockpit/i,
  /admin panel/i,
  /\badmin\b/i,
  /\bsupabase\b/i,
  /\brls\b/i,
  /matter board/i,
  /active matters/i,
  /\blex\s*os\b/i,
];

describe("buildLawFirmHomepage with dirty project.description", () => {
  it("does not include forbidden dashboard tokens", () => {
    const { indexHtml, stylesCss } = buildLawFirmHomepage({
      project: { id: "p1", name: "Pillar Law", description: DIRTY_DESCRIPTION },
    });
    const combined = `${indexHtml}\n${stylesCss}`;
    for (const re of FORBIDDEN) expect(combined).not.toMatch(re);
  });

  it("verifyArtifact passes for built homepage", async () => {
    const { indexHtml, stylesCss } = buildLawFirmHomepage({
      project: { id: "p1", name: "Pillar Law", description: DIRTY_DESCRIPTION },
    });
    const result = await verifyArtifact({
      artifactType: "homepage",
      files: { indexHtml, stylesCss, appJs: null, raw: [] },
    });
    expect(result.passed).toBe(true);
  });

  it("runAgentController writes exactly index.html and styles.css with stale state", async () => {
    const state: AgentState = {
      project: { id: "p1", name: "Pillar Law", description: DIRTY_DESCRIPTION },
      files: {
        indexHtml: "<html><body>Case cockpit Admin panel Supabase</body></html>",
        stylesCss: ".admin-panel{}",
        appJs: null,
        raw: [],
      },
      latestJobs: [],
      activeJob: null,
      failedVisualQuality: null,
      currentArtifactType: "app_dashboard",
      staleTemplateMarkers: ["Case cockpit"],
      blockers: [],
    };
    const writer = vi.fn(async () => ({ ok: true as const }));
    const proof = await runAgentController({
      projectId: "p1",
      workspaceId: "w1",
      userRequest: "redesign this dashboard to fit a homepage for law firm",
      inspector: async () => state,
      writer,
    });
    expect(proof.verification?.passed).toBe(true);
    expect(proof.filesTouched).toEqual(["index.html", "styles.css"]);
  });
});
