import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(process.cwd(), "src/routes/projects.tsx"), "utf8");

describe("Projects provider tabs lazy loading", () => {
  it("passes active-tab enabled flags into provider tabs", () => {
    expect(src).toMatch(/<GithubReposTab[\s\S]*enabled=\{tab === "github"\}/);
    expect(src).toMatch(/<VercelProjectsTab[\s\S]*enabled=\{tab === "vercel"\}/);
  });

  it("does not auto-load GitHub or Vercel lists from mount effects", () => {
    const githubBody = src
      .split("function GithubReposTab")[1]
      .split("async function importRepo")[0];
    const vercelBody = src
      .split("function VercelProjectsTab")[1]
      .split("async function performLink")[0];
    expect(githubBody).not.toMatch(/useEffect\([\s\S]*load/);
    expect(vercelBody).not.toMatch(/useEffect\([\s\S]*load/);
  });

  it("records render/fetch counters for provider tab diagnostics", () => {
    expect(src).toMatch(/noteRender\("VercelProjectsTab"\)/);
    expect(src).toMatch(/noteRender\("GithubReposTab"\)/);
    expect(src).toMatch(/noteFetchCall\("VercelProjectsTab:listVercelProjects"\)/);
    expect(src).toMatch(/noteFetchCall\("GithubReposTab:listGithubRepos"\)/);
  });
});
