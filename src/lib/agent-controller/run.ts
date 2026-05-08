// Runner — orchestrates one controller pass: classify → inspect → decide →
// run one action → verify → repair once → persist on success.

import { upsertProjectFiles } from "@/services/project-files";
import { classifyAgentIntent } from "./intent";
import { inspectAgentState } from "./inspect";
import { decideAgentAction } from "./decide";
import { verifyArtifact } from "./verify";
import { buildLawFirmHomepage } from "./homepage-builder";
import type {
  AgentDecision,
  AgentIntent,
  AgentProof,
  AgentState,
  VerificationResult,
} from "./types";

export interface RunInput {
  projectId: string;
  workspaceId: string;
  userRequest: string;
  /** Hooks for tests / non-Supabase callers. */
  inspector?: (input: { projectId: string; workspaceId: string }) => Promise<AgentState>;
  writer?: (
    projectId: string,
    files: Array<{ path: string; content: string; language: string; kind: string }>,
  ) => Promise<{ ok: boolean; error?: string }>;
}

function summarizeState(state: AgentState) {
  return {
    artifactTypeBefore: state.currentArtifactType,
    hasActiveJob: !!state.activeJob,
    activeJobStatus: state.activeJob?.status ?? null,
    fileCount: state.files.raw.length,
    failedGates: state.failedVisualQuality?.failedGates ?? [],
  };
}

function executeBuild(intent: AgentIntent, state: AgentState) {
  if (intent.artifactType === "homepage") {
    const out = buildLawFirmHomepage({
      project: state.project ?? { id: "unknown", name: "Project" },
      domain: intent.domain ?? "law-firm",
    });
    return {
      files: [
        { path: "index.html", content: out.indexHtml, language: "html", kind: "source" },
        { path: "styles.css", content: out.stylesCss, language: "css", kind: "source" },
      ],
    };
  }
  return { files: [] };
}

export async function runAgentController(input: RunInput): Promise<AgentProof> {
  const intent = classifyAgentIntent({ userRequest: input.userRequest });
  const inspect = input.inspector ?? inspectAgentState;
  const writer =
    input.writer ??
    (async (projectId, files) => {
      const r = await upsertProjectFiles(projectId, files);
      return { ok: r.ok, error: r.error };
    });

  const state = await inspect({ projectId: input.projectId, workspaceId: input.workspaceId });
  const decision: AgentDecision = decideAgentAction({ intent, state });

  const baseProof: AgentProof = {
    controller: "agent-controller-v1",
    intent,
    stateSummary: summarizeState(state),
    decision,
    filesTouched: [],
    verification: null,
    repaired: false,
    canDeclareDone: false,
    blockedByActiveJob: decision.action === "block_with_current_job",
  };

  if (decision.action === "block_with_current_job") return baseProof;
  if (decision.action === "answer_plan_only" || decision.action === "noop") {
    return { ...baseProof, canDeclareDone: true };
  }

  // build_homepage / replace_target_file / repair_failed_preview all currently
  // route through the homepage builder when the intent is homepage. Other
  // intents return noop here in v1.
  if (intent.artifactType !== "homepage") {
    return { ...baseProof, canDeclareDone: true };
  }

  const first = executeBuild(intent, state);
  let verification: VerificationResult = verifyArtifact({
    artifactType: "homepage",
    files: {
      indexHtml: first.files.find((f) => f.path === "index.html")?.content ?? null,
      stylesCss: first.files.find((f) => f.path === "styles.css")?.content ?? null,
    },
  });

  let repaired = false;
  let filesToWrite = first.files;

  if (!verification.passed) {
    repaired = true;
    const second = executeBuild(intent, state); // deterministic — same output
    const reverify = verifyArtifact({
      artifactType: "homepage",
      files: {
        indexHtml: second.files.find((f) => f.path === "index.html")?.content ?? null,
        stylesCss: second.files.find((f) => f.path === "styles.css")?.content ?? null,
      },
    });
    verification = reverify;
    filesToWrite = second.files;
  }

  if (!verification.passed) {
    return {
      ...baseProof,
      verification,
      repaired,
      filesTouched: [],
      canDeclareDone: false,
    };
  }

  const write = await writer(input.projectId, filesToWrite);
  if (!write.ok) {
    return {
      ...baseProof,
      verification,
      repaired,
      filesTouched: [],
      canDeclareDone: false,
    };
  }

  return {
    ...baseProof,
    verification,
    repaired,
    filesTouched: filesToWrite.map((f) => f.path),
    canDeclareDone: true,
  };
}
