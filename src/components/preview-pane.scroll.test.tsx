// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviewPane } from "./preview-pane";
import { generateProjectFiles } from "@/services/project-template";
import type { Project } from "@/services/projects";

const project: Project = {
  id: "p-scroll",
  workspaceId: "w1",
  name: "Goodhand",
  slug: "goodhand",
  description: "Discover community contributors.",
  createdAt: "",
};

beforeEach(() => {
  try { window.localStorage.clear(); } catch { /* ignore */ }
});

describe("PreviewPane — desktop scroll + regenerate action", () => {
  it("desktop iframe has scrolling=auto so the page starts at the top of the hero", () => {
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
    expect(html).toContain('scrolling="auto"');
    expect(html).not.toContain('loading="lazy"');
    // Local generated content is loaded, not fallback placeholder.
    expect(html).not.toContain("No generated screens yet");
    expect(html).toContain("project_files/index.html");
  });

  it("renders Regenerate design button when handler is provided", () => {
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
        onRegenerateDesign={() => {}}
      />,
    );
    expect(html).toContain("Regenerate design");
    expect(html).toContain('data-testid="preview-regenerate-design"');
  });
});
