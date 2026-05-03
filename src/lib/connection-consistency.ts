// Pure consistency checker for project-level provider connections.
// Used by the Refresh links action and the proof timeline panel.
//
// Active-only by default: warnings and errors are computed exclusively from
// rows with status === "connected" for supported providers. Disconnected /
// pending / error rows are returned in `inactiveProof` for an optional
// "Inactive link history" view but never raise warnings or errors.
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
  /** Active (status === "connected") supported-provider rows. */
  proof: ConsistencyProofEntry[];
  /** Inactive (disconnected/pending/error) supported-provider rows — informational only. */
  inactiveProof: ConsistencyProofEntry[];
  checkedAt: string;
}

const SUPPORTED_PROVIDERS = new Set(["github", "vercel"]);

function toProof(c: ProjectConnection): ConsistencyProofEntry {
  return {
    connectionId: c.id,
    provider: c.provider,
    externalId: c.externalId,
    workspaceId: c.workspaceId,
    projectId: c.projectId,
    status: c.status,
    url: c.url ?? c.repoUrl ?? null,
    repoFullName: c.repoFullName,
  };
}

export function checkProjectConnectionConsistency(
  projectId: string | null | undefined,
  workspaceId: string | null | undefined,
  connections: ProjectConnection[],
): ConsistencyResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checkedAt = new Date().toISOString();

  if (!projectId) {
    return {
      ok: false,
      errors: ["No current project"],
      warnings,
      proof: [],
      inactiveProof: [],
      checkedAt,
    };
  }

  const supported = connections.filter((c) => SUPPORTED_PROVIDERS.has(c.provider));
  const active = supported.filter((c) => c.status === "connected");
  const inactive = supported.filter((c) => c.status !== "connected");

  const proof = active.map(toProof);
  const inactiveProof = inactive.map(toProof);

  // Validate active rows only — disconnected history is not a warning.
  for (const c of active) {
    if (c.projectId !== projectId) {
      errors.push(`${c.provider} connection ${c.id} is bound to a different project`);
    }
    if (workspaceId && c.workspaceId && c.workspaceId !== workspaceId) {
      errors.push(`${c.provider} connection ${c.id} is bound to a different workspace`);
    }
    if (!c.externalId) {
      warnings.push(`${c.provider} connection is missing external_id`);
    }
    if (c.provider === "github" && !c.repoFullName) {
      warnings.push("GitHub connection is missing repo metadata");
    }
    if (c.provider === "vercel" && !c.url) {
      warnings.push("Vercel connection is missing deployment URL");
    }
  }

  // Invariant: at most one active connection per provider per project.
  const vercelActive = active.filter((c) => c.provider === "vercel");
  if (vercelActive.length > 1) {
    errors.push(
      `Project has ${vercelActive.length} active Vercel connections — only one is allowed`,
    );
  }
  const githubActive = active.filter((c) => c.provider === "github");
  if (githubActive.length > 1) {
    errors.push(
      `Project has ${githubActive.length} active GitHub connections — only one is allowed`,
    );
  }

  // Cross-provider repo compatibility — only when BOTH sides are active.
  const gh = githubActive[0];
  const vc = vercelActive[0];
  if (gh && vc) {
    const ghRepo = (gh.repoFullName ?? "").toLowerCase();
    const vcRepoMeta = (vc.metadata as { link?: { repo?: string } } | null)?.link?.repo ?? null;
    const vcRepo = (vc.repoFullName ?? vcRepoMeta ?? "").toLowerCase();
    if (ghRepo && vcRepo && ghRepo !== vcRepo) {
      warnings.push(`Vercel project repo (${vcRepo}) does not match GitHub repo (${ghRepo})`);
    }
  }

  return {
    ok: errors.length === 0,
    warnings,
    errors,
    proof,
    inactiveProof,
    checkedAt,
  };
}
