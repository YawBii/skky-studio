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

export async function importProject(_repoUrl: string): Promise<Project> {
  // TODO(codex): clone + analyze + persist project record
  throw new Error("not implemented");
}
