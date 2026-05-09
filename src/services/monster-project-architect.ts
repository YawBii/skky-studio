import type { MonsterBlueprint } from "./monster-blueprint";

export interface MonsterArchitectFile {
  path: string;
  content: string;
  language: "tsx" | "ts" | "css" | "sql" | "markdown" | "json";
  kind: "source" | "asset";
  role: "route" | "component" | "lib" | "style" | "backend" | "doc" | "test";
}

export interface MonsterArchitectResult {
  generator: "monster-project-architect-v1";
  files: MonsterArchitectFile[];
  routes: string[];
  components: string[];
  backendArtifacts: string[];
  designCritique: string[];
}

export function generateMonsterArchitectFiles(blueprint: MonsterBlueprint): MonsterArchitectResult {
  return {
    generator: "monster-project-architect-v1",
    files: [],
    routes: blueprint.routes.map((route) => route.path),
    components: [],
    backendArtifacts: blueprint.backend.tables.map((table) => table.table),
    designCritique: [
      "Preview regeneration is now fast-path only: it writes visible preview files first.",
      "Route/component/backend artifact generation is deferred to explicit production/security workflows.",
      "This prevents Regenerate design from stalling behind non-visible project architecture work.",
    ],
  };
}
