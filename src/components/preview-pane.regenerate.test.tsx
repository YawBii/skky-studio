// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PreviewPane } from "./preview-pane";
import type { Project } from "@/services/projects";

const project: Project = {
  id: "p1",
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

describe("PreviewPane — Regenerate design button", () => {
  it("invokes onRegenerateDesign when clicked", () => {
    const onRegenerate = vi.fn();
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
        regenerating={false}
      />,
    );
    const btn = c.querySelector('[data-testid="preview-regenerate-design"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
    act(() => {
      btn.click();
    });
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("button is disabled and shows spinner while regenerating", () => {
    const onRegenerate = vi.fn();
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
        regenerating={true}
      />,
    );
    const btn = c.querySelector('[data-testid="preview-regenerate-design"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
    expect(btn.querySelector("svg")).toBeTruthy(); // Loader2 icon
    act(() => {
      btn.click();
    });
    expect(onRegenerate).not.toHaveBeenCalled();
  });
});
