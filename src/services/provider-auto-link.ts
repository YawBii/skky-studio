// Auto-linking orchestrator. Pulls workspace-level GitHub/Vercel resources,
// runs the matcher, and writes project_connections rows for confident matches.
// Returns a structured proof log so the UI can show what happened.
import { listGithubReposFn, listVercelProjectsFn } from "@/services/providers.functions";
import {
  listConnections,
  upsertConnection,
  type ProjectConnection,
} from "@/services/project-connections";
import {
  decideGithub,
  decideVercel,
  projectMatchInput,
  type AutoLinkCandidate,
  type AutoLinkDecision,
} from "@/lib/provider-auto-link";
import type { GithubRepoSummary, VercelProjectSummary } from "@/server/providers.server";
import type { Project } from "@/services/projects";

export type AutoLinkOutcome = "match" | "ambiguous" | "none" | "skipped" | "error";

export interface AutoLinkProviderResult<T> {
  provider: "github" | "vercel" | "supabase";
  outcome: AutoLinkOutcome;
  picked: AutoLinkCandidate<T> | null;
  candidates: AutoLinkCandidate<T>[];
  connection?: ProjectConnection;
  error?: string;
  reason?: string;
}

export interface AutoLinkResult {
  projectId: string;
  ranAt: string;
  github: AutoLinkProviderResult<GithubRepoSummary>;
  vercel: AutoLinkProviderResult<VercelProjectSummary>;
  supabase: AutoLinkProviderResult<{ ref: string; url: string }>;
  proof: string[];
}

export interface AutoLinkInput {
  project: Project;
  workspaceId: string | null;
  /** Skip providers that already have an active "connected" row. */
  skipIfAlreadyLinked?: boolean;
  projectMetadata?: Record<string, unknown> | null;
}

export async function runProviderAutoLink(input: AutoLinkInput): Promise<AutoLinkResult> {
  const { project, workspaceId } = input;
  const proof: string[] = [];
  const ranAt = new Date().toISOString();
  const log = (m: string) => {
    proof.push(m);
    if (typeof window !== "undefined") console.info("[yawb][auto-link]", m);
  };

  log(`begin project=${project.id} slug=${project.slug} ws=${workspaceId ?? "—"}`);

  // Existing connections — used to short-circuit & to find existing externalIds.
  const existingRes = await listConnections(project.id);
  const existing = existingRes.connections;
  const activeGithub = existing.find((c) => c.provider === "github" && c.status === "connected");
  const activeVercel = existing.find((c) => c.provider === "vercel" && c.status === "connected");
  const activeSupabase = existing.find(
    (c) => (c.provider as string) === "supabase" && c.status === "connected",
  );

  // ---------- GitHub ----------
  let githubResult: AutoLinkProviderResult<GithubRepoSummary>;
  let matchedGithubRepoFullName: string | null = null;

  if (input.skipIfAlreadyLinked && activeGithub) {
    log(`github: already linked → ${activeGithub.repoFullName ?? activeGithub.externalId}`);
    matchedGithubRepoFullName = activeGithub.repoFullName ?? null;
    githubResult = {
      provider: "github",
      outcome: "skipped",
      picked: null,
      candidates: [],
      reason: "already linked",
    };
  } else {
    try {
      const ghRes = await listGithubReposFn({ data: { perPage: 100 } });
      if (!ghRes.ok) {
        log(`github: list failed → ${ghRes.error}`);
        githubResult = {
          provider: "github",
          outcome: "error",
          picked: null,
          candidates: [],
          error: ghRes.error,
        };
      } else {
        const decision = decideGithub(projectMatchInput(project), ghRes.repos);
        log(
          `github: ${ghRes.repos.length} repos → ${decision.outcome}` +
            (decision.picked
              ? ` (${decision.picked.resource.fullName} score=${decision.picked.score})`
              : ""),
        );
        if (decision.outcome === "match" && decision.picked) {
          const r = decision.picked.resource;
          matchedGithubRepoFullName = r.fullName;
          const conn = await upsertConnection({
            projectId: project.id,
            provider: "github",
            externalId: String(r.id),
            status: "connected",
            url: r.htmlUrl,
            repoFullName: r.fullName,
            repoUrl: r.htmlUrl,
            defaultBranch: r.defaultBranch,
            workspaceId,
            tokenOwnerType: "workspace",
            metadata: {
              auto_linked: true,
              reason: decision.picked.reason,
              repo_id: r.id,
              private: r.private,
              linked_at: ranAt,
            },
          });
          if (conn.ok) {
            log(`github: connection upserted id=${conn.connection.id}`);
            githubResult = {
              provider: "github",
              outcome: "match",
              picked: decision.picked,
              candidates: decision.candidates,
              connection: conn.connection,
            };
          } else {
            log(`github: upsert failed → ${conn.error}`);
            githubResult = {
              provider: "github",
              outcome: "error",
              picked: decision.picked,
              candidates: decision.candidates,
              error: conn.error,
            };
          }
        } else {
          githubResult = toProviderResult("github", decision);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`github: exception → ${msg}`);
      githubResult = {
        provider: "github",
        outcome: "error",
        picked: null,
        candidates: [],
        error: msg,
      };
    }
  }

  // ---------- Vercel ----------
  let vercelResult: AutoLinkProviderResult<VercelProjectSummary>;
  if (input.skipIfAlreadyLinked && activeVercel) {
    log(`vercel: already linked → ${activeVercel.url ?? activeVercel.externalId}`);
    vercelResult = {
      provider: "vercel",
      outcome: "skipped",
      picked: null,
      candidates: [],
      reason: "already linked",
    };
  } else {
    try {
      const vRes = await listVercelProjectsFn({ data: { limit: 100 } });
      if (!vRes.ok) {
        log(`vercel: list failed → ${vRes.error}`);
        vercelResult = {
          provider: "vercel",
          outcome: "error",
          picked: null,
          candidates: [],
          error: vRes.error,
        };
      } else {
        const decision = decideVercel(
          projectMatchInput(project),
          vRes.projects,
          matchedGithubRepoFullName,
        );
        log(
          `vercel: ${vRes.projects.length} projects → ${decision.outcome}` +
            (decision.picked
              ? ` (${decision.picked.resource.name} score=${decision.picked.score})`
              : ""),
        );
        if (decision.outcome === "match" && decision.picked) {
          const v = decision.picked.resource;
          const conn = await upsertConnection({
            projectId: project.id,
            provider: "vercel",
            externalId: v.id,
            status: "connected",
            url: v.productionUrl,
            workspaceId,
            tokenOwnerType: "workspace",
            metadata: {
              auto_linked: true,
              reason: decision.picked.reason,
              vercel_name: v.name,
              framework: v.framework,
              link: v.link,
              linked_at: ranAt,
            },
          });
          if (conn.ok) {
            log(`vercel: connection upserted id=${conn.connection.id}`);
            vercelResult = {
              provider: "vercel",
              outcome: "match",
              picked: decision.picked,
              candidates: decision.candidates,
              connection: conn.connection,
            };
          } else {
            log(`vercel: upsert failed → ${conn.error}`);
            vercelResult = {
              provider: "vercel",
              outcome: "error",
              picked: decision.picked,
              candidates: decision.candidates,
              error: conn.error,
            };
          }
        } else {
          vercelResult = toProviderResult("vercel", decision);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`vercel: exception → ${msg}`);
      vercelResult = {
        provider: "vercel",
        outcome: "error",
        picked: null,
        candidates: [],
        error: msg,
      };
    }
  }

  // ---------- Supabase (metadata-only this pass) ----------
  let supabaseResult: AutoLinkProviderResult<{ ref: string; url: string }>;
  if (input.skipIfAlreadyLinked && activeSupabase) {
    log("supabase: already linked");
    supabaseResult = {
      provider: "supabase",
      outcome: "skipped",
      picked: null,
      candidates: [],
      reason: "already linked",
    };
  } else {
    const md = (input.projectMetadata ?? {}) as Record<string, unknown>;
    const ref =
      (md.supabaseProjectRef as string | undefined) ??
      (md.supabaseProjectId as string | undefined) ??
      null;
    const url = (md.supabaseUrl as string | undefined) ?? null;
    if (ref || url) {
      const externalId = ref ?? url ?? "";
      const conn = await upsertConnection({
        projectId: project.id,
        provider: "supabase" as never, // provider type doesn't include supabase yet — db accepts string
        externalId,
        status: "connected",
        url: url ?? null,
        workspaceId,
        tokenOwnerType: "workspace",
        metadata: { auto_linked: true, reason: "project metadata", linked_at: ranAt, ref, url },
      });
      const picked: AutoLinkCandidate<{ ref: string; url: string }> = {
        resource: { ref: ref ?? "", url: url ?? "" },
        score: 1,
        reason: "project metadata supabase ref/url present",
      };
      if (conn.ok) {
        log(`supabase: connection upserted id=${conn.connection.id}`);
        supabaseResult = {
          provider: "supabase",
          outcome: "match",
          picked,
          candidates: [picked],
          connection: conn.connection,
        };
      } else {
        log(`supabase: upsert failed → ${conn.error}`);
        supabaseResult = {
          provider: "supabase",
          outcome: "error",
          picked,
          candidates: [picked],
          error: conn.error,
        };
      }
    } else {
      log("supabase: no project metadata (supabaseProjectRef/Url) — skipping");
      supabaseResult = {
        provider: "supabase",
        outcome: "none",
        picked: null,
        candidates: [],
        reason: "metadata unavailable",
      };
    }
  }

  return {
    projectId: project.id,
    ranAt,
    github: githubResult,
    vercel: vercelResult,
    supabase: supabaseResult,
    proof,
  };
}

function toProviderResult<T>(
  provider: "github" | "vercel",
  d: AutoLinkDecision<T>,
): AutoLinkProviderResult<T> {
  return {
    provider,
    outcome: d.outcome,
    picked: d.picked,
    candidates: d.candidates,
  };
}

/** Manually pick a candidate (used by the inline "Choose" picker). */
export async function confirmAutoLinkPick(input: {
  project: Project;
  workspaceId: string | null;
  provider: "github" | "vercel";
  pick:
    | { provider: "github"; resource: GithubRepoSummary; reason: string }
    | { provider: "vercel"; resource: VercelProjectSummary; reason: string };
}): Promise<{ ok: true; connection: ProjectConnection } | { ok: false; error: string }> {
  const { project, workspaceId, pick } = input;
  if (pick.provider === "github") {
    const r = pick.resource;
    const conn = await upsertConnection({
      projectId: project.id,
      provider: "github",
      externalId: String(r.id),
      status: "connected",
      url: r.htmlUrl,
      repoFullName: r.fullName,
      repoUrl: r.htmlUrl,
      defaultBranch: r.defaultBranch,
      workspaceId,
      tokenOwnerType: "workspace",
      metadata: { auto_linked: false, manual_confirm: true, reason: pick.reason, repo_id: r.id },
    });
    return conn.ok ? { ok: true, connection: conn.connection } : { ok: false, error: conn.error };
  }
  const v = pick.resource;
  const conn = await upsertConnection({
    projectId: project.id,
    provider: "vercel",
    externalId: v.id,
    status: "connected",
    url: v.productionUrl,
    workspaceId,
    tokenOwnerType: "workspace",
    metadata: {
      auto_linked: false,
      manual_confirm: true,
      reason: pick.reason,
      vercel_name: v.name,
    },
  });
  return conn.ok ? { ok: true, connection: conn.connection } : { ok: false, error: conn.error };
}
