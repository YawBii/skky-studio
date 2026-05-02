import type { DesignMode } from "./monster-brain-generator";

export type MonsterQualityBar = "prototype" | "production";
export type MonsterAuthMode = "none" | "optional" | "required";
export type MonsterBackendMode = "none" | "supabase";
export type MonsterRouteAuth = "public" | "signed-in" | "role";
export type MonsterVisualDensity = "minimal" | "balanced" | "rich";

export interface MonsterBlueprintRoute {
  path: string;
  label: string;
  purpose: string;
  auth: MonsterRouteAuth;
  role?: string;
}

export interface MonsterBlueprintTable {
  table: string;
  purpose: string;
  columns: string[];
  rlsPolicies: string[];
}

export interface MonsterBlueprintIntegration {
  provider: "github" | "vercel" | "supabase" | "stripe" | "email" | "storage" | "none";
  purpose: string;
  required: boolean;
}

export interface MonsterBlueprintDesign {
  mode: DesignMode;
  reason: string;
  visualDensity: MonsterVisualDensity;
  heroIntent: string;
}

export interface MonsterBlueprintBackend {
  mode: MonsterBackendMode;
  auth: MonsterAuthMode;
  roles: string[];
  tables: MonsterBlueprintTable[];
}

export interface MonsterBlueprint {
  version: "monster-blueprint-v1";
  source: "monster-director";
  prompt: string;
  appName: string;
  appType: string;
  summary: string;
  qualityBar: MonsterQualityBar;
  design: MonsterBlueprintDesign;
  routes: MonsterBlueprintRoute[];
  backend: MonsterBlueprintBackend;
  integrations: MonsterBlueprintIntegration[];
  workflows: string[];
  acceptanceTests: string[];
  proof: {
    inferredFrom: string[];
    confidence: "low" | "medium" | "high";
  };
}

export const MONSTER_BLUEPRINT_VERSION = "monster-blueprint-v1" as const;

export function summarizeMonsterBlueprint(blueprint: MonsterBlueprint): string {
  const routeCount = blueprint.routes.length;
  const tableCount = blueprint.backend.tables.length;
  const integrationCount = blueprint.integrations.filter((i) => i.provider !== "none").length;
  return [
    `${blueprint.appName}: ${blueprint.appType}`,
    `Design ${blueprint.design.mode} (${blueprint.design.visualDensity})`,
    `${routeCount} routes, ${tableCount} tables, ${integrationCount} integrations`,
    `Quality: ${blueprint.qualityBar}`,
  ].join(" · ");
}
