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

describe("PreviewPane — local renders statically (no loading overlay)", () => {
  it("never renders preview-iframe-loading for local previews", () => {
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

  it("logs preview.local.render.static and never preview.iframe.loading for local", () => {
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
    const staticCalls = info.mock.calls.filter((c) => c[0] === "[yawb] preview.local.render.static");
    expect(staticCalls.length).toBeGreaterThan(0);
    const loadingCalls = info.mock.calls.filter((c) => c[0] === "[yawb] preview.iframe.loading");
    expect(loadingCalls.length).toBe(0);
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

  it("iframe key is stable for local (does not include filesApi.version) and content-based", () => {
    const c1 = render(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
        generated={{ indexHtml: "<!doctype html><title>x</title><body>same</body>", hasFiles: true }}
      />,
    );
    // We can't read React's internal key, but we can prove the iframe element
    // remains referentially the same across re-renders with identical content.
    const iframeBefore = c1.querySelector('[data-testid="preview-iframe"]');
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
          generated={{ indexHtml: "<!doctype html><title>x</title><body>same</body>", hasFiles: true }}
        />,
      );
    });
    const iframeAfter = c1.querySelector('[data-testid="preview-iframe"]');
    expect(iframeAfter).toBe(iframeBefore); // same DOM node => no remount
  });
});
