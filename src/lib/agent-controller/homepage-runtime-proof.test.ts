// Runtime proof for the Agent Controller v1 homepage path.
//
// Playwright is NOT configured in this repo (no playwright.config.* and no
// @playwright/test dependency). This vitest suite is the runtime equivalent:
// it mounts the real builder chat path (dispatchAgentRequest → runAgentController
// → buildLawFirmHomepage → verifyArtifact → writer) against a project state
// that mimics an existing LexOS / dashboard preview, mocks the legacy jobs
// service so any enqueue would throw, and asserts the full proof contract.

import { describe, it, expect, vi } from "vitest";

// Hard guard: if any code path on the homepage branch tries to enqueue a
// legacy ai.plan / ai.generate_changes job, this mock throws and fails the
// test loudly.
vi.mock("@/services/jobs", () => ({
  JOB_TYPES: [],
  enqueueJob: vi.fn(async () => {
    throw new Error(
      "LEGACY_ENQUEUE_BLOCKED — homepage path must not enqueue ai.plan/ai.generate_changes",
    );
  }),
  retryJob: vi.fn(async () => {
    throw new Error("LEGACY_RETRY_BLOCKED");
  }),
}));

import { dispatchAgentRequest, summarizeProof } from "./chat-handler";
import { detectPreviewMismatch, FORBIDDEN_DASHBOARD_TOKENS } from "./preview-mismatch";
import type { AgentState } from "./types";

const STALE_DASHBOARD_HTML = `<!doctype html><html><head><title>LexOS</title></head><body>
  <header class="cockpit-shell"><h1>LexOS — Case cockpit</h1></header>
  <main>
    <section class="matter-board"><h2>Matter board</h2><p>Active matters: 12</p></section>
    <section class="kpi-grid"><div>KPI grid</div></section>
    <section class="admin-panel"><h3>Admin panel</h3></section>
    <section><p>RLS policies enforced — Supabase locked</p></section>
  </main>
</body></html>`;

function dashboardState(): AgentState {
  return {
    project: { id: "p-runtime", name: "Pillar & Co.", description: null },
    files: {
      indexHtml: STALE_DASHBOARD_HTML,
      stylesCss: "body{background:#000}",
      appJs: null,
      raw: [
        {
          id: "f1",
          projectId: "p-runtime",
          path: "index.html",
          content: STALE_DASHBOARD_HTML,
          language: "html",
          kind: "source",
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
    },
    latestJobs: [],
    activeJob: null,
    failedVisualQuality: null,
    currentArtifactType: "app_dashboard",
    staleTemplateMarkers: ["LexOS", "Matter board"],
    blockers: [],
  };
}

describe("Agent Controller v1 — homepage runtime proof (Playwright equivalent)", () => {
  it("replaces stale LexOS/dashboard preview with a clean law-firm homepage", async () => {
    const written: Array<{ path: string; content: string }> = [];
    const writer = vi.fn(
      async (_projectId: string, files: Array<{ path: string; content: string }>) => {
        written.push(...files.map((f) => ({ path: f.path, content: f.content })));
        return { ok: true };
      },
    );
    const refreshes: Array<{ projectId: string; filesTouched: string[] }> = [];

    const out = await dispatchAgentRequest({
      projectId: "p-runtime",
      workspaceId: "w-runtime",
      userRequest: "Redesign homepage for law firm",
      inspector: async () => dashboardState(),
      writer,
      deps: { onFilesWritten: (e) => refreshes.push(e) },
    });

    // 3. Controller outcome shape.
    expect(out.kind).toBe("success");
    if (out.kind !== "success") throw new Error("expected success");
    expect(out.proof.controller).toBe("agent-controller-v1");
    expect(out.proof.intent.artifactType).toBe("homepage");

    // 4. No legacy enqueue (jobs mock would have thrown if it had been called).
    const jobs = await import("@/services/jobs");
    expect(jobs.enqueueJob).not.toHaveBeenCalled();

    // 5. Exactly index.html + styles.css written.
    expect(out.filesTouched).toEqual(["index.html", "styles.css"]);
    expect(written.map((f) => f.path)).toEqual(["index.html", "styles.css"]);

    // 6. New preview contains none of the forbidden dashboard tokens.
    const newIndex = written.find((f) => f.path === "index.html")!.content;
    const newStyles = written.find((f) => f.path === "styles.css")!.content;
    const fullOutput = `${newIndex}\n${newStyles}`;
    for (const t of FORBIDDEN_DASHBOARD_TOKENS) {
      expect(t.re.test(fullOutput), `forbidden token ${t.id} must NOT appear`).toBe(false);
    }

    // 7. New preview contains all required homepage sections.
    const html = newIndex.toLowerCase();
    expect(html).toMatch(/<nav|site-nav/);
    expect(html).toMatch(/hero/);
    expect(html).toMatch(/practice areas|practice-areas/);
    expect(html).toMatch(/attorneys|team-grid/);
    expect(html).toMatch(/pricing|workflow-steps|how we work/);
    expect(html).toMatch(/contact|consultation|intake/);

    // 8. Mismatch guard: clean output → no warning.
    const mismatch = detectPreviewMismatch({
      expectedArtifact: "homepage",
      html: newIndex,
      css: newStyles,
    });
    expect(mismatch.previewMismatch).toBe(false);
    expect(mismatch.forbiddenTokensFound).toEqual([]);

    // Refresh fired exactly once so the iframe reloads from project_files.
    expect(refreshes).toEqual([
      { projectId: "p-runtime", filesTouched: ["index.html", "styles.css"] },
    ]);

    // Proof panel contents.
    const panel = {
      expectedArtifact: "homepage",
      actualForbiddenTokens: mismatch.forbiddenTokensFound,
      previewMismatch: mismatch.previewMismatch,
      filesTouched: out.filesTouched,
    };
    expect(panel).toEqual({
      expectedArtifact: "homepage",
      actualForbiddenTokens: [],
      previewMismatch: false,
      filesTouched: ["index.html", "styles.css"],
    });

    // Summary string includes all required runtime-proof fields.
    const s = summarizeProof(out.proof, out.previewMismatch);
    expect(s).toContain("controller: agent-controller-v1");
    expect(s).toContain("intent: homepage");
    expect(s).toContain("legacyEnqueue: false");
    expect(s).toContain("agentic-loop-v1: false");
    expect(s).toContain("previewMismatch: false");
  });

  it("if forbidden tokens remain after write, surfaces 'Preview mismatch — stale dashboard still loaded' and refuses Done", async () => {
    const out = await dispatchAgentRequest({
      projectId: "p-runtime",
      workspaceId: "w-runtime",
      userRequest: "Redesign homepage for law firm",
      deps: {
        runController: async () => ({
          controller: "agent-controller-v1",
          intent: { artifactType: "homepage", confidence: 1, reason: "t", domain: "law-firm" },
          stateSummary: {
            artifactTypeBefore: "app_dashboard",
            hasActiveJob: false,
            activeJobStatus: null,
            fileCount: 1,
            failedGates: [],
          },
          decision: { action: "build_homepage", message: "ok", reason: "t" },
          filesTouched: ["index.html", "styles.css"],
          verification: { passed: true, gate: "homepage", checks: [], failedGates: [] },
          repaired: false,
          canDeclareDone: true,
          blockedByActiveJob: false,
          outputs: { indexHtml: STALE_DASHBOARD_HTML, stylesCss: "body{}" },
        }),
      },
    });

    expect(out.kind).toBe("preview_mismatch");
    if (out.kind !== "preview_mismatch") throw new Error("expected preview_mismatch");
    expect(out.message).toContain("Preview mismatch — stale dashboard still loaded");
    expect(out.previewMismatch.forbiddenTokensFound).toEqual(
      expect.arrayContaining(["LexOS", "Matter board", "Case cockpit", "Active matters"]),
    );
    // canDeclareDone on the proof was true, but the chat outcome is NOT success.
    expect(out.proof.canDeclareDone).toBe(true);
  });
});
