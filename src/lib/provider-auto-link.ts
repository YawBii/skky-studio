// Pure matcher — given a project and lists of provider resources, returns
// ranked candidates with confidence scores. No I/O, fully unit-testable.
//
// Confidence scale: 0..1
//   ≥ 0.9 → confident auto-link
//   0.6..0.9 → ambiguous, ask user to confirm
//   < 0.6 → ignored
import type { GithubRepoSummary, VercelProjectSummary } from "@/server/providers.server";
import type { Project } from "@/services/projects";

export const CONFIDENT = 0.9;
export const AMBIGUOUS = 0.6;

export interface AutoLinkCandidate<T> {
  resource: T;
  score: number;
  reason: string;
}

export interface AutoLinkDecision<T> {
  outcome: "match" | "ambiguous" | "none";
  picked: AutoLinkCandidate<T> | null;
  candidates: AutoLinkCandidate<T>[];
}

export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

interface ProjectMatchInput {
  slug: string;
  name: string;
  // Repo hint stored on import (e.g. "owner/repo"), used to lock matches.
  importedRepoFullName?: string | null;
  importedGithubRepoId?: number | null;
}

export function projectMatchInput(p: Pick<Project, "slug" | "name">): ProjectMatchInput {
  return { slug: p.slug, name: p.name };
}

// ---------- GitHub ----------

export function scoreGithubRepo(p: ProjectMatchInput, repo: GithubRepoSummary): AutoLinkCandidate<GithubRepoSummary> | null {
  // Locked by stored import metadata.
  if (p.importedGithubRepoId && repo.id === p.importedGithubRepoId) {
    return { resource: repo, score: 1, reason: "import metadata: repo_id match" };
  }
  if (
    p.importedRepoFullName &&
    repo.fullName.toLowerCase() === p.importedRepoFullName.toLowerCase()
  ) {
    return { resource: repo, score: 1, reason: "import metadata: repo full_name match" };
  }
  const slug = p.slug.toLowerCase();
  const name = normalizeName(p.name);
  const repoName = repo.name.toLowerCase();
  const repoNorm = normalizeName(repo.name);

  if (repoName === slug) {
    return { resource: repo, score: 0.95, reason: "repo name === project slug" };
  }
  if (repoNorm === name && repoNorm.length > 2) {
    return { resource: repo, score: 0.92, reason: "repo name normalized === project name" };
  }
  if (repoNorm.includes(name) && name.length >= 4) {
    return { resource: repo, score: 0.7, reason: "repo name contains project name" };
  }
  if (name.includes(repoNorm) && repoNorm.length >= 4) {
    return { resource: repo, score: 0.65, reason: "project name contains repo name" };
  }
  return null;
}

export function decideGithub(
  p: ProjectMatchInput,
  repos: GithubRepoSummary[],
): AutoLinkDecision<GithubRepoSummary> {
  const candidates = repos
    .map((r) => scoreGithubRepo(p, r))
    .filter((c): c is AutoLinkCandidate<GithubRepoSummary> => c !== null)
    .sort((a, b) => b.score - a.score);
  return decide(candidates);
}

// ---------- Vercel ----------

export function scoreVercelProject(
  p: ProjectMatchInput,
  vp: VercelProjectSummary,
  matchedGithubRepoFullName: string | null,
): AutoLinkCandidate<VercelProjectSummary> | null {
  // Strongest: Vercel project links to the same GitHub repo we just matched.
  if (matchedGithubRepoFullName && vp.link?.repo) {
    if (vp.link.repo.toLowerCase() === matchedGithubRepoFullName.toLowerCase()) {
      return {
        resource: vp,
        score: 1,
        reason: `linked to GitHub repo ${matchedGithubRepoFullName}`,
      };
    }
    // Penalize Vercel-linked-to-different-repo: explicit anti-match guard.
    return null;
  }
  const slug = p.slug.toLowerCase();
  const name = normalizeName(p.name);
  const vpName = vp.name.toLowerCase();
  const vpNorm = normalizeName(vp.name);

  if (vpName === slug) {
    return { resource: vp, score: 0.95, reason: "vercel project name === project slug" };
  }
  if (vpNorm === name && vpNorm.length > 2) {
    return { resource: vp, score: 0.92, reason: "vercel project name normalized === project name" };
  }
  if (vpNorm.includes(name) && name.length >= 4) {
    return { resource: vp, score: 0.7, reason: "vercel name contains project name" };
  }
  return null;
}

export function decideVercel(
  p: ProjectMatchInput,
  vercelProjects: VercelProjectSummary[],
  matchedGithubRepoFullName: string | null,
): AutoLinkDecision<VercelProjectSummary> {
  const candidates = vercelProjects
    .map((v) => scoreVercelProject(p, v, matchedGithubRepoFullName))
    .filter((c): c is AutoLinkCandidate<VercelProjectSummary> => c !== null)
    .sort((a, b) => b.score - a.score);
  return decide(candidates);
}

// ---------- shared ----------

function decide<T>(candidates: AutoLinkCandidate<T>[]): AutoLinkDecision<T> {
  if (candidates.length === 0) return { outcome: "none", picked: null, candidates };
  const top = candidates[0];
  const second = candidates[1];
  // Confident only if top is high AND clearly better than runner-up.
  if (top.score >= CONFIDENT && (!second || top.score - second.score >= 0.05)) {
    return { outcome: "match", picked: top, candidates };
  }
  // Multiple high-scoring? Ambiguous.
  if (top.score >= AMBIGUOUS) {
    return { outcome: "ambiguous", picked: null, candidates };
  }
  return { outcome: "none", picked: null, candidates };
}
