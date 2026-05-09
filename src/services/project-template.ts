// Legacy-compat shim — Monster Orchestrator v1 is the real generator.
//
// Existing call sites (jobs runner, project-files service, tests) import
// `generateProjectFiles` and `detectCategory` from here. We keep those exports
// stable but route file generation through `monster-orchestrator.ts` so every
// build path uses the same dashboard-bleed rejection and clean preview fallback.

import {
  inferProjectArchetype,
  designSignature,
  type Archetype,
  type MonsterBrainContext,
} from "@/services/monster-brain-generator";
import { generateMonsterProject } from "@/services/monster-orchestrator";
import type { Project } from "@/services/projects";

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  kind: "source" | "asset";
}

export interface GenerateInput {
  project: Pick<Project, "id" | "name"> & { description?: string | null };
  chatRequest?: string | null;
}

export type ProjectCategory =
  | "scanner"
  | "marketplace"
  | "portfolio"
  | "directory"
  | "studio"
  | "saas"
  | "generic";

const ARCHETYPE_TO_CATEGORY: Record<Archetype, ProjectCategory> = {
  "social-good": "scanner",
  jobs: "marketplace",
  marketplace: "marketplace",
  corporate: "portfolio",
  portfolio: "portfolio",
  fintech: "saas",
  identity: "scanner",
  gaming: "studio",
  saas: "saas",
  default: "generic",
};

export function detectCategory(input: {
  name: string;
  description?: string | null;
  chatRequest?: string | null;
}): ProjectCategory {
  const arch = inferProjectArchetype(
    { id: input.name, name: input.name, description: input.description ?? null },
    { chatRequest: input.chatRequest ?? null },
  );
  if (/\bskkylab|studio|creative|lab\b/i.test(`${input.name} ${input.description ?? ""}`))
    return "studio";
  if (
    /\b(directory|index|catalog|profiles?|people|community|leaders?|influencers?|popular|lastman)\b/i.test(
      `${input.name} ${input.description ?? ""}`,
    )
  )
    return "directory";
  return ARCHETYPE_TO_CATEGORY[arch];
}

export function generateProjectFiles(input: GenerateInput): GeneratedFile[] {
  const generation = generateMonsterProject({
    project: input.project,
    chatRequest: input.chatRequest ?? null,
    production: false,
  });
  return generation.files.map((file) => ({
    path: file.path,
    content: file.content,
    language: file.language,
    kind: file.kind,
  }));
}

export interface ProjectGenerator {
  generate(input: GenerateInput): Promise<GeneratedFile[]> | GeneratedFile[];
}

export const deterministicGenerator: ProjectGenerator = {
  generate: (input) => generateProjectFiles(input),
};

export { inferProjectArchetype, designSignature };
export type { Archetype, MonsterBrainContext };
