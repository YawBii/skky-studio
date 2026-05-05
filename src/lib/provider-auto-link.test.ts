import { describe, it, expect } from "vitest";
import {
  decideGithub,
  decideVercel,
  scoreGithubRepo,
  scoreVercelProject,
  normalizeName,
} from "./provider-auto-link";
import type { GithubRepoSummary, VercelProjectSummary } from "@/server/providers.server";

const repo = (over: Partial<GithubRepoSummary>): GithubRepoSummary => ({
  id: 1,
  fullName: "YawBii/ujob",
  name: "ujob",
  owner: "YawBii",
  private: false,
  defaultBranch: "main",
  htmlUrl: "https://github.com/YawBii/ujob",
  description: null,
  pushedAt: null,
  stars: 0,
  ...over,
});

const vp = (over: Partial<VercelProjectSummary>): VercelProjectSummary => ({
  id: "prj_1",
  name: "ujob",
  framework: "vite",
  productionUrl: null,
  updatedAt: null,
  link: null,
  ...over,
});

describe("provider-auto-link matcher", () => {
  it("auto-links ujob slug to YawBii/ujob repo", () => {
    const d = decideGithub({ slug: "ujob", name: "ujob" }, [
      repo({ id: 11, fullName: "YawBii/ujob", name: "ujob" }),
      repo({ id: 12, fullName: "skky/aurora", name: "aurora" }),
    ]);
    expect(d.outcome).toBe("match");
    expect(d.picked?.resource.fullName).toBe("YawBii/ujob");
  });

  it("auto-links ujob to vercel project named ujob", () => {
    const d = decideVercel({ slug: "ujob", name: "ujob" }, [vp({ name: "ujob" })], null);
    expect(d.outcome).toBe("match");
  });

  it("does not link family-life to unrelated repo", () => {
    const d = decideGithub({ slug: "family-life", name: "Family Life" }, [
      repo({ name: "portal", fullName: "skky/portal" }),
      repo({ name: "aurora", fullName: "skky/aurora" }),
    ]);
    expect(d.outcome).toBe("none");
    expect(d.picked).toBeNull();
  });

  it("flags ambiguous when two strong matches exist", () => {
    const d = decideGithub({ slug: "ujob", name: "ujob" }, [
      repo({ id: 1, fullName: "a/ujob", name: "ujob" }),
      repo({ id: 2, fullName: "b/ujob", name: "ujob" }),
    ]);
    expect(d.outcome).toBe("ambiguous");
    expect(d.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects vercel project linked to a different github repo", () => {
    const c = scoreVercelProject(
      { slug: "ujob", name: "ujob" },
      vp({ name: "ujob", link: { type: "github", repo: "someone-else/ujob" } }),
      "YawBii/ujob",
    );
    expect(c).toBeNull();
  });

  it("locks match via stored repo full_name metadata", () => {
    const c = scoreGithubRepo(
      { slug: "anything", name: "anything", importedRepoFullName: "YawBii/ujob" },
      repo({ fullName: "YawBii/ujob" }),
    );
    expect(c?.score).toBe(1);
  });

  it("normalizes names", () => {
    expect(normalizeName("Family-Life!")).toBe("familylife");
  });
});
