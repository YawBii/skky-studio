import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const hookSrc = readFileSync(resolve(process.cwd(), "src/hooks/use-selected-project.ts"), "utf8");
const rootSrc = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");

describe("selected project context", () => {
  it("does not refetch workspaces/projects inside useSelectedProject", () => {
    expect(hookSrc).not.toMatch(/useWorkspaces/);
    expect(hookSrc).not.toMatch(/useProjects/);
  });

  it("is provided once from WorkspaceShell's existing workspace/project data", () => {
    expect(rootSrc).toMatch(/<SelectedProjectProvider value=\{selectedProjectState\}>/);
    const projectFetches = rootSrc.match(/useProjects\(/g) ?? [];
    const workspaceFetches = rootSrc.match(/useWorkspaces\(/g) ?? [];
    expect(projectFetches.length).toBe(1);
    expect(workspaceFetches.length).toBe(1);
  });
});