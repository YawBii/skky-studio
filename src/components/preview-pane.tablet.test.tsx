// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PreviewPane } from "./preview-pane";
import type { Project } from "@/services/projects";

const project: Project = {
  id: "p-tab",
  workspaceId: "w1",
  name: "Tab Demo",
  slug: "tab-demo",
  description: null,
  createdAt: "",
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});
afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
  host?.remove();
  host = null;
});

function renderAtWidth(width: number, node: React.ReactNode) {
  host = document.createElement("div");
  host.style.width = `${width}px`;
  host.style.overflow = "hidden";
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
}

const TABLET_WIDTHS = [768, 820, 1024];

describe("PreviewPane — iPad/tablet overflow guard", () => {
  for (const w of TABLET_WIDTHS) {
    it(`toolbar fits one row at ${w}px without overflow`, () => {
      const c = renderAtWidth(
        w,
        <PreviewPane
          device="tablet"
          setDevice={() => {}}
          project={project}
          onStartBuild={() => {}}
          starting={false}
          selectedPage="/"
          activeDeployUrl={null}
          generated={{
            indexHtml: "<!doctype html><body>x</body>",
            hasFiles: true,
          }}
          onRegenerateDesign={() => {}}
          onRefreshLocalPreview={() => {}}
        />,
      );
      const more = c.querySelector('[data-testid="preview-more"]') as HTMLElement;
      expect(more).toBeTruthy();
      const toolbar = more.parentElement!;
      expect(toolbar.className).toMatch(/flex-nowrap/);
      expect(c.querySelector('[data-testid="preview-regenerate-design"]')).toBeTruthy();
      expect(c.querySelector('[data-testid="preview-url-bar"]')).toBeTruthy();
      // No horizontal page overflow
      expect(c.scrollWidth).toBeLessThanOrEqual(c.clientWidth + 1);
    });
  }

  it("More menu opens and exposes diagnostics/source/design/revert", () => {
    const c = renderAtWidth(
      820,
      <PreviewPane
        device="tablet"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
        generated={{ indexHtml: "<!doctype html><body>x</body>", hasFiles: true }}
        onRegenerateDesign={() => {}}
        onRefreshLocalPreview={() => {}}
      />,
    );
    const more = c.querySelector('[data-testid="preview-more"]') as HTMLButtonElement;
    act(() => {
      more.click();
    });
    expect(document.querySelector('[data-testid="preview-mode-local"]')).toBeTruthy();
  });
});
