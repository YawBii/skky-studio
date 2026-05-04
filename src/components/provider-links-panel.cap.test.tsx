// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ConsistencyProofEntry } from "@/lib/connection-consistency";
import { ProviderLinksPanel } from "./provider-links-panel";

// Build a synthetic project_connections result with 100 disconnected rows so
// we can prove the inactive history is capped/collapsed by default.
const manyInactive = Array.from({ length: 100 }).map((_, i) => ({
  id: `vc-old-${i}`,
  projectId: "p1",
  workspaceId: "w1",
  provider: "vercel" as const,
  status: "disconnected" as const,
  repoFullName: null,
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
}));

vi.mock("@/services/project-connections", async () => {
  const actual = await vi.importActual<typeof import("@/services/project-connections")>(
    "@/services/project-connections",
  );
  return {
    ...actual,
    listConnections: vi.fn(async () => ({
      connections: manyInactive,
      source: "supabase" as const,
    })),
  };
});

// Make sure we still type-check ConsistencyProofEntry import path used elsewhere.
const _typeProbe: ConsistencyProofEntry | null = null;
void _typeProbe;

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
    root.render(<ProviderLinksPanel projectId="p1" workspaceId="w1" />);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("ProviderLinksPanel — inactive history capping", () => {
  it("collapses 100 inactive rows and only renders 10 after expanding", async () => {
    await render();
    let text = host!.textContent ?? "";
    expect(text).toContain("Inactive link history (100)");
    // Not expanded by default — no individual rows rendered.
    expect(text).not.toContain("vc-old-50");

    // Expand the toggle.
    const toggle = Array.from(host!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Inactive link history"),
    );
    await act(async () => toggle!.click());
    text = host!.textContent ?? "";

    // Capped to first 10 rows.
    expect(text).toContain("vc-old-0");
    expect(text).toContain("vc-old-9");
    expect(text).not.toContain("vc-old-10");
    expect(text).toContain("+90 more inactive links");

    // Click "show all".
    const showAll = Array.from(host!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("show all history"),
    );
    await act(async () => showAll!.click());
    text = host!.textContent ?? "";
    expect(text).toContain("vc-old-99");
  });
});
