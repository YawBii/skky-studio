// TODO(codex): wire to GitHub via @octokit/rest using GITHUB_TOKEN secret.
import type { Project } from "@/lib/demo-data";

export interface Repo {
  fullName: string;
  defaultBranch: string;
  private: boolean;
  stars: number;
  openIssues: number;
  lastCommit: { sha: string; message: string; author: string; at: string };
}
export interface PullRequest {
  number: number;
  title: string;
  state: "open" | "merged" | "closed";
  branch: string;
  author: string;
  url: string;
  createdAt: string;
}

export async function listRepos(): Promise<Repo[]> {
  return [
    { fullName: "skky-group/portal", defaultBranch: "main", private: true, stars: 42, openIssues: 0,
      lastCommit: { sha: "a4f2c91", message: "feat(settings): add billing tab", author: "yawB", at: "2h ago" } },
    { fullName: "skky-group/aurora", defaultBranch: "main", private: true, stars: 128, openIssues: 3,
      lastCommit: { sha: "9d31fa2", message: "fix(rls): tighten audit_logs", author: "ana", at: "1d ago" } },
  ];
}

export async function getRepo(_fullName: string): Promise<Repo> {
  const all = await listRepos();
  return all[0];
}

export async function listPullRequests(_fullName: string): Promise<PullRequest[]> {
  return [
    { number: 142, title: "feat: settings tabs", state: "open", branch: "yawb/settings-tabs", author: "yawB", url: "#", createdAt: "2h ago" },
    { number: 141, title: "chore: bump deps", state: "merged", branch: "deps/weekly", author: "yawB", url: "#", createdAt: "1d ago" },
  ];
}

export async function createPullRequest(_input: {
  repo: string; branch: string; title: string; body: string;
}): Promise<PullRequest> {
  return { number: 143, title: _input.title, state: "open", branch: _input.branch, author: "yawB", url: "#", createdAt: "now" };
}

function normalizeRepoInput(repoUrl: string): string {
  return repoUrl
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/^github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "");
}

function toProjectName(repoFullName: string): string {
  const repoName = repoFullName.split("/").pop() || "Imported Project";
  return repoName
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function importProject(repoUrl: string): Promise<Project> {
  const github = normalizeRepoInput(repoUrl);

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(github)) {
    throw new Error("Enter a valid GitHub repository, for example github.com/org/repo.");
  }

  const id = github
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return {
    id,
    name: toProjectName(github),
    description: "Imported GitHub project queued for yawB analysis and repair.",
    status: "building",
    health: 0,
    lastDeploy: "importing...",
    framework: "Unknown",
    url: "#",
    github,
    stars: 0,
    issues: 0,
    source: "Imported",
  };
}
