import type { MonsterGeneratedFile, MonsterGenerationResult } from "./monster-orchestrator";

export interface MonsterSupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

export interface PersistMonsterProjectResult {
  ok: boolean;
  written: string[];
  error?: string;
  output?: MonsterGenerationResult["output"] & {
    generator: MonsterGenerationResult["generator"];
    proof: MonsterGenerationResult["proof"];
    blueprint: MonsterGenerationResult["blueprint"];
  };
}

export async function persistMonsterGeneratedFiles(input: {
  sb: MonsterSupabaseLike;
  projectId: string;
  generation: MonsterGenerationResult;
}): Promise<PersistMonsterProjectResult> {
  const written: string[] = [];
  for (const file of input.generation.files) {
    const { error } = await input.sb.from("project_files").upsert(
      {
        project_id: input.projectId,
        path: file.path,
        content: file.content,
        language: file.language,
        kind: file.kind,
      },
      { onConflict: "project_id,path" },
    );
    if (error) {
      return {
        ok: false,
        written,
        error: `project_files upsert failed for ${file.path}: ${error.message}`,
      };
    }
    written.push(file.path);
  }

  const sorted = [...written].sort();
  return {
    ok: true,
    written: sorted,
    output: {
      ...input.generation.output,
      generator: input.generation.generator,
      proof: input.generation.proof,
      blueprint: input.generation.blueprint,
      written: sorted,
      filesTouched: sorted,
      changedFiles: sorted,
      fileList: sorted,
      fileCount: sorted.length,
    },
  };
}

export function splitMonsterGeneratedFiles(files: MonsterGeneratedFile[]): {
  frontend: MonsterGeneratedFile[];
  backend: MonsterGeneratedFile[];
} {
  return {
    frontend: files.filter(
      (file) => file.path === "index.html" || file.path === "styles.css" || file.path === "app.js",
    ),
    backend: files.filter(
      (file) => file.path.startsWith("supabase/") || file.path.startsWith("docs/generated/"),
    ),
  };
}
