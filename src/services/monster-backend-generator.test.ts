import { describe, expect, it } from "vitest";
import { createMonsterBlueprint } from "./monster-director";
import {
  generateMonsterBackendFiles,
  generateMonsterSupabaseMigration,
} from "./monster-backend-generator";

const project = { id: "p1", name: "LawForge", description: "AI law firm platform" };

describe("Monster backend generator", () => {
  it("generates Supabase migration SQL with RLS enabled", () => {
    const blueprint = createMonsterBlueprint({
      project,
      chatRequest: "Build a premium AI law firm with auth, dashboard, admin and payments",
    });
    const sql = generateMonsterSupabaseMigration(blueprint);
    expect(sql).toContain("create extension if not exists pgcrypto");
    expect(sql).toContain("create table if not exists public.profiles");
    expect(sql).toContain("alter table public.profiles enable row level security");
    expect(sql).toContain("create policy");
  });

  it("emits migration, backend readme, and blueprint json files", () => {
    const blueprint = createMonsterBlueprint({
      project,
      chatRequest: "Create an analytics admin dashboard for operators with metrics and audit logs",
    });
    const result = generateMonsterBackendFiles(blueprint);
    expect(result.tableCount).toBeGreaterThan(0);
    expect(result.policyCount).toBeGreaterThan(0);
    expect(result.files.map((f) => f.path)).toEqual(
      expect.arrayContaining([
        "supabase/migrations/monster_lawforge_initial.sql",
        "docs/generated/lawforge_monster_backend.md",
        "docs/generated/lawforge_monster_blueprint.json",
      ]),
    );
  });
});
