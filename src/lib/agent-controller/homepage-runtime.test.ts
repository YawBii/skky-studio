// Snapshot/token tests for the deterministic homepage builder + E2E-ish
// runtime tests that exercise dispatchAgentRequest end-to-end (no jobs queue).

import { describe, it, expect, vi } from "vitest";
import { buildLawFirmHomepage } from "./homepage-builder";
import { dispatchAgentRequest } from "./chat-handler";
import { FORBIDDEN_DASHBOARD_TOKENS } from "./preview-mismatch";
import type { AgentState } from "./types";

function emptyState(over: Partial<AgentState> = {}): AgentState {
  return {
    project: { id: "p1", name: "Pillar", description: null },
    files: { indexHtml: null, stylesCss: null, appJs: null, raw: [] },
    latestJobs: [],
    activeJob: null,
    failedVisualQuality: null,
    currentArtifactType: "unknown",
    staleTemplateMarkers: [],
    blockers: [],
    ...over,
  };
}

describe("homepage snapshot — required sections", () => {
  const out = buildLawFirmHomepage({
    project: { id: "p1", name: "Pillar & Co.", description: null },
    domain: "law-firm",
  });

  it("contains nav, hero, practice, attorneys/team, pricing/process, contact", () => {
    const html = out.indexHtml.toLowerCase();
    expect(html).toMatch(/<nav|site-nav|navigation/);
    expect(html).toMatch(/hero/);
    expect(html).toMatch(/practice|services/);
    expect(html).toMatch(/attorneys|team|partners/);
    expect(html).toMatch(/pricing|process|how we work|workflow|retainer/);
    expect(html).toMatch(/contact|consultation/);
  });

  it("contains none of the forbidden dashboard tokens", () => {
    const fullOutput = `${out.indexHtml}\n${out.stylesCss}`;
    for (const t of FORBIDDEN_DASHBOARD_TOKENS) {
      expect(t.re.test(fullOutput), `token ${t.id} must NOT appear`).toBe(false);
    }
  });
});

describe("homepage runtime guard — dispatchAgentRequest E2E", () => {
  it("homepage prompt does NOT call enqueueJob (jobs module is never imported)", async () => {
    const writer = vi.fn(async () => ({ ok: true }));
    const out = await dispatchAgentRequest({
      projectId: "p1",
      workspaceId: "w1",
      userRequest: "Redesign homepage for law firm",
      inspector: async () => emptyState(),
      writer,
    });
    expect(out.kind).toBe("success");
    if (out.kind !== "success") throw new Error("expected success");
    // Static guarantee: chat-handler does not import or call enqueueJob.
    const fs = await import("node:fs");
    const handlerSrc = fs.readFileSync("src/lib/agent-controller/chat-handler.ts", "utf8");
    expect(handlerSrc).not.toMatch(/from\s+["'][^"']*\/services\/jobs/);
    expect(handlerSrc).not.toMatch(/\benqueueJob\s*\(/);
    // It must not import the agentic-loop server module.
    expect(handlerSrc).not.toMatch(/from\s+["'][^"']*agentic-loop/);
  });

  it("writes exactly index.html + styles.css and dispatches onFilesWritten refresh", async () => {
    const writer = vi.fn(async () => ({ ok: true }));
    const onFilesWritten = vi.fn();
    const out = await dispatchAgentRequest({
      projectId: "p1",
      workspaceId: "w1",
      userRequest: "Redesign homepage for law firm",
      inspector: async () => emptyState(),
      writer,
      deps: { onFilesWritten },
    });
    expect(out.kind).toBe("success");
    if (out.kind !== "success") throw new Error("expected success");
    expect(out.filesTouched).toEqual(["index.html", "styles.css"]);
    expect(out.filesTouched.length).toBeGreaterThan(0);
    expect(out.proof.verification?.passed).toBe(true);
    expect(out.previewMismatch.forbiddenTokensFound).toEqual([]);
    expect(onFilesWritten).toHaveBeenCalledWith({
      projectId: "p1",
      filesTouched: ["index.html", "styles.css"],
    });
    expect(out.previewMismatch.previewMismatch).toBe(false);
  });

  it("preview mismatch: refuses Done when builder output contains forbidden tokens", async () => {
    // Override the controller via runController dep to simulate a pathological
    // build that wrote files but they contain forbidden dashboard tokens.
    const onFilesWritten = vi.fn();
    const out = await dispatchAgentRequest({
      projectId: "p1",
      workspaceId: "w1",
      userRequest: "Redesign homepage for law firm",
      deps: {
        onFilesWritten,
        runController: async () => ({
          controller: "agent-controller-v1",
          intent: {
            artifactType: "homepage",
            confidence: 1,
            reason: "test",
            domain: "law-firm",
          },
          stateSummary: {
            artifactTypeBefore: "unknown",
            hasActiveJob: false,
            activeJobStatus: null,
            fileCount: 0,
            failedGates: [],
          },
          decision: { action: "build_homepage", message: "ok", reason: "test" },
          filesTouched: ["index.html", "styles.css"],
          verification: { passed: true, gate: "homepage", checks: [], failedGates: [] },
          repaired: false,
          canDeclareDone: true,
          blockedByActiveJob: false,
          outputs: {
            indexHtml: "<html><body><h1>LexOS</h1><p>Matter board</p></body></html>",
            stylesCss: "body{}",
          },
        }),
      },
    });
    expect(out.kind).toBe("preview_mismatch");
    if (out.kind !== "preview_mismatch") throw new Error("expected preview_mismatch");
    expect(out.previewMismatch.forbiddenTokensFound).toEqual(
      expect.arrayContaining(["LexOS", "Matter board"]),
    );
    // We refresh once but never declare Done.
    expect(onFilesWritten).toHaveBeenCalledOnce();
  });
});
