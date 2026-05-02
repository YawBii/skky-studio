// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PreviewPane } from "./preview-pane";
import type { Project } from "@/services/projects";

const project: Project = {
  id: "p-mob", workspaceId: "w1", name: "Mobile Demo",
  slug: "mobile-demo", description: null, createdAt: "",
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => { try { window.localStorage.clear(); } catch { /* ignore */ } });
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  host?.remove(); host = null;
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

const VIEWPORTS = [320, 360, 390, 430, 768];

describe("PreviewPane — mobile responsive", () => {
  for (const w of VIEWPORTS) {
    it(`renders at ${w}px without removing key controls`, () => {
      const c = renderAtWidth(w, (
        <PreviewPane
          device="mobile"
          setDevice={() => {}}
          project={project}
          onStartBuild={() => {}}
          starting={false}
          selectedPage="/"
          activeDeployUrl={null}
          generated={{ indexHtml: "<!doctype html><title>t</title><body>ok</body>", hasFiles: true }}
          onRegenerateDesign={() => {}}
          onRefreshLocalPreview={() => {}}
        />
      ));
      // Toolbar exists, mode toggle present, iframe present.
      expect(c.querySelector('[data-testid="preview-mode-toggle"]')).toBeTruthy();
      expect(c.querySelector('[data-testid="preview-iframe"]')).toBeTruthy();
      // Regenerate + Refresh buttons reachable
      expect(c.querySelector('[data-testid="preview-regenerate-design"]')).toBeTruthy();
      expect(c.querySelector('[data-testid="preview-refresh-local"]')).toBeTruthy();
    });
  }

  it("toolbar wrapper is horizontally scrollable to avoid wrapping", () => {
    const c = renderAtWidth(320, (
      <PreviewPane
        device="mobile" setDevice={() => {}} project={project}
        onStartBuild={() => {}} starting={false} selectedPage="/"
        activeDeployUrl={null}
      />
    ));
    const toolbar = c.querySelector('[data-testid="preview-mode-toggle"]')?.parentElement;
    expect(toolbar?.className).toMatch(/overflow-x-auto/);
    expect(toolbar?.className).toMatch(/flex-nowrap/);
  });

  it("preview frame uses full width on mobile (max-width 100%)", () => {
    const c = renderAtWidth(390, (
      <PreviewPane
        device="mobile" setDevice={() => {}} project={project}
        onStartBuild={() => {}} starting={false} selectedPage="/"
        activeDeployUrl={null}
        generated={{ indexHtml: "<!doctype html><body>x</body>", hasFiles: true }}
      />
    ));
    const frame = c.querySelector('[data-testid="preview-device-frame"]') as HTMLElement;
    expect(frame).toBeTruthy();
    // 390px frame with maxWidth 100% means it fills the 320/390 container.
    expect(frame.style.maxWidth).toBe("100%");
  });
});
