// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MobileProjectPicker } from "./mobile-project-picker";
import type { Project } from "@/services/projects";

const navigateMock = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

// MobileBootstrapPanel pulls in auth/supabase — stub it out for these tests.
vi.mock("@/components/mobile-bootstrap-panel", () => ({
  MobileBootstrapPanel: () => null,
}));

function makeProjects(n: number): Project[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    workspaceId: "ws-1",
    name: `Project ${i}`,
    slug: `project-${i}`,
    description: null,
  }));
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  navigateMock.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  act(() => { root?.unmount(); });
  root = null;
  host?.remove();
  host = null;
  // Clean up any portals.
  document.body.innerHTML = "";
});

function render(ui: React.ReactNode) {
  act(() => {
    root = createRoot(host!);
    root.render(ui);
  });
}

describe("MobileProjectPicker", () => {
  it("renders 10 rows when given 10 projects (portal-mounted to body)", () => {
    const projects = makeProjects(10);
    render(
      <MobileProjectPicker
        open
        onOpenChange={() => {}}
        projects={projects}
        currentProjectId={projects[0].id}
        onSelect={() => {}}
      />,
    );
    const list = document.body.querySelector('[data-testid="mobile-project-picker-list"]');
    expect(list).toBeTruthy();
    const rows = document.body.querySelectorAll('[data-testid^="mobile-project-picker-item-"]');
    expect(rows.length).toBe(10);
  });

  it("does not autofocus the search input on mount", () => {
    const projects = makeProjects(3);
    render(
      <MobileProjectPicker open onOpenChange={() => {}} projects={projects} currentProjectId={null} onSelect={() => {}} />,
    );
    const search = document.body.querySelector('[data-testid="mobile-project-picker-search"]') as HTMLInputElement;
    expect(search).toBeTruthy();
    expect(document.activeElement).not.toBe(search);
  });

  it("filters rows by search query", () => {
    const projects = makeProjects(5);
    render(
      <MobileProjectPicker open onOpenChange={() => {}} projects={projects} currentProjectId={null} onSelect={() => {}} />,
    );
    const search = document.body.querySelector('[data-testid="mobile-project-picker-search"]') as HTMLInputElement;
    act(() => {
      search.value = "Project 2";
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const rows = document.body.querySelectorAll('[data-testid^="mobile-project-picker-item-"]');
    expect(rows.length).toBe(1);
  });

  it("tapping a row calls onSelect, navigates, and closes the picker", () => {
    const projects = makeProjects(3);
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <MobileProjectPicker
        open
        onOpenChange={onOpenChange}
        projects={projects}
        currentProjectId={null}
        onSelect={onSelect}
      />,
    );
    const target = projects[1];
    const btn = document.body.querySelector(
      `[data-testid="mobile-project-picker-item-${target.id}"]`,
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    act(() => { btn.click(); });
    expect(onSelect).toHaveBeenCalledWith(target.id);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/builder/$projectId",
      params: { projectId: target.id },
    });
  });

  it("uses z-[9999] and is fixed inset-0 above other UI", () => {
    render(
      <MobileProjectPicker open onOpenChange={() => {}} projects={makeProjects(1)} currentProjectId={null} onSelect={() => {}} />,
    );
    const root = document.body.querySelector('[data-testid="mobile-project-picker"]') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.className).toMatch(/fixed/);
    expect(root.className).toMatch(/inset-0/);
    expect(root.className).toMatch(/z-\[9999\]/);
  });

  it("never shows an empty state when projects.length > 0", () => {
    render(
      <MobileProjectPicker open onOpenChange={() => {}} projects={makeProjects(4)} currentProjectId={null} onSelect={() => {}} />,
    );
    expect(document.body.textContent).not.toMatch(/No projects returned/);
  });

  it("shows 'No matches' + Clear search when filter empties results", () => {
    render(
      <MobileProjectPicker open onOpenChange={() => {}} projects={makeProjects(3)} currentProjectId={null} onSelect={() => {}} />,
    );
    const search = document.body.querySelector('[data-testid="mobile-project-picker-search"]') as HTMLInputElement;
    act(() => {
      search.value = "zzznomatch";
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(document.body.textContent).toMatch(/No matches/);
    expect(document.body.textContent).toMatch(/Clear search/);
  });
});
