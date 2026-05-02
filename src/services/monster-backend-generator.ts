import type { MonsterBlueprint, MonsterBlueprintTable } from "./monster-blueprint";

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

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "monster_app";
}

function sqlIdentifier(value: string): string {
  return slug(value).slice(0, 48);
}

function normalizeColumn(column: string): string {
  const trimmed = column.trim();
  if (!trimmed) return "metadata jsonb not null default '{}'::jsonb";
  if (/\bprimary\s+key\b/i.test(trimmed)) return trimmed;
  if (/\b(uuid|text|int|integer|numeric|jsonb|boolean|bool|timestamptz|timestamp|date)\b/i.test(trimmed)) return trimmed;
  return `${sqlIdentifier(trimmed)} text`;
}

function tableSql(table: MonsterBlueprintTable): string {
  const tableName = sqlIdentifier(table.table);
  const hasId = table.columns.some((c) => /^id\s+/i.test(c.trim()));
  const hasCreated = table.columns.some((c) => /^created_at\s+/i.test(c.trim()));
  const columns = [
    ...(hasId ? [] : ["id uuid primary key default gen_random_uuid()"]),
    ...table.columns.map(normalizeColumn),
    ...(hasCreated ? [] : ["created_at timestamptz not null default now()"]),
    "updated_at timestamptz not null default now()",
  ];
  return [
    `-- ${table.purpose}`,
    `create table if not exists public.${tableName} (`,
    columns.map((c, i) => `  ${c}${i === columns.length - 1 ? "" : ","}`).join("\n"),
    `);`,
    `alter table public.${tableName} enable row level security;`,
  ].join("\n");
}

function policySql(table: MonsterBlueprintTable, policy: string, index: number): string {
  const tableName = sqlIdentifier(table.table);
  const policyName = sqlIdentifier(`${tableName}_${index + 1}_${policy}`).slice(0, 62);
  const lower = policy.toLowerCase();
  const command = lower.includes("insert") || lower.includes("create") ? "insert"
    : lower.includes("update") || lower.includes("manage") ? "all"
      : "select";
  const publicRead = lower.includes("public") || lower.includes("published");
  const admin = lower.includes("admin") || lower.includes("owner");
  const using = publicRead ? "true"
    : admin ? "(auth.jwt() ->> 'role') in ('admin', 'owner', 'service_role')"
      : "auth.uid() is not null";
  const check = command === "insert" || command === "all" ? `\n  with check (${using})` : "";
  return [
    `create policy "${policyName}" on public.${tableName}`,
    `  for ${command}`,
    `  using (${using})${check};`,
  ].join("\n");
}

export function generateMonsterSupabaseMigration(blueprint: MonsterBlueprint): string {
  const header = [
    "-- Monster Backend v1",
    `-- App: ${blueprint.appName}`,
    `-- Type: ${blueprint.appType}`,
    `-- Generated from: ${blueprint.version}`,
    "-- This file is intended as the first production wiring draft.",
    "",
    "create extension if not exists pgcrypto;",
    "",
  ].join("\n");
  const tables = blueprint.backend.tables.map(tableSql).join("\n\n");
  const policies = blueprint.backend.tables
    .flatMap((table) => table.rlsPolicies.map((policy, index) => policySql(table, policy, index)))
    .join("\n\n");
  return `${header}${tables}\n\n-- Row level security policies\n${policies}\n`;
}

export function generateMonsterBackendReadme(blueprint: MonsterBlueprint): string {
  return [
    `# ${blueprint.appName} Monster Backend`,
    "",
    blueprint.summary,
    "",
    "## Backend mode",
    "",
    `- Mode: ${blueprint.backend.mode}`,
    `- Auth: ${blueprint.backend.auth}`,
    `- Roles: ${blueprint.backend.roles.join(", ")}`,
    "",
    "## Tables",
    "",
    ...blueprint.backend.tables.flatMap((table) => [
      `### ${table.table}`,
      table.purpose,
      "",
      "Columns:",
      ...table.columns.map((column) => `- ${column}`),
      "",
      "RLS plan:",
      ...table.rlsPolicies.map((policy) => `- ${policy}`),
      "",
    ]),
    "## Verification checklist",
    "",
    "- Apply the generated migration in a Supabase project.",
    "- Run auth/member/admin access checks for every RLS policy.",
    "- Confirm signed-out users cannot read private tenant data.",
    "- Confirm owners/admins can complete the intended workflows.",
  ].join("\n");
}

export function generateMonsterBackendFiles(blueprint: MonsterBlueprint): MonsterBackendGenerationResult {
  const base = slug(blueprint.appName);
  const migrationPath = `supabase/migrations/monster_${base}_initial.sql`;
  const readmePath = `docs/generated/${base}_monster_backend.md`;
  const migration = generateMonsterSupabaseMigration(blueprint);
  const readme = generateMonsterBackendReadme(blueprint);
  const policyCount = blueprint.backend.tables.reduce((n, table) => n + table.rlsPolicies.length, 0);
  return {
    files: [
      { path: migrationPath, content: migration, language: "sql", kind: "source" },
      { path: readmePath, content: readme, language: "markdown", kind: "source" },
      { path: `docs/generated/${base}_monster_blueprint.json`, content: JSON.stringify(blueprint, null, 2), language: "json", kind: "source" },
    ],
    tableCount: blueprint.backend.tables.length,
    policyCount,
    migrationPath,
    readmePath,
  };
}
