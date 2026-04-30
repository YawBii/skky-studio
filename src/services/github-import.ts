// GitHub import — frontend-shaped service.
//
// Real OAuth/sync requires a server function that exchanges a GitHub token
// and reads the repo. Until that's wired we:
//   1) parse + validate the user-provided repo reference
//   2) create the project in Supabase via the existing `projects` insert
//   3) best-effort store GitHub metadata in `project_connections`
//      (table is optional — if missing, we surface that to the caller so the
//       UI can show a clear "GitHub sync will be connected next" notice)
//
// No tokens or secrets are read in this module.
import { supabase } from "@/integrations/supabase/client";

export interface ParsedRepo {
  owner: string;
  repo: string;
  fullName: string; // owner/repo
  url: string;      // https://github.com/owner/repo
}

const SEG = /^[A-Za-z0-9._-]+$/;

/** Accepts:
 *  - https://github.com/owner/repo
 *  - http://github.com/owner/repo
 *  - github.com/owner/repo
 *  - owner/repo
 *  Strips a trailing .git and any trailing slash. */
export function parseRepoInput(raw: string): ParsedRepo | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\//i, "");
  s = s.replace(/^github\.com\//i, "");
  s = s.replace(/\/$/, "");
  s = s.replace(/\.git$/i, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!SEG.test(owner) || !SEG.test(repo)) return null;
  if (owner.length > 39 || repo.length > 100) return null;
  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    url: `https://github.com/${owner}/${repo}`,
  };
}

export type ConnectionResult =
  | { ok: true }
  | { ok: false; reason: "table-missing" | "not-signed-in" | "error"; message?: string };

/** Best-effort insert into project_connections. Returns table-missing
 *  when the schema isn't deployed yet so the UI can show a clear notice. */
export async function recordGitHubConnection(input: {
  projectId: string;
  repo: ParsedRepo;
}): Promise<ConnectionResult> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { ok: false, reason: "not-signed-in" };
    const { error } = await supabase.from("project_connections").insert({
      project_id: input.projectId,
      provider: "github",
      status: "pending",
      repo_full_name: input.repo.fullName,
      repo_url: input.repo.url,
      default_branch: null,
      created_by: u.user.id,
    });
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      // Postgres "relation does not exist" / PostgREST "could not find the table"
      if (msg.includes("does not exist") || msg.includes("could not find") || error.code === "42P01" || error.code === "PGRST205") {
        return { ok: false, reason: "table-missing", message: error.message };
      }
      return { ok: false, reason: "error", message: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : "unknown" };
  }
}
