import type { Project } from "@/services/projects";
import { upsertProjectFiles } from "@/services/project-files";
import { generateMonsterProject } from "@/services/monster-orchestrator";
import { findForbiddenDashboardTokens } from "@/lib/agent-controller/forbidden-dashboard-tokens";
import { scanProjectSecurity, type ProjectSecurityReport } from "@/lib/project-security-monitor";

export interface DirectBuildInput {
  project: Pick<Project, "id" | "name" | "description">;
  workspaceId: string;
  userRequest: string;
}

export type DirectBuildOutcome =
  | {
      kind: "success";
      controller: "direct-build-controller-v1";
      filesTouched: string[];
      forbiddenTokensFound: string[];
      security: ProjectSecurityReport;
      message: string;
    }
  | {
      kind: "failed";
      controller: "direct-build-controller-v1";
      filesTouched: string[];
      error: string;
    };

function visibleFilesOnly(files: ReturnType<typeof generateMonsterProject>["files"]) {
  return files
    .filter((file) => ["index.html", "styles.css", "app.js"].includes(file.path))
    .map((file) => ({
      path: file.path,
      content: file.content,
      language: file.language,
      kind: file.kind,
    }));
}

export async function runDirectBuildController(
  input: DirectBuildInput,
): Promise<DirectBuildOutcome> {
  const generation = generateMonsterProject({
    project: input.project,
    chatRequest: input.userRequest,
    production: false,
  });
  const files = visibleFilesOnly(generation.files);
  if (!files.some((file) => file.path === "index.html")) {
    return {
      kind: "failed",
      controller: "direct-build-controller-v1",
      filesTouched: [],
      error: "Generator produced no index.html.",
    };
  }

  const fullOutput = files.map((file) => file.content).join("\n");
  const forbiddenTokensFound = findForbiddenDashboardTokens(fullOutput);
  if (forbiddenTokensFound.length > 0) {
    return {
      kind: "failed",
      controller: "direct-build-controller-v1",
      filesTouched: [],
      error: `Generator output still contains forbidden dashboard tokens: ${forbiddenTokensFound.join(", ")}`,
    };
  }

  const security = scanProjectSecurity({
    projectId: input.project.id,
    files: files.map((file) => ({ path: file.path, content: file.content })),
  });
  const criticalFindings = security.findings.filter((finding) => finding.severity === "critical");
  if (criticalFindings.length > 0) {
    return {
      kind: "failed",
      controller: "direct-build-controller-v1",
      filesTouched: [],
      error: `Security scan blocked write: ${criticalFindings.map((f) => f.title).join(", ")}`,
    };
  }

  const persisted = await upsertProjectFiles(input.project.id, files);
  if (!persisted.ok) {
    return {
      kind: "failed",
      controller: "direct-build-controller-v1",
      filesTouched: persisted.written,
      error: persisted.error ?? "Failed to write project files.",
    };
  }

  return {
    kind: "success",
    controller: "direct-build-controller-v1",
    filesTouched: persisted.written,
    forbiddenTokensFound,
    security,
    message: `Built app preview — wrote ${persisted.written.join(", ")}.`,
  };
}

export function summarizeDirectBuild(outcome: DirectBuildOutcome): string {
  if (outcome.kind === "failed") {
    return [
      `controller: ${outcome.controller}`,
      `filesTouched: [${outcome.filesTouched.map((f) => JSON.stringify(f)).join(", ")}]`,
      `status: failed`,
      `error: ${outcome.error}`,
    ].join(" · ");
  }
  return [
    `controller: ${outcome.controller}`,
    `filesTouched: [${outcome.filesTouched.map((f) => JSON.stringify(f)).join(", ")}]`,
    `status: success`,
    `forbiddenTokensFound: [${outcome.forbiddenTokensFound.map((t) => JSON.stringify(t)).join(", ")}]`,
    `securityScore: ${outcome.security.score}`,
    `criticalSecurityFindings: ${outcome.security.findings.filter((f) => f.severity === "critical").length}`,
    `legacyEnqueue: false`,
  ].join(" · ");
}
