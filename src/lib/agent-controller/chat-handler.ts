// Chat handler — wraps runAgentController for the assistant-panel send loop.
//
// Guarantees:
//  - Homepage intent NEVER falls through to legacy ai.plan / ai.generate_changes.
//  - "Done" is only declared when filesTouched is non-empty AND verification.passed
//    AND no preview-mismatch tokens are present in the written index.html.
//  - Returns a structured outcome the caller renders into chat + side-effects.

import { classifyAgentIntent } from "./intent";
import { runAgentController, type RunInput } from "./run";
import { detectPreviewMismatch, type PreviewMismatchResult } from "./preview-mismatch";
import type { AgentProof } from "./types";

export type ChatHandlerOutcome =
  | { kind: "not_homepage"; intent: ReturnType<typeof classifyAgentIntent> }
  | { kind: "blocked"; proof: AgentProof; message: string }
  | {
      kind: "success";
      proof: AgentProof;
      filesTouched: string[];
      message: string;
      previewMismatch: PreviewMismatchResult;
    }
  | {
      kind: "preview_mismatch";
      proof: AgentProof;
      filesTouched: string[];
      message: string;
      previewMismatch: PreviewMismatchResult;
    }
  | { kind: "verification_failed"; proof: AgentProof; message: string }
  | { kind: "error"; message: string };

export interface DispatchDeps {
  runController?: typeof runAgentController;
  /** Called after a successful homepage write so the UI can refresh files + iframe. */
  onFilesWritten?: (input: { projectId: string; filesTouched: string[] }) => void;
}

export interface DispatchInput extends Pick<RunInput, "projectId" | "workspaceId" | "userRequest"> {
  deps?: DispatchDeps;
  inspector?: RunInput["inspector"];
  writer?: RunInput["writer"];
}

export async function dispatchAgentRequest(input: DispatchInput): Promise<ChatHandlerOutcome> {
  const intent = classifyAgentIntent({ userRequest: input.userRequest });
  if (intent.artifactType !== "homepage") {
    return { kind: "not_homepage", intent };
  }

  const run = input.deps?.runController ?? runAgentController;
  let proof: AgentProof;
  try {
    proof = await run({
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      userRequest: input.userRequest,
      inspector: input.inspector,
      writer: input.writer,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: "error", message };
  }

  if (proof.blockedByActiveJob) {
    return { kind: "blocked", proof, message: proof.decision.message };
  }

  if (
    proof.canDeclareDone &&
    proof.filesTouched.length > 0 &&
    proof.verification?.passed === true
  ) {
    const mismatch = detectPreviewMismatch({
      expectedArtifact: "homepage",
      html: proof.outputs?.indexHtml ?? null,
    });
    if (mismatch.previewMismatch) {
      // Force a single refresh so the user sees the up-to-date state, but do
      // NOT declare Done and do NOT enqueue another job.
      input.deps?.onFilesWritten?.({
        projectId: input.projectId,
        filesTouched: proof.filesTouched,
      });
      return {
        kind: "preview_mismatch",
        proof,
        filesTouched: proof.filesTouched,
        previewMismatch: mismatch,
        message: `Preview mismatch — stale dashboard still loaded (${mismatch.forbiddenTokensFound.join(", ")})`,
      };
    }
    input.deps?.onFilesWritten?.({
      projectId: input.projectId,
      filesTouched: proof.filesTouched,
    });
    return {
      kind: "success",
      proof,
      filesTouched: proof.filesTouched,
      previewMismatch: mismatch,
      message: `Homepage built — wrote ${proof.filesTouched.join(", ")}.`,
    };
  }

  const failed = proof.verification?.failedGates ?? ["unknown"];
  return {
    kind: "verification_failed",
    proof,
    message: `Homepage verification failed: ${failed.join(", ")}`,
  };
}

export function summarizeProof(proof: AgentProof, mismatch?: PreviewMismatchResult): string {
  const m = mismatch ?? {
    expectedArtifact: proof.intent.artifactType,
    previewMismatch: false,
    forbiddenTokensFound: [],
  };
  return [
    `controller: ${proof.controller}`,
    `intent: ${proof.intent.artifactType}`,
    `filesTouched: [${proof.filesTouched.map((f) => JSON.stringify(f)).join(", ")}]`,
    `verification.passed: ${proof.verification?.passed === true}`,
    `legacyEnqueue: false`,
    `agentic-loop-v1: false`,
    `forbiddenTokensFound: [${m.forbiddenTokensFound.map((t) => JSON.stringify(t)).join(", ")}]`,
    `previewMismatch: ${m.previewMismatch}`,
  ].join(" · ");
}
