import type { Project } from "@/services/projects";
import {
  runDirectBuildController,
  summarizeDirectBuild,
  type DirectBuildOutcome,
} from "@/lib/direct-build-controller";

export type DirectPreviewAction = "regenerate" | "repair";

export interface DirectPreviewActionInput {
  project: Project;
  action: DirectPreviewAction;
  designMode?: string | null;
  failedGates?: string[];
}

export interface DirectPreviewActionResult {
  outcome: DirectBuildOutcome;
  summary: string;
  title: string;
}

function promptForAction(input: DirectPreviewActionInput): string {
  const base = `${input.project.name} ${input.project.description ?? ""}`.trim();
  if (input.action === "repair") {
    return [
      `Repair the visible preview for ${input.project.name}.`,
      base,
      input.failedGates?.length ? `Fix failed gates: ${input.failedGates.join(", ")}.` : "",
      "Write safe visible project files directly. Do not queue a background generation job.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Regenerate the visible preview for ${input.project.name}.`,
    base,
    input.designMode ? `Design mode: ${input.designMode}.` : "",
    "Write safe visible project files directly. Do not queue ai.generate_changes.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runDirectPreviewAction(
  input: DirectPreviewActionInput,
): Promise<DirectPreviewActionResult> {
  const outcome = await runDirectBuildController({
    project: input.project,
    workspaceId: input.project.workspaceId,
    userRequest: promptForAction(input),
  });

  const title =
    input.action === "repair"
      ? outcome.kind === "success"
        ? "Preview repaired"
        : "Preview repair failed safely"
      : outcome.kind === "success"
        ? "Preview regenerated"
        : "Preview regenerate failed safely";

  return {
    outcome,
    title,
    summary: summarizeDirectBuild(outcome),
  };
}

export function dispatchDirectPreviewRefresh(projectId: string, filesTouched: string[]): void {
  window.dispatchEvent(
    new CustomEvent("yawb:project-files-refresh", {
      detail: { projectId, filesTouched },
    }),
  );
  window.dispatchEvent(new CustomEvent("yawb:switch-tab", { detail: { tab: "preview" } }));
  window.dispatchEvent(
    new CustomEvent("yawb:preview-force-reload", { detail: { projectId } }),
  );
}
