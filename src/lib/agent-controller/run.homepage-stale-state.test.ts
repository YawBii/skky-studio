import { describe, expect, it, vi } from "vitest";
import { runAgentController } from "./run";
import type { AgentState } from "./types";

const STALE_DASHBOARD_HTML = `
  <html>
    <body>
      <h1>Case cockpit</h1>
      <section>Admin panel</section>
      <section>Matter board</section>
      <section>Active matters</section>
    </body>
  </html>
`;

function staleDashboardState(): AgentState {
  return {
    project: { id: "p1", name: "Pillar Law", description: null },
    files: {
      indexHtml: STALE_DASHBOARD_HTML,
      stylesCss: ".admin-panel{display:block}",
      appJs: null,
      raw: [],
    },
    latestJobs: [],
    activeJob: null,
    failedVisualQuality: null,
    currentArtifactType: "app_dashboard",
    staleTemplateMarkers: ["Case cockpit", "Admin panel"],
    blockers: [],
  };
}

describe("runAgentController homepage stale-state regression", () => {
  it("verifies freshly built homepage files, not stale dashboard state files", async () => {
    const writer = vi.fn(
      async (
        _projectId: string,
        _files: Array<{ path: string; content: string; language: string; kind: "source" | "asset" }>,
      ) => ({ ok: true }),
    );
    const proof = await runAgentController({
      projectId: "p1",
      workspaceId: "w1",
      userRequest: "Redesign homepage for law firm",
      inspector: async () => staleDashboardState(),
      writer,
    });

    expect(proof.controller).toBe("agent-controller-v1");
    expect(proof.intent.artifactType).toBe("homepage");
    expect(proof.canDeclareDone).toBe(true);
    expect(proof.verification?.passed).toBe(true);
    expect(proof.filesTouched).toEqual(["index.html", "styles.css"]);

    const writtenFiles = writer.mock.calls[0]?.[1] ?? [];
    expect(writtenFiles.map((file) => file.path)).toEqual(["index.html", "styles.css"]);

    const builtOutput = `${proof.outputs?.indexHtml ?? ""}\n${proof.outputs?.stylesCss ?? ""}`;
    expect(builtOutput).not.toMatch(/Case cockpit/i);
    expect(builtOutput).not.toMatch(/Admin panel/i);
    expect(builtOutput).not.toMatch(/Matter board/i);
    expect(builtOutput).not.toMatch(/Active matters/i);
    expect(builtOutput).toMatch(/Practice Areas/i);
    expect(builtOutput).toMatch(/Attorneys/i);
    expect(builtOutput).toMatch(/Pricing/i);
    expect(builtOutput).toMatch(/Contact/i);
  });
});
