// @vitest-environment happy-dom
// Asserts the WorkspaceTopBar source no longer pulls useSelectedProject and
// that its props contract is presentational.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("WorkspaceTopBar — presentational refactor", () => {
  const src = readFileSync(
    resolve(process.cwd(), "src/components/workspace-top-bar.tsx"),
    "utf8",
  );

  it("does not import useSelectedProject", () => {
    expect(src).not.toMatch(/useSelectedProject/);
  });

  it("declares projects/currentProject/selectProject props", () => {
    expect(src).toMatch(/projects:\s*Project\[\]/);
    expect(src).toMatch(/currentProject:\s*Project\s*\|\s*null/);
    expect(src).toMatch(/selectProject:\s*\(id:\s*string\)\s*=>\s*void/);
  });

  it("does not call useWorkspaces or useProjects internally", () => {
    expect(src).not.toMatch(/useWorkspaces\(/);
    expect(src).not.toMatch(/useProjects\(/);
  });
});
