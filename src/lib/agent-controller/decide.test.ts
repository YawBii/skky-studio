import { describe, it, expect } from "vitest";
import { decideAgentAction, AGENT_BLOCKED_MESSAGE } from "./decide";
import type { AgentState, AgentIntent } from "./types";
import type { Job } from "@/services/jobs";

const baseState: AgentState = {
  project: { id: "p1", name: "P", description: null },
  files: { indexHtml: null, stylesCss: null, appJs: null, raw: [] },
  latestJobs: [],
  activeJob: null,
  failedVisualQuality: null,
  currentArtifactType: "unknown",
  staleTemplateMarkers: [],
  blockers: [],
};

const homepage: AgentIntent = {
  artifactType: "homepage",
  confidence: 0.9,
  reason: "test",
  domain: "law-firm",
};

const dashboardIntent: AgentIntent = {
  artifactType: "app_dashboard",
  confidence: 0.9,
  reason: "test",
};

function fakeJob(status: Job["status"]): Job {
  return {
    id: "j1",
    projectId: "p1",
    workspaceId: "w1",
    type: "ai.generate_changes",
    status,
    title: "x",
    input: {},
    output: {},
    error: null,
    retryCount: 0,
    createdBy: "",
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
  } as Job;
}

describe("decideAgentAction", () => {
  it("blocks when an active job is queued/running/awaiting_answer", () => {
    for (const status of ["queued", "running", "waiting_for_input"] as const) {
      const r = decideAgentAction({
        intent: homepage,
        state: { ...baseState, activeJob: fakeJob(status) },
      });
      expect(r.action).toBe("block_with_current_job");
      expect(r.message).toBe(AGENT_BLOCKED_MESSAGE);
    }
  });

  it("homepage intent never selects regenerate template / never editorial-luxury", () => {
    const r = decideAgentAction({ intent: homepage, state: baseState });
    expect(r.action).toBe("build_homepage");
    expect(r.reason.toLowerCase()).not.toMatch(/editorial|luxury|regenerate/);
  });

  it("artifact mismatch (current dashboard vs requested homepage) chooses replace_target_file", () => {
    const r = decideAgentAction({
      intent: homepage,
      state: { ...baseState, currentArtifactType: "app_dashboard" },
    });
    expect(r.action).toBe("replace_target_file");
    expect(r.targetFiles).toEqual(["index.html", "styles.css"]);
  });

  it("failed visualQuality on non-homepage intent triggers repair", () => {
    const r = decideAgentAction({
      intent: dashboardIntent,
      state: {
        ...baseState,
        failedVisualQuality: { jobId: "f1", failedGates: ["x"], error: null },
      },
    });
    expect(r.action).toBe("repair_failed_preview");
  });

  it("plan_only intent answers without changing files", () => {
    const r = decideAgentAction({
      intent: { artifactType: "plan_only", confidence: 0.9, reason: "" },
      state: baseState,
    });
    expect(r.action).toBe("answer_plan_only");
  });
});
