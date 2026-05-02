// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PreviewPane } from "./preview-pane";
import type { Project } from "@/services/projects";

const project: Project = {
  id: "p-loading",
  workspaceId: "w1",
  name: "Demo",
  slug: "demo",
  description: null,
  createdAt: "",
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  try { window.localStorage.clear(); } catch { /* ignore */ }
  // happy-dom provides requestAnimationFrame; ensure deterministic behavior.
  if (!("requestAnimationFrame" in window)) {
    (window as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number }).requestAnimationFrame =
      (cb) => setTimeout(() => cb(0), 0) as unknown as number;
  }
});

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
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

async function flushFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      const raf = (window as unknown as { requestAnimationFrame?: (cb: FrameRequestCallback) => number })
        .requestAnimationFrame;
      if (raf) raf(() => resolve());
      else setTimeout(resolve, 16);
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

describe("PreviewPane — local loading overlay", () => {
  it("does not show loading overlay for local srcDoc preview after a frame", async () => {
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
    await flushFrame();
    expect(c.querySelector('[data-testid="preview-iframe-loading"]')).toBeNull();
  });

  it("logs preview.local.loaded for local previews without onLoad firing", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    render(
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
    await flushFrame();
    const calls = info.mock.calls.filter((c) => c[0] === "[yawb] preview.local.loaded");
    expect(calls.length).toBeGreaterThan(0);
    expect((calls[0][1] as { hasSrcDoc: boolean }).hasSrcDoc).toBe(true);
  });

  it("live preview still shows loading overlay until iframe load fires", () => {
    const c = render(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl="https://live.vercel.app"
      />,
    );
    expect(c.querySelector('[data-testid="preview-iframe-loading"]')).not.toBeNull();
  });
});
