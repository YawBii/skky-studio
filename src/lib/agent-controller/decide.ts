// Decision engine — picks exactly one action given intent + state.

import type { AgentDecision, AgentIntent, AgentState } from "./types";

export interface DecideInput {
  intent: AgentIntent;
  state: AgentState;
}

const BLOCKED_MESSAGE =
  "Finish or cancel the current job before starting another.";

export function decideAgentAction({ intent, state }: DecideInput): AgentDecision {
  // Active job always wins — never enqueue or run a second action.
  if (state.activeJob) {
    return {
      action: "block_with_current_job",
      reason: `active job ${state.activeJob.id} status=${state.activeJob.status}`,
      message: BLOCKED_MESSAGE,
    };
  }

  if (intent.artifactType === "plan_only") {
    return {
      action: "answer_plan_only",
      reason: "plan_only intent",
      message: "Returning a plan instead of changing files.",
    };
  }

  // Failed preview that needs repair takes precedence over fresh builds —
  // unless the user is explicitly asking for a new homepage build, in which
  // case the homepage builder will replace the broken preview wholesale.
  if (state.failedVisualQuality && intent.artifactType !== "homepage") {
    return {
      action: "repair_failed_preview",
      reason: `visualQuality failed for ${state.failedVisualQuality.jobId}`,
      message: "Repairing the failed preview before anything else.",
      targetFiles: ["index.html", "styles.css"],
    };
  }

  if (intent.artifactType === "homepage") {
    // Artifact mismatch → replace the offending files rather than running
    // the old design-angle regenerate path.
    if (
      state.currentArtifactType !== "unknown" &&
      state.currentArtifactType !== "homepage"
    ) {
      return {
        action: "replace_target_file",
        reason: `current artifact ${state.currentArtifactType} != requested homepage`,
        message: "Replacing the current preview with a homepage.",
        targetFiles: ["index.html", "styles.css"],
      };
    }
    return {
      action: "build_homepage",
      reason: "homepage intent, no artifact mismatch",
      message: "Building homepage…",
      targetFiles: ["index.html", "styles.css"],
    };
  }

  return {
    action: "noop",
    reason: `no action for artifact ${intent.artifactType}`,
    message: "No controller-handled action for this request yet.",
  };
}

export const AGENT_BLOCKED_MESSAGE = BLOCKED_MESSAGE;
