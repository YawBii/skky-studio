// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PreviewPane, parseDesignProof, DESIGN_ANGLE_KEY } from "./preview-pane";
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

describe("parseDesignProof", () => {
  it("extracts yawb-* meta tags from generated html", () => {
    const html = `<html><head>
      <meta name="yawb-design-mode" content="neon-command" />
      <meta name="yawb-hero-layout" content="command-terminal" />
      <meta name="yawb-palette" content="neon-violet" />
    </head></html>`;
    expect(parseDesignProof(html)).toEqual({
      designMode: "neon-command",
      heroLayout: "command-terminal",
      palette: "neon-violet",
    });
  });
  it("returns nulls when no meta tags are present", () => {
    expect(parseDesignProof("<html></html>")).toEqual({
      designMode: null,
      heroLayout: null,
      palette: null,
    });
  });
});

describe("PreviewPane — Design Angle selector", () => {
  it("renders the design angle <select> with all 7 options", () => {
    const c = render(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
        onRegenerateDesign={() => {}}
      />,
    );
    const sel = c.querySelector('[data-testid="preview-design-angle"]') as HTMLSelectElement;
    expect(sel).toBeTruthy();
    expect(sel.querySelectorAll("option")).toHaveLength(7);
  });

  it("regenerate payload includes the selected designMode", () => {
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
      />,
    );
    const sel = c.querySelector('[data-testid="preview-design-angle"]') as HTMLSelectElement;
    act(() => {
      sel.value = "neon-command";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const btn = c.querySelector('[data-testid="preview-regenerate-design"]') as HTMLButtonElement;
    act(() => {
      btn.click();
    });
    expect(onRegenerate).toHaveBeenCalledWith("neon-command");
    expect(window.localStorage.getItem(DESIGN_ANGLE_KEY(project.id))).toBe("neon-command");
  });

  it("displays the design proof pill", () => {
    const c = render(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
        onRegenerateDesign={() => {}}
      />,
    );
    const pill = c.querySelector('[data-testid="preview-design-pill"]') as HTMLDivElement;
    expect(pill).toBeTruthy();
    expect(pill.textContent).toContain("Design:");
  });

  it("restores the persisted angle from localStorage", () => {
    window.localStorage.setItem(DESIGN_ANGLE_KEY(project.id), "brutalist-data");
    const c = render(
      <PreviewPane
        device="desktop"
        setDevice={() => {}}
        project={project}
        onStartBuild={() => {}}
        starting={false}
        selectedPage="/"
        activeDeployUrl={null}
        onRegenerateDesign={() => {}}
      />,
    );
    const sel = c.querySelector('[data-testid="preview-design-angle"]') as HTMLSelectElement;
    expect(sel.value).toBe("brutalist-data");
  });
});
