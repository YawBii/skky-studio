import { describe, expect, it, vi } from "vitest";
import { runDirectBuildController, summarizeDirectBuild } from "./direct-build-controller";

vi.mock("@/services/project-files", () => ({
  upsertProjectFiles: vi.fn(async (_projectId: string, files: Array<{ path: string }>) => ({
    ok: true,
    written: files.map((file) => file.path),
  })),
}));

describe("direct-build-controller-v1", () => {
  it("writes visible app files directly without legacy enqueue semantics", async () => {
    const outcome = await runDirectBuildController({
      project: {
        id: "p1",
        name: "Mo-Send",
        description: "Send money to mobile phones and bank accounts",
      },
      workspaceId: "w1",
      userRequest: "Build an app for sending money to mobile phones and bank transfer",
    });

    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;

    expect(outcome.controller).toBe("direct-build-controller-v1");
    expect(outcome.filesTouched).toContain("index.html");
    expect(outcome.filesTouched).toContain("styles.css");
    expect(outcome.forbiddenTokensFound).toEqual([]);
    expect(outcome.security.summary.critical).toBe(0);
    expect(summarizeDirectBuild(outcome)).toContain("legacyEnqueue: false");
  });
});
