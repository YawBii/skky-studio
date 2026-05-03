// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ProviderLinksPanel } from "./provider-links-panel";
import type { ProjectConnection } from "@/services/project-connections";

// Simulated project_connections rows for ujob: one healthy active GitHub link,
// one healthy active Vercel link, and many disconnected historical Vercel rows
// that previously polluted the warning count.
const ujob: ProjectConnection[] = [
  {
    id: "gh-active",
    projectId: "ujob",
    workspaceId: "w1",
    provider: "github",
    status: "connected",
    repoFullName: "YawBii/ujob",
    repoUrl: "https://github.com/YawBii/ujob",
    defaultBranch: "main",
    metadata: {},
    createdBy: "u1",
    createdAt: "",
    updatedAt: "",
    externalId: "gh-1",
    url: null,
    tokenOwnerType: "workspace",
    providerAccountId: null,
  },
  {
    id: "vc-active",
    projectId: "ujob",
    workspaceId: "w1",
    provider: "vercel",
    status: "connected",
    repoFullName: "YawBii/ujob",
    repoUrl: null,
    defaultBranch: null,
    metadata: {},
    createdBy: "u1",
    createdAt: "",
    updatedAt: "",
    externalId: "vc-current",
    url: "https://ujob.vercel.app",
    tokenOwnerType: "workspace",
    providerAccountId: null,
  },
  ...Array.from({ length: 5 }).map((_, i) => ({
    id: `vc-old-${i}`,
    projectId: "ujob",
    workspaceId: "w1",
    provider: "vercel" as const,
    status: "disconnected" as const,
    repoFullName: "YawBii/ujob",
    repoUrl: null,
    defaultBranch: null,
    metadata: {},
    createdBy: "u1",
    createdAt: "",
    updatedAt: "",
    externalId: `vc-old-${i}`,
    url: null,
    tokenOwnerType: "workspace" as const,
    providerAccountId: null,
  })),
];

vi.mock("@/services/project-connections", async () => {
  const actual = await vi.importActual<typeof import("@/services/project-connections")>(
    "@/services/project-connections",
  );
  return {
    ...actual,
    listConnections: vi.fn(async () => ({ connections: ujob, source: "supabase" as const })),
  };
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  if (host) host.remove();
  root = null;
  host = null;
});

async function render() {
  await act(async () => {
    root = createRoot(host!);
    root.render(<ProviderLinksPanel projectId="ujob" workspaceId="w1" />);
  });
  // flush the hook's async refresh
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("ProviderLinksPanel — ujob disconnected history", () => {
  it("warning count excludes disconnected rows; panel shows healthy", async () => {
    await render();
    const text = host!.textContent ?? "";
    // 5 disconnected rows must NOT trigger 5 warnings.
    expect(text).not.toMatch(/5 warnings/);
    expect(text).not.toMatch(/status is "disconnected"/);
    expect(text).toContain("healthy");
  });

  it("active proof timeline shows both active rows; inactive history is collapsed by default", async () => {
    await render();
    const text = host!.textContent ?? "";
    // Active proof rows render their connection IDs.
    expect(text).toContain("gh-active");
    expect(text).toContain("vc-active");
    // Inactive history toggle is present with the historical count, but the
    // historical rows themselves are NOT rendered until expanded.
    expect(text).toContain("Inactive link history (5)");
    expect(text).not.toContain("vc-old-0");
  });

  it("clicking the inactive history toggle reveals the historical rows", async () => {
    await render();
    const buttons = Array.from(host!.querySelectorAll("button"));
    const toggle = buttons.find((b) => b.textContent?.includes("Inactive link history"));
    expect(toggle).toBeDefined();
    await act(async () => {
      toggle!.click();
    });
    const text = host!.textContent ?? "";
    expect(text).toContain("vc-old-0");
    expect(text).toContain("vc-old-4");
  });
});
