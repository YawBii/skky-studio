// Legacy-compat shim — Monster Brain v1 is the real generator.
//
// Existing call sites (jobs runner, project-files service, tests) import
// `generateProjectFiles` and `detectCategory` from here. We keep those exports
// stable but route them through `monster-brain-generator.ts` so every project
// gets the new archetype-based, visibly-distinct output.

import {
  generateProjectFiles as monsterGenerate,
  inferProjectArchetype,
  designSignature,
  type Archetype,
  type GeneratedProjectFile,
  type MonsterBrainContext,
} from "@/services/monster-brain-generator";
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

export function detectCategory(input: { name: string; description?: string | null; chatRequest?: string | null }): ProjectCategory {
  const arch = inferProjectArchetype(
    { id: input.name, name: input.name, description: input.description ?? null },
    { chatRequest: input.chatRequest ?? null },
  );
  // Domain-specific mappings to keep legacy tests stable.
  if (/\bskkylab|studio|creative|lab\b/i.test(`${input.name} ${input.description ?? ""}`)) return "studio";
  if (/\b(directory|index|catalog|profiles?|people|community|leaders?|influencers?|popular|lastman)\b/i.test(`${input.name} ${input.description ?? ""}`)) return "directory";
  return ARCHETYPE_TO_CATEGORY[arch];
}

export function generateProjectFiles(input: GenerateInput): GeneratedFile[] {
  const ctx: MonsterBrainContext = { chatRequest: input.chatRequest ?? null };
  const files: GeneratedProjectFile[] = monsterGenerate(input.project, ctx);
  return files;
}

export interface ProjectGenerator {
  generate(input: GenerateInput): Promise<GeneratedFile[]> | GeneratedFile[];
}

export const deterministicGenerator: ProjectGenerator = {
  generate: (input) => generateProjectFiles(input),
};

export { inferProjectArchetype, designSignature };
export type { Archetype, MonsterBrainContext };
