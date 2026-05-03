// Pure consistency checker for project-level provider connections.
// Used by the Refresh links action and the proof timeline panel.
import type { ProjectConnection } from "@/services/project-connections";

export interface ConsistencyProofEntry {
  connectionId: string;
  provider: string;
  externalId: string | null;
  workspaceId: string | null;
  projectId: string;
  status: string;
  url: string | null;
  repoFullName: string | null;
}

export interface ConsistencyResult {
  ok: boolean;
  warnings: string[];
  errors: string[];
  proof: ConsistencyProofEntry[];
  checkedAt: string;
}

const SUPPORTED_PROVIDERS = new Set(["github", "vercel"]);

export function checkProjectConnectionConsistency(
  projectId: string | null | undefined,
  workspaceId: string | null | undefined,
  connections: ProjectConnection[],
): ConsistencyResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const proof: ConsistencyProofEntry[] = [];
  const checkedAt = new Date().toISOString();

  if (!projectId) {
    return { ok: false, errors: ["No current project"], warnings, proof, checkedAt };
  }

  const supported = connections.filter((c) => SUPPORTED_PROVIDERS.has(c.provider));

  for (const c of supported) {
    proof.push({
      connectionId: c.id,
      provider: c.provider,
      externalId: c.externalId,
      workspaceId: c.workspaceId,
      projectId: c.projectId,
      status: c.status,
      url: c.url ?? c.repoUrl ?? null,
      repoFullName: c.repoFullName,
    });

    if (c.projectId !== projectId) {
      errors.push(`${c.provider} connection ${c.id} is bound to a different project`);
    }
    if (workspaceId && c.workspaceId && c.workspaceId !== workspaceId) {
      errors.push(`${c.provider} connection ${c.id} is bound to a different workspace`);
    }
    if (!c.externalId) {
      warnings.push(`${c.provider} connection is missing external_id`);
    }
    if (c.status !== "connected") {
      warnings.push(`${c.provider} connection status is "${c.status}"`);
    }
    if (c.provider === "github" && !c.repoFullName) {
      warnings.push("GitHub connection is missing repo metadata");
    }
    if (c.provider === "vercel" && !c.url) {
      warnings.push("Vercel connection is missing deployment URL");
    }
  }

  // Cross-provider repo compatibility: if both github and vercel are linked,
  // warn when their repo identifiers don't match.
  const gh = supported.find((c) => c.provider === "github");
  const vc = supported.find((c) => c.provider === "vercel");
  if (gh && vc) {
    const ghRepo = (gh.repoFullName ?? "").toLowerCase();
    const vcRepoMeta = (vc.metadata as { link?: { repo?: string } } | null)?.link?.repo ?? null;
    const vcRepo = (vc.repoFullName ?? vcRepoMeta ?? "").toLowerCase();
    if (ghRepo && vcRepo && ghRepo !== vcRepo) {
      warnings.push(
        `Vercel project repo (${vcRepo}) does not match GitHub repo (${ghRepo})`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    warnings,
    errors,
    proof,
    checkedAt,
  };
}
