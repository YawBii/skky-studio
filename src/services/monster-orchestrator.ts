import type { Project } from "@/services/projects";
import type { DesignMode } from "./monster-brain-generator";
import { createMonsterBlueprint } from "./monster-director";
import {
  generateMonsterBackendFiles,
  type MonsterBackendGenerationResult,
} from "./monster-backend-generator";
import {
  createMonsterProofReport,
  type MonsterProofReport,
  type MonsterQualityGate,
} from "./monster-quality-gates";
import {
  generateMonsterArchitectFiles,
  type MonsterArchitectResult,
} from "./monster-project-architect";
import { generateMonsterCustomPreviewFiles } from "./monster-custom-preview-generator";
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
  architect: MonsterArchitectResult;
  files: MonsterGeneratedFile[];
  proof: MonsterProofReport;
  output: {
    blueprintSummary: string;
    designMode: string;
    appType: string;
    previewGenerator: string;
    generator: "monster-orchestrator-v1";
    frontendFileCount: number;
    backendFileCount: number;
    architectFileCount: number;
    fileCount: number;
    tableCount: number;
    policyCount: number;
    previewReady: boolean;
    canDeclareDone: boolean;
    written: string[];
    filesTouched: string[];
    changedFiles: string[];
    fileList: string[];
    previewProof: {
      generator: string;
      expectedMeta: string;
      indexPath: "index.html";
    };
    designCritique: string[];
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

  const frontendFiles = generateMonsterCustomPreviewFiles(blueprint);
  const backend = generateMonsterBackendFiles(blueprint);
  const architect = generateMonsterArchitectFiles(blueprint);
  const files: MonsterGeneratedFile[] = [...frontendFiles, ...backend.files, ...architect.files];
  const written = files.map((file) => file.path).sort();
  const previewReady = files.some((file) => file.path === "index.html");
  const blueprintSummary = summarizeMonsterBlueprint(blueprint);
  const designCritique = [
    "Visible preview now uses blueprint/app-type layout instead of the old design-mode template shell.",
    ...architect.designCritique,
  ];

  const proof = createMonsterProofReport({
    projectId: input.project.id,
    blueprintSummary,
    gates: [
      passed("blueprint", "Monster Blueprint produced", blueprintSummary),
      passed(
        "design",
        "Custom blueprint-driven preview generated",
        `${blueprint.design.mode}: custom preview from ${blueprint.appType}`,
      ),
      passed(
        "architect",
        "Project architecture files generated",
        `${architect.files.length} route/component/lib/style/doc files`,
      ),
      passed(
        "backend",
        "Backend/schema/RLS plan generated",
        `${backend.tableCount} tables, ${backend.policyCount} RLS policy drafts`,
      ),
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
    architect,
    files,
    proof,
    output: {
      blueprintSummary,
      designMode: blueprint.design.mode,
      appType: blueprint.appType,
      previewGenerator: "monster-custom-preview-v1",
      generator: "monster-orchestrator-v1",
      frontendFileCount: frontendFiles.length,
      backendFileCount: backend.files.length,
      architectFileCount: architect.files.length,
      fileCount: files.length,
      tableCount: backend.tableCount,
      policyCount: backend.policyCount,
      previewReady,
      canDeclareDone: proof.canDeclareDone,
      written,
      filesTouched: written,
      changedFiles: written,
      fileList: written,
      previewProof: {
        generator: "monster-custom-preview-v1",
        expectedMeta: '<meta name="yawb-generator" content="monster-custom-preview-v1" />',
        indexPath: "index.html",
      },
      designCritique,
    },
  };
}
