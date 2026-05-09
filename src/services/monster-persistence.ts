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

function shouldPersist(file: MonsterGeneratedFile): boolean {
  // yawB preview regeneration must feel instant. Persist only the visible
  // preview files here; backend/docs/route architecture can be produced in a
  // separate explicit production step instead of blocking the user behind a
  // long queue.
  return file.path === "index.html" || file.path === "styles.css" || file.path === "app.js";
}

export async function persistMonsterGeneratedFiles(input: {
  sb: MonsterSupabaseLike;
  projectId: string;
  generation: MonsterGenerationResult;
}): Promise<PersistMonsterProjectResult> {
  if (!input.generation.visualQuality.passed) {
    const failed = input.generation.visualQuality.checks
      .filter((check) => !check.passed)
      .map((check) => `${check.label}: ${check.detail}`)
      .join("; ");
    return {
      ok: false,
      written: [],
      error: `visualQuality failed; refusing to persist generated preview: ${failed}`,
    };
  }

  const files = input.generation.files.filter(shouldPersist);
  const written: string[] = [];
  for (const file of files) {
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
    frontend: files.filter(shouldPersist),
    backend: files.filter(
      (file) => file.path.startsWith("supabase/") || file.path.startsWith("docs/generated/"),
    ),
  };
}
