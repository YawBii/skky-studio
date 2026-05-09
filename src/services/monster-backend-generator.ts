import type { MonsterBlueprint } from "./monster-blueprint";

export interface MonsterGeneratedBackendFile {
  path: string;
  content: string;
  language: "sql" | "markdown" | "json";
  kind: "source" | "asset";
}

export interface MonsterBackendGenerationResult {
  files: MonsterGeneratedBackendFile[];
  tableCount: number;
  policyCount: number;
  migrationPath: string;
  readmePath: string;
}

export function generateMonsterSupabaseMigration(blueprint: MonsterBlueprint): string {
  return [
    "-- Monster Backend v1",
    `-- App: ${blueprint.appName}`,
    `-- Type: ${blueprint.appType}`,
    "-- Backend artifact generation is now deferred to the explicit production/security step.",
    "-- Preview/regenerate must stay fast and only update visible project files.",
    "",
  ].join("\n");
}

export function generateMonsterBackendReadme(blueprint: MonsterBlueprint): string {
  return [
    `# ${blueprint.appName} Backend Plan`,
    "",
    "Backend generation is deferred so visual preview regeneration stays fast.",
    "Use the production/security workflow to create migrations and RLS policy files.",
    "",
    `App type: ${blueprint.appType}`,
  ].join("\n");
}

export function generateMonsterBackendFiles(
  _blueprint: MonsterBlueprint,
): MonsterBackendGenerationResult {
  return {
    files: [],
    tableCount: 0,
    policyCount: 0,
    migrationPath: "",
    readmePath: "",
  };
}
