// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviewPane } from "./preview-pane";
import type { Project } from "@/services/projects";
import { generateProjectFiles } from "@/services/project-template";

const project: Project = {
  id: "p-good",
  workspaceId: "w1",
  name: "Goodhand",
  slug: "goodhand",
  description: "Discover community contributors.",
  createdAt: "",
};

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});

afterEach(() => {
  /* nothing */
});

describe("PreviewPane — generated project_files integration", () => {
  it("uses generated index.html as iframe srcDoc when present", () => {
    const files = generateProjectFiles({
      project: { id: project.id, name: project.name, description: project.description },
    });
    const indexHtml = files.find((f) => f.path === "index.html")!.content;
    const html = renderToStaticMarkup(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
        generated={{ indexHtml, hasFiles: true }}
      />,
    );
    // The iframe should embed the project-specific HTML, not the generic placeholder.
    expect(html).toContain("Goodhand");
    expect(html).toContain("scanner"); // category meta
    expect(html).toContain("project_files/index.html");
    expect(html).not.toContain("in-memory");
    expect(html).not.toContain("No generated screens yet");
  });

  it("falls back to placeholder srcDoc when no generated files exist", () => {
    const html = renderToStaticMarkup(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
        generated={null}
      />,
    );
    expect(html).toContain("No generated screens yet");
    expect(html).toContain("fallback:placeholder");
  });
});
