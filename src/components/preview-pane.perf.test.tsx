// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PreviewPane } from "./preview-pane";
import type { Project } from "@/services/projects";
import { perfCounters } from "@/lib/perf-mode";

const project: Project = {
  id: "p-perf",
  workspaceId: "w1",
  name: "Perf Demo",
  slug: "perf-demo",
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
  // Force iPad-like width so isTabletOrMobile() returns true.
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  perfCounters.iframeReloads = 0;
});

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
  host?.remove();
  host = null;
});

function render(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
}

describe("PreviewPane — perf mode (iPad)", () => {
  it("shows skeleton and does not mount preview iframe while a job is running", () => {
    const c = render(
      <PreviewPane
        device="tablet"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
        generated={{ indexHtml: "<!doctype html><body>x</body>", hasFiles: true }}
        jobRunning
      />,
    );
    expect(c.querySelector('[data-testid="preview-job-skeleton"]')).toBeTruthy();
    expect(c.querySelector('[data-testid="preview-iframe"]')).toBeNull();
  });

  it("only reloads iframe once per file content change, not on every render", () => {
    const props = {
      device: "tablet" as const,
      setDevice: () => {},
      project,
      onStartBuild: () => {},
      starting: false,
      selectedPage: "/",
      activeDeployUrl: null,
      generated: { indexHtml: "<!doctype html><body>v1</body>", hasFiles: true },
    };
    render(<PreviewPane {...props} />);
    const initial = perfCounters.iframeReloads;
    // Re-render with identical content — should NOT increment reloads.
    act(() => root!.render(<PreviewPane {...props} />));
    act(() => root!.render(<PreviewPane {...props} />));
    expect(perfCounters.iframeReloads).toBe(initial);
    // Re-render with new content — exactly one new reload.
    act(() =>
      root!.render(
        <PreviewPane
          {...props}
          generated={{ indexHtml: "<!doctype html><body>v2</body>", hasFiles: true }}
        />,
      ),
    );
    expect(perfCounters.iframeReloads).toBe(initial + 1);
  });
});
