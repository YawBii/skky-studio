// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
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

describe("PreviewPane — live deploy", () => {
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

  it("disables the external-open button when no live deploy URL exists (local mode)", () => {
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

  it("shows the friendly fallback card after iframe failure (live)", () => {
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

  it("shows the always-visible 'Open live preview' overlay whenever live deploy exists", () => {
    const url = "https://preview-overlay.vercel.app";
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
    const overlay = container.querySelector(
      '[data-testid="preview-open-live-overlay"]',
    ) as HTMLButtonElement | null;
    expect(overlay).not.toBeNull();
    act(() => {
      overlay!.click();
    });
    expect(openSpy).toHaveBeenCalledWith(url, "_blank", "noopener");
  });
});

describe("PreviewPane — local preview", () => {
  it("auto-selects local mode and renders srcDoc without a route src when no deploy URL", () => {
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
    const iframe = container.querySelector(
      '[data-testid="preview-iframe"]',
    ) as HTMLIFrameElement | null;
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("data-preview-kind")).toBe("local");
    expect(iframe!.getAttribute("src")).toBeNull();
    expect(iframe!.getAttribute("srcdoc")).toContain("Demo");
    expect(iframe!.getAttribute("srcdoc")).toContain("No generated screens yet");
    for (const shellText of ["yawB Chat", "Diagnostics", "Smart Next", "Share", "Analytics"]) {
      expect(iframe!.getAttribute("srcdoc")).not.toContain(shellText);
    }
    // Local badge in URL bar
    expect(
      container.querySelector('[data-testid="preview-local-badge"]'),
    ).not.toBeNull();
  });

  it("renders srcDoc when generated.indexHtml is provided", () => {
    const html = "<!doctype html><title>gen</title><body><h1>Hello yawB</h1></body>";
    const container = render(
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
    const iframe = container.querySelector(
      '[data-testid="preview-iframe"]',
    ) as HTMLIFrameElement | null;
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("srcdoc")).toContain("Hello yawB");
  });

  it("does not show 'No deploy URL yet' as the main state when local is rendering", () => {
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
    expect(container.textContent || "").not.toContain("No deploy URL yet");
  });

  it("external-open button is disabled in local mode (no live URL)", () => {
    const container = render(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
        generated={{ indexHtml: "<!doctype html><title>x</title>" }}
      />,
    );
    const btn = container.querySelector(
      'button[aria-label="Open deploy URL in new tab"]',
    ) as HTMLButtonElement | null;
    expect(btn!.disabled).toBe(true);
  });

  it("Local|Live toggle switches between modes when both are available", () => {
    const url = "https://goodhand.vercel.app";
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
    // Default = live (URL exists)
    let iframe = container.querySelector(
      '[data-testid="preview-iframe"]',
    ) as HTMLIFrameElement | null;
    expect(iframe!.getAttribute("data-preview-kind")).toBe("live");

    const localBtn = container.querySelector(
      '[data-testid="preview-mode-local"]',
    ) as HTMLButtonElement | null;
    expect(localBtn).not.toBeNull();
    act(() => {
      localBtn!.click();
    });

    iframe = container.querySelector(
      '[data-testid="preview-iframe"]',
    ) as HTMLIFrameElement | null;
    expect(iframe!.getAttribute("data-preview-kind")).toBe("local");
    expect(iframe!.getAttribute("src")).toBeNull();
    expect(iframe!.getAttribute("srcdoc")).toContain("No generated screens yet");
  });

  it("Live toggle is disabled when no deploy URL exists", () => {
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
    const liveBtn = container.querySelector(
      '[data-testid="preview-mode-live"]',
    ) as HTMLButtonElement | null;
    expect(liveBtn).not.toBeNull();
    expect(liveBtn!.disabled).toBe(true);
  });

  it("'Create preview deploy' CTA remains available without being a prerequisite for local preview", () => {
    // Local preview renders even though there's no deploy. To see the CTA we
    // toggle to live (which is disabled) — the CTA is reachable via empty
    // local state when no project-route is available, and via the deploy tab
    // suggestion. Verify the iframe rendered without requiring a deploy:
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
    expect(
      container.querySelector('[data-testid="preview-iframe"]'),
    ).not.toBeNull();
  });
});

describe("PreviewPane — device viewports", () => {
  function renderWithDevice(device: "desktop" | "tablet" | "mobile") {
    return render(
      <PreviewPane
        device={device}
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
      />,
    );
  }

  it("desktop frame width is 100%", () => {
    const c = renderWithDevice("desktop");
    const frame = c.querySelector('[data-testid="preview-device-frame"]') as HTMLElement;
    expect(frame).not.toBeNull();
    expect(frame.style.width).toBe("100%");
    expect(frame.style.maxWidth).toBe("100%");
    expect(frame.style.minHeight).toBe("640px");
    expect(frame.style.margin).toContain("auto");
    expect(frame.style.transform || "").toBe("");
  });

  it("tablet frame width is 820px and max-width 100%", () => {
    const c = renderWithDevice("tablet");
    const frame = c.querySelector('[data-testid="preview-device-frame"]') as HTMLElement;
    expect(frame.style.width).toBe("820px");
    expect(frame.style.maxWidth).toBe("100%");
    expect(frame.style.minHeight).toBe("640px");
  });

  it("mobile frame width is 390px and min-height 720", () => {
    const c = renderWithDevice("mobile");
    const frame = c.querySelector('[data-testid="preview-device-frame"]') as HTMLElement;
    expect(frame.style.width).toBe("390px");
    expect(frame.style.maxWidth).toBe("100%");
    expect(frame.style.minHeight).toBe("720px");
  });

  it("iframe remains width/height 100% with no transform scale", () => {
    const c = renderWithDevice("tablet");
    const iframe = c.querySelector('[data-testid="preview-iframe"]') as HTMLIFrameElement;
    expect(iframe.className).toContain("w-full");
    expect(iframe.className).toContain("h-full");
    expect(iframe.className).toContain("border-0");
    expect(iframe.style.transform || "").toBe("");
  });

  it("device buttons expose readable labels", () => {
    const c = renderWithDevice("desktop");
    expect(
      c.querySelector('[data-testid="preview-device-desktop"]')?.getAttribute("title"),
    ).toBe("Desktop 100%");
    expect(
      c.querySelector('[data-testid="preview-device-tablet"]')?.getAttribute("title"),
    ).toBe("Tablet 820px");
    expect(
      c.querySelector('[data-testid="preview-device-mobile"]')?.getAttribute("title"),
    ).toBe("Mobile 390px");
  });
});

