// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PreviewPane } from "./preview-pane";
import type { Project } from "@/services/projects";

const project: Project = {
  id: "p-rl",
  workspaceId: "w1",
  name: "Demo",
  slug: "demo",
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
  vi.restoreAllMocks();
});

function render(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
}

describe("PreviewPane — Regenerate design is one-shot, Refresh local is manual", () => {
  it("Regenerate design calls onRegenerateDesign exactly once and never refresh", () => {
    const onRegenerate = vi.fn();
    const onRefresh = vi.fn();
    const c = render(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
        onRegenerateDesign={onRegenerate}
        onRefreshLocalPreview={onRefresh}
        regenerating={false}
      />,
    );
    const btn = c.querySelector('[data-testid="preview-regenerate-design"]') as HTMLButtonElement;
    act(() => {
      btn.click();
    });
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("Refresh local preview calls onRefreshLocalPreview exactly once and never regenerate", () => {
    const onRegenerate = vi.fn();
    const onRefresh = vi.fn();
    const c = render(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
        onRegenerateDesign={onRegenerate}
        onRefreshLocalPreview={onRefresh}
      />,
    );
    const btn = c.querySelector('[data-testid="preview-refresh-local"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    act(() => {
      btn.click();
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  it("local preview iframe DOM node does not remount when generated.indexHtml is unchanged", () => {
    const html = "<!doctype html><title>x</title><body>same</body>";
    const c = render(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
        generated={{ indexHtml: html, hasFiles: true }}
      />,
    );
    const before = c.querySelector('[data-testid="preview-iframe"]');
    // re-render with identical generated content
    act(() => {
      root!.render(
        <PreviewPane
          device="desktop"
          setDevice={() => {}}
          project={project}
          onStartBuild={() => {}}
          starting={false}
          selectedPage="/"
          activeDeployUrl={null}
          generated={{ indexHtml: html, hasFiles: true }}
        />,
      );
    });
    const after = c.querySelector('[data-testid="preview-iframe"]');
    expect(after).toBe(before);
  });

  it("local preview never renders preview-iframe-loading", () => {
    const c = render(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
        generated={{ indexHtml: "<!doctype html><title>x</title><body>ok</body>", hasFiles: true }}
      />,
    );
    expect(c.querySelector('[data-testid="preview-iframe-loading"]')).toBeNull();
  });
});
