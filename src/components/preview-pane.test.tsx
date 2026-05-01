// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
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

describe("PreviewPane", () => {
  it("renders iframe with deploy URL when activeDeployUrl is set", () => {
    const html = renderToStaticMarkup(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl="https://preview-abc.vercel.app"
      />,
    );
    expect(html).toContain("<iframe");
    expect(html).toContain('src="https://preview-abc.vercel.app/"');
    expect(html).toContain("https://preview-abc.vercel.app");
    expect(html).not.toContain("No deploy URL yet");
  });

  it("keeps the empty state when no deploy URL exists", () => {
    const html = renderToStaticMarkup(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
      />,
    );
    expect(html).toContain("No deploy URL yet");
    expect(html).toContain("Start a build");
    expect(html).not.toContain("<iframe");
  });

  it("clicking the external-open button opens the deploy URL in a new tab", () => {
    const url = "https://preview-xyz.vercel.app";
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const container = render(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={url}
      />,
    );
    const btn = container.querySelector(
      'button[aria-label="Open deploy URL in new tab"]',
    ) as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn!.disabled).toBe(false);
    act(() => {
      btn!.click();
    });
    expect(openSpy).toHaveBeenCalledWith(url, "_blank", "noopener");
  });

  it("disables the external-open button when no deploy URL exists", () => {
    const container = render(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
      />,
    );
    const btn = container.querySelector(
      'button[aria-label="Open deploy URL in new tab"]',
    ) as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn!.disabled).toBe(true);
  });

  it("shows the friendly fallback card after iframe failure and external-open still works", () => {
    vi.useFakeTimers();
    try {
      const url = "https://preview-blocked.vercel.app";
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      const container = render(
        <PreviewPane
          device="desktop"
          setDevice={() => {}}
          project={project}
          onStartBuild={() => {}}
          starting={false}
          selectedPage="/"
          activeDeployUrl={url}
        />,
      );
      // Trigger the failed state via the load timeout (covers the X-Frame
      // / CSP block scenario where the iframe never fires onload).
      act(() => {
        vi.advanceTimersByTime(8001);
      });
      const fallback = container.querySelector(
        '[data-testid="preview-iframe-fallback"]',
      ) as HTMLElement | null;
      expect(fallback).not.toBeNull();
      expect(fallback!.textContent).toContain("This app may block embedded preview.");
      const openBtn = container.querySelector(
        'button[aria-label="Open live preview"]',
      ) as HTMLButtonElement | null;
      expect(openBtn).not.toBeNull();
      act(() => {
        openBtn!.click();
      });
      expect(openSpy).toHaveBeenCalledWith(url, "_blank", "noopener");
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to the friendly card after the 8s iframe load timeout", () => {
    vi.useFakeTimers();
    try {
      const url = "https://preview-slow.vercel.app";
      const container = render(
        <PreviewPane
          device="desktop"
          setDevice={() => {}}
          project={project}
          onStartBuild={() => {}}
          starting={false}
          selectedPage="/"
          activeDeployUrl={url}
        />,
      );
      expect(
        container.querySelector('[data-testid="preview-iframe"]'),
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="preview-iframe-fallback"]'),
      ).toBeNull();
      act(() => {
        vi.advanceTimersByTime(8001);
      });
      expect(
        container.querySelector('[data-testid="preview-iframe-fallback"]'),
      ).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
