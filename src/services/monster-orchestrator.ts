import type { Project } from "@/services/projects";
import { generateProjectFiles as generateMonsterFrontendFiles, type DesignMode } from "./monster-brain-generator";
import { createMonsterBlueprint } from "./monster-director";
import { generateMonsterBackendFiles, type MonsterBackendGenerationResult } from "./monster-backend-generator";
import { createMonsterProofReport, type MonsterProofReport, type MonsterQualityGate } from "./monster-quality-gates";
import { summarizeMonsterBlueprint, type MonsterBlueprint } from "./monster-blueprint";

export interface MonsterOrchestratorInput {
  project: Pick<Project, "id" | "name"> & { description?: string | null };
  chatRequest?: string | null;
  connectedProviders?: string[] | null;
  requestedDesignMode?: DesignMode | null;
  previousIndexHtml?: string | null;
  regenerationSeed?: string | null;
  forceVariant?: boolean;
  production?: boolean;
}

export interface MonsterGeneratedFile {
  path: string;
  content: string;
  language: string;
  kind: "source" | "asset";
}

export interface MonsterGenerationResult {
  generator: "monster-orchestrator-v1";
  blueprint: MonsterBlueprint;
  frontendFiles: MonsterGeneratedFile[];
  backend: MonsterBackendGenerationResult;
  files: MonsterGeneratedFile[];
  proof: MonsterProofReport;
  output: {
    blueprintSummary: string;
    designMode: string;
    appType: string;
    frontendFileCount: number;
    backendFileCount: number;
    tableCount: number;
    policyCount: number;
    previewReady: boolean;
    canDeclareDone: boolean;
  };
}

function passed(id: string, label: string, proof: string): MonsterQualityGate {
  return { id, label, required: true, status: "passed", proof };
}

function pending(id: string, label: string, command?: string, required = true): MonsterQualityGate {
  return { id, label, command, required, status: "pending" };
}

export function generateMonsterProject(input: MonsterOrchestratorInput): MonsterGenerationResult {
  const blueprint = createMonsterBlueprint({
    project: input.project,
    chatRequest: input.chatRequest,
    connectedProviders: input.connectedProviders,
    requestedDesignMode: input.requestedDesignMode,
    production: input.production,
  });

  const frontendFiles = generateMonsterFrontendFiles(input.project, {
    chatRequest: input.chatRequest,
    connectedProviders: input.connectedProviders,
    previousIndexHtml: input.previousIndexHtml,
    regenerationSeed: input.regenerationSeed,
    forceVariant: input.forceVariant,
    designMode: blueprint.design.mode,
  });

  const backend = generateMonsterBackendFiles(blueprint);
  const files: MonsterGeneratedFile[] = [...frontendFiles, ...backend.files];
  const previewReady = files.some((file) => file.path === "index.html");
  const blueprintSummary = summarizeMonsterBlueprint(blueprint);

  const proof = createMonsterProofReport({
    projectId: input.project.id,
    blueprintSummary,
    gates: [
      passed("blueprint", "Monster Blueprint produced", blueprintSummary),
      passed("design", "Beautiful first design generated", `${blueprint.design.mode}: ${blueprint.design.reason}`),
      passed("backend", "Backend/schema/RLS plan generated", `${backend.tableCount} tables, ${backend.policyCount} RLS policy drafts`),
      pending("typecheck", "TypeScript check", "npm run typecheck"),
      pending("lint", "Lint", "npm run lint"),
      pending("build", "Production build", "npm run build"),
      pending("test", "Tests", "npm run test", false),
    ],
  });

  return {
    generator: "monster-orchestrator-v1",
    blueprint,
    frontendFiles,
    backend,
    files,
    proof,
    output: {
      blueprintSummary,
      designMode: blueprint.design.mode,
      appType: blueprint.appType,
      frontendFileCount: frontendFiles.length,
      backendFileCount: backend.files.length,
      tableCount: backend.tableCount,
      policyCount: backend.policyCount,
      previewReady,
      canDeclareDone: proof.canDeclareDone,
    },
  };
}
