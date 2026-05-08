// Runner — orchestrates one controller pass: classify → inspect → decide →
// run one action → verify → repair once → persist on success.

import { upsertProjectFiles } from "@/services/project-files";
import { classifyAgentIntent } from "./intent";
import { inspectAgentState } from "./inspect";
import { decideAgentAction } from "./decide";
import { verifyArtifact } from "./verify";
import { buildLawFirmHomepage } from "./homepage-builder";
import type { AgentDecision, AgentProof, AgentState } from "./types";

export interface RunInput {
  projectId: string;
  workspaceId: string;
  userRequest: string;
  /** Hooks for tests / non-Supabase callers. */
  inspector?: (input: { projectId: string; workspaceId: string }) => Promise<AgentState>;
  writer?: (
    projectId: string,
    files: Array<{ path: string; content: string; language: string; kind: "source" | "asset" }>,
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

interface BuildResultFile {
  path: string;
  content: string;
  language: string;
  kind: "source" | "asset";
}

function buildHomepageFiles(state: AgentState): BuildResultFile[] {
  const output = buildLawFirmHomepage({
    project: state.project ?? { id: "unknown", name: "Project", description: null },
    domain: "law-firm",
  });
  return [
    { path: "index.html", content: output.indexHtml, language: "html", kind: "source" },
    { path: "styles.css", content: output.stylesCss, language: "css", kind: "source" },
  ];
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

  const filesToWrite = buildHomepageFiles(state);
  const builtIndexHtml = filesToWrite.find((file) => file.path === "index.html")?.content ?? null;
  const builtStylesCss = filesToWrite.find((file) => file.path === "styles.css")?.content ?? null;
  const verification = verifyArtifact({
    artifactType: "homepage",
    files: {
      indexHtml: builtIndexHtml,
      stylesCss: builtStylesCss,
    },
  });
  console.info("[yawb] agent.controller.homepage.verify", {
    controller: "agent-controller-v1",
    intent: "homepage",
    verificationSource: "built-files",
    verificationPassed: verification.passed,
    failedGates: verification.failedGates,
    builtIndexPreview: (builtIndexHtml ?? "").slice(0, 300),
  });

  if (!verification.passed) {
    return {
      ...baseProof,
      verification,
      repaired: false,
      filesTouched: [],
      canDeclareDone: false,
      outputs: { indexHtml: builtIndexHtml, stylesCss: builtStylesCss },
    };
  }

  const write = await writer(input.projectId, filesToWrite);
  if (!write.ok) {
    return {
      ...baseProof,
      verification,
      repaired: false,
      filesTouched: [],
      canDeclareDone: false,
      outputs: { indexHtml: builtIndexHtml, stylesCss: builtStylesCss },
    };
  }

  return {
    ...baseProof,
    verification,
    repaired: false,
    filesTouched: ["index.html", "styles.css"],
    canDeclareDone: true,
    outputs: { indexHtml: builtIndexHtml, stylesCss: builtStylesCss },
  };
}
