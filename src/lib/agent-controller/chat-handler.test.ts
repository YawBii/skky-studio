import { describe, it, expect, vi } from "vitest";
import { dispatchAgentRequest, summarizeProof } from "./chat-handler";
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

describe("dispatchAgentRequest — assistant chat homepage path", () => {
  it("classifies 'Redesign homepage for law firm' as homepage and writes index.html + styles.css", async () => {
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
    expect(out.proof.intent.artifactType).toBe("homepage");
    expect(out.proof.controller).toBe("agent-controller-v1");
    expect(out.proof.verification?.passed).toBe(true);
    expect(writer).toHaveBeenCalledOnce();
    const call = writer.mock.calls[0] as unknown as [string, Array<{ path: string }>];
    const writtenPaths = call[1].map((f) => f.path);
    expect(writtenPaths).toEqual(["index.html", "styles.css"]);
    expect(writtenPaths).not.toContain("app.js");
    expect(writtenPaths).not.toContain("README.md");
    expect(writtenPaths.some((p) => p.startsWith("src/routes/") || p.startsWith("docs/sql/"))).toBe(
      false,
    );
    expect(out.proof.controller).toBe("agent-controller-v1");
    expect(JSON.stringify(out.proof)).not.toContain("agentic-loop-v1");
    expect(onFilesWritten).toHaveBeenCalledWith({
      projectId: "p1",
      filesTouched: ["index.html", "styles.css"],
    });
  });

  it.each([
    "redesign homepage",
    "make this a law firm homepage",
    "build homepage",
    "make homepage polished",
  ])("handles '%s' without legacy ai.generate_changes fallback", async (userRequest) => {
    const writer = vi.fn(async () => ({ ok: true }));
    const out = await dispatchAgentRequest({
      projectId: "p1",
      workspaceId: "w1",
      userRequest,
      inspector: async () => emptyState(),
      writer,
    });
    expect(out.kind).toBe("success");
    if (out.kind !== "success") throw new Error("expected success");
    expect(out.proof.intent.artifactType).toBe("homepage");
    expect(out.proof.filesTouched).toEqual(["index.html", "styles.css"]);
    expect(out.proof.controller).toBe("agent-controller-v1");
  });

  it("returns not_homepage for non-homepage prompts so the caller may use the legacy path", async () => {
    const out = await dispatchAgentRequest({
      projectId: "p1",
      workspaceId: "w1",
      userRequest: "Add a payments table",
    });
    expect(out.kind).toBe("not_homepage");
  });

  it("never declares success when filesTouched is empty (writer fails)", async () => {
    const writer = vi.fn(async () => ({ ok: false, error: "db down" }));
    const onFilesWritten = vi.fn();
    const out = await dispatchAgentRequest({
      projectId: "p1",
      workspaceId: "w1",
      userRequest: "Redesign homepage for law firm",
      inspector: async () => emptyState(),
      writer,
      deps: { onFilesWritten },
    });
    expect(out.kind).toBe("verification_failed");
    if (out.kind !== "verification_failed") throw new Error("expected fail");
    expect(out.proof.filesTouched).toEqual([]);
    expect(out.proof.canDeclareDone).toBe(false);
    expect(onFilesWritten).not.toHaveBeenCalled();
  });

  it("blocks when an active job exists and does NOT write files", async () => {
    const writer = vi.fn(async () => ({ ok: true }));
    const out = await dispatchAgentRequest({
      projectId: "p1",
      workspaceId: "w1",
      userRequest: "Redesign homepage for law firm",
      inspector: async () =>
        emptyState({
          activeJob: {
            id: "j1",
            projectId: "p1",
            workspaceId: "w1",
            type: "ai.generate_changes",
            status: "running",
            title: "x",
            input: {},
            output: {},
            error: null,
            retryCount: 0,
            createdBy: "",
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
          },
        }),
      writer,
    });
    expect(out.kind).toBe("blocked");
    expect(writer).not.toHaveBeenCalled();
  });

  it("propagates errors from runController without falling through", async () => {
    const writer = vi.fn(async () => ({ ok: true }));
    const out = await dispatchAgentRequest({
      projectId: "p1",
      workspaceId: "w1",
      userRequest: "Redesign homepage for law firm",
      writer,
      deps: {
        runController: async () => {
          throw new Error("boom");
        },
      },
    });
    expect(out.kind).toBe("error");
    if (out.kind === "error") expect(out.message).toBe("boom");
    expect(writer).not.toHaveBeenCalled();
  });

  it("summarizeProof emits the required fields", async () => {
    const writer = vi.fn(async () => ({ ok: true }));
    const out = await dispatchAgentRequest({
      projectId: "p1",
      workspaceId: "w1",
      userRequest: "Redesign homepage for law firm",
      inspector: async () => emptyState(),
      writer,
    });
    if (out.kind !== "success") throw new Error("expected success");
    const s = summarizeProof(out.proof, out.previewMismatch);
    expect(s).toContain("controller: agent-controller-v1");
    expect(s).toContain("intent: homepage");
    expect(s).toContain('filesTouched: ["index.html", "styles.css"]');
    expect(s).toContain("verification.passed: true");
    expect(s).toContain("legacyEnqueue: false");
    expect(s).toContain("agentic-loop-v1: false");
    expect(s).toContain("forbiddenTokensFound: []");
    expect(s).toContain("previewMismatch: false");
  });
});
