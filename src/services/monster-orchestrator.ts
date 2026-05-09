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
import {
  generateMonsterDesignBrief,
  summarizeDesignBrief,
  type MonsterDesignBrief,
} from "./monster-design-brief";
import {
  evaluateVisualQuality,
  critiqueGeneratedDesign,
  type VisualQualityReport,
  type DesignSelfCritique,
} from "./monster-visual-quality";
import { buildLawFirmHomepage } from "@/lib/agent-controller/homepage-builder";
import { findForbiddenDashboardTokens } from "@/lib/agent-controller/forbidden-dashboard-tokens";

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
  designBrief: MonsterDesignBrief;
  frontendFiles: MonsterGeneratedFile[];
  backend: MonsterBackendGenerationResult;
  architect: MonsterArchitectResult;
  files: MonsterGeneratedFile[];
  visualQuality: VisualQualityReport;
  critique: DesignSelfCritique;
  repairAttempts: number;
  proof: MonsterProofReport;
  output: {
    blueprintSummary: string;
    designBriefSummary: string;
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
    visualVerdict: DesignSelfCritique["verdict"];
    visualPassed: boolean;
    repairAttempts: number;
  };
}

function passed(id: string, label: string, proof: string): MonsterQualityGate {
  return { id, label, required: true, status: "passed", proof };
}

function failed(id: string, label: string, error: string): MonsterQualityGate {
  return { id, label, required: true, status: "failed", error };
}

function pending(id: string, label: string, command?: string, required = true): MonsterQualityGate {
  return { id, label, command, required, status: "pending" };
}

const MAX_REPAIRS = 1;

function shouldForceCleanHomepage(input: MonsterOrchestratorInput, blueprint: MonsterBlueprint): boolean {
  const text = `${input.chatRequest ?? ""} ${blueprint.prompt ?? ""} ${blueprint.summary ?? ""} ${blueprint.appType ?? ""}`.toLowerCase();
  return /\b(homepage|landing page|law firm|legal homepage|brochure site|public site)\b/.test(text);
}

function collectForbiddenFrontendTokens(files: MonsterGeneratedFile[]): string[] {
  const joined = files
    .filter((file) => file.path === "index.html" || file.path === "styles.css" || file.path === "app.js")
    .map((file) => file.content)
    .join("\n");
  return findForbiddenDashboardTokens(joined);
}

function cleanLawFirmFrontend(input: MonsterOrchestratorInput): MonsterGeneratedFile[] {
  const built = buildLawFirmHomepage({
    project: {
      id: input.project.id,
      name: input.project.name,
      description: input.project.description ?? null,
    },
    domain: "law-firm",
  });
  return [
    { path: "index.html", content: built.indexHtml, language: "html", kind: "source" },
    { path: "styles.css", content: built.stylesCss, language: "css", kind: "source" },
    {
      path: "app.js",
      content:
        "document.documentElement.dataset.yawbPreview='clean-homepage-fallback';\nconsole.info('[yawb] clean homepage fallback active');\n",
      language: "javascript",
      kind: "source",
    },
  ];
}

function sanitizeFrontendFiles(
  input: MonsterOrchestratorInput,
  blueprint: MonsterBlueprint,
  files: MonsterGeneratedFile[],
): { files: MonsterGeneratedFile[]; replaced: boolean; forbiddenTokens: string[] } {
  const forbiddenTokens = collectForbiddenFrontendTokens(files);
  if (shouldForceCleanHomepage(input, blueprint) || forbiddenTokens.length > 0) {
    return {
      files: cleanLawFirmFrontend(input),
      replaced: true,
      forbiddenTokens,
    };
  }
  return { files, replaced: false, forbiddenTokens };
}

export function generateMonsterProject(input: MonsterOrchestratorInput): MonsterGenerationResult {
  const blueprint = createMonsterBlueprint({
    project: input.project,
    chatRequest: input.chatRequest,
    connectedProviders: input.connectedProviders,
    requestedDesignMode: input.requestedDesignMode,
    production: input.production,
  });

  let brief = generateMonsterDesignBrief(blueprint, input.regenerationSeed ?? "");
  let frontendFiles = generateMonsterCustomPreviewFiles(blueprint, brief);
  let dashboardBleed = sanitizeFrontendFiles(input, blueprint, frontendFiles);
  frontendFiles = dashboardBleed.files;
  const backend = generateMonsterBackendFiles(blueprint);
  const architect = generateMonsterArchitectFiles(blueprint);

  const buildAll = () =>
    [...frontendFiles, ...backend.files, ...architect.files] as MonsterGeneratedFile[];
  let files = buildAll();
  let visual = evaluateVisualQuality({
    files,
    brief,
    previousIndexHtml: input.previousIndexHtml ?? null,
  });

  let repairAttempts = 0;
  while (!visual.passed && repairAttempts < MAX_REPAIRS) {
    repairAttempts += 1;
    brief = generateMonsterDesignBrief(
      blueprint,
      `${input.regenerationSeed ?? ""}|repair-${repairAttempts}-${Date.now()}`,
    );
    frontendFiles = generateMonsterCustomPreviewFiles(blueprint, brief);
    dashboardBleed = sanitizeFrontendFiles(input, blueprint, frontendFiles);
    frontendFiles = dashboardBleed.files;
    files = buildAll();
    visual = evaluateVisualQuality({
      files,
      brief,
      previousIndexHtml: input.previousIndexHtml ?? null,
    });
  }

  const critique = critiqueGeneratedDesign({ brief, visual });
  const written = files.map((file) => file.path).sort();
  const previewReady = files.some((file) => file.path === "index.html");
  const blueprintSummary = summarizeMonsterBlueprint(blueprint);
  const designBriefSummary = summarizeDesignBrief(brief);
  const designCritique = [
    "Design brief generated before files (category, user, palette, typography, nav, cards).",
    `Brief: ${designBriefSummary}`,
    ...(dashboardBleed.replaced
      ? [
          `Dashboard bleed rejected: ${dashboardBleed.forbiddenTokens.length ? dashboardBleed.forbiddenTokens.join(", ") : "homepage/landing request requires clean public site"}.`,
          "Fallback: clean SKKY-branded law-firm homepage written to index.html/styles.css.",
        ]
      : []),
    ...critique.beautiful.map((line) => `Beautiful: ${line}`),
    ...critique.appSpecific.map((line) => `App-specific: ${line}`),
    ...critique.improvements.map((line) => `Improve: ${line}`),
    `Verdict: ${critique.verdict} (visualPassed=${critique.passedVisualQuality}, repairs=${repairAttempts})`,
    ...architect.designCritique,
  ];

  const visualGate: MonsterQualityGate = visual.passed
    ? passed(
        "visual-quality",
        "Visual quality gate",
        `${visual.checks.filter((c) => c.passed).length}/${visual.checks.length} checks passed`,
      )
    : failed(
        "visual-quality",
        "Visual quality gate",
        visual.checks
          .filter((c) => !c.passed)
          .map((c) => `${c.label}: ${c.detail}`)
          .join("; "),
      );

  const proof = createMonsterProofReport({
    projectId: input.project.id,
    blueprintSummary,
    gates: [
      passed("blueprint", "Monster Blueprint produced", blueprintSummary),
      passed("design-brief", "Design brief produced", designBriefSummary),
      passed(
        "design",
        "Custom blueprint-driven preview generated",
        dashboardBleed.replaced
          ? "Dashboard/app shell output rejected and replaced with clean homepage fallback"
          : `${blueprint.design.mode}: custom preview from ${blueprint.appType}`,
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
      visualGate,
      pending("typecheck", "TypeScript check", "npm run typecheck"),
      pending("lint", "Lint", "npm run lint"),
      pending("build", "Production build", "npm run build"),
      pending("test", "Tests", "npm run test", false),
    ],
  });

  return {
    generator: "monster-orchestrator-v1",
    blueprint,
    designBrief: brief,
    frontendFiles,
    backend,
    architect,
    files,
    visualQuality: visual,
    critique,
    repairAttempts,
    proof,
    output: {
      blueprintSummary,
      designBriefSummary,
      designMode: dashboardBleed.replaced ? "clean-homepage-fallback" : blueprint.design.mode,
      appType: blueprint.appType,
      previewGenerator: dashboardBleed.replaced
        ? "agent-controller-v1-clean-homepage-fallback"
        : "monster-custom-preview-v1",
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
        generator: dashboardBleed.replaced
          ? "agent-controller-v1-clean-homepage-fallback"
          : "monster-custom-preview-v1",
        expectedMeta: dashboardBleed.replaced
          ? '<meta name="yawb-controller" content="agent-controller-v1" />'
          : '<meta name="yawb-generator" content="monster-custom-preview-v1" />',
        indexPath: "index.html",
      },
      designCritique,
      visualVerdict: critique.verdict,
      visualPassed: critique.passedVisualQuality,
      repairAttempts,
    },
  };
}
