// Chat handler — wraps runAgentController for the assistant-panel send loop.
//
// Guarantees:
//  - Homepage intent NEVER falls through to legacy ai.plan / ai.generate_changes.
//  - "Done" is only declared when filesTouched is non-empty AND verification.passed.
//  - Returns a structured outcome the caller renders into chat + side-effects.

import { classifyAgentIntent } from "./intent";
import { runAgentController, type RunInput } from "./run";
import type { AgentProof } from "./types";

export type ChatHandlerOutcome =
  | { kind: "not_homepage"; intent: ReturnType<typeof classifyAgentIntent> }
  | { kind: "blocked"; proof: AgentProof; message: string }
  | { kind: "success"; proof: AgentProof; filesTouched: string[]; message: string }
  | { kind: "verification_failed"; proof: AgentProof; message: string }
  | { kind: "error"; message: string };

export interface DispatchDeps {
  runController?: typeof runAgentController;
  /** Called after a successful homepage write so the UI can refresh files + iframe. */
  onFilesWritten?: (input: { projectId: string; filesTouched: string[] }) => void;
}

export interface DispatchInput extends Pick<RunInput, "projectId" | "workspaceId" | "userRequest"> {
  deps?: DispatchDeps;
  /** Optional inspector/writer overrides forwarded to runAgentController (tests). */
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

  // Done requires BOTH a passing verification AND a non-empty filesTouched.
  if (
    proof.canDeclareDone &&
    proof.filesTouched.length > 0 &&
    proof.verification?.passed === true
  ) {
    input.deps?.onFilesWritten?.({
      projectId: input.projectId,
      filesTouched: proof.filesTouched,
    });
    return {
      kind: "success",
      proof,
      filesTouched: proof.filesTouched,
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

export function summarizeProof(proof: AgentProof): string {
  return [
    `controller: ${proof.controller}`,
    `intent: ${proof.intent.artifactType}`,
    `filesTouched: [${proof.filesTouched.map((f) => JSON.stringify(f)).join(", ")}]`,
    `verification.passed: ${proof.verification?.passed === true}`,
  ].join(" · ");
}
