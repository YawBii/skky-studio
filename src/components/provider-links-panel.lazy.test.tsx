// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ProviderLinksPanel } from "./provider-links-panel";

const listConnectionsMock = vi.fn(async () => ({
  connections: [],
  source: "empty" as const,
}));

vi.mock("@/services/project-connections", async () => {
  const actual = await vi.importActual<typeof import("@/services/project-connections")>(
    "@/services/project-connections",
  );
  return {
    ...actual,
    listConnections: (...args: unknown[]) => listConnectionsMock(...(args as [])),
  };
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  listConnectionsMock.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  if (host) host.remove();
  root = null;
  host = null;
  try {
    window.localStorage.removeItem("yawb:safe-mode");
  } catch {
    /* noop */
  }
});

async function render(node: React.ReactNode) {
  await act(async () => {
    root = createRoot(host!);
    root.render(node);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("ProviderLinksPanel — lazy fetch gating", () => {
  it("does NOT call listConnections when enabled=false", async () => {
    await render(<ProviderLinksPanel projectId="p1" workspaceId="w1" enabled={false} />);
    expect(listConnectionsMock).not.toHaveBeenCalled();
  });

  it("does NOT call listConnections without projectId", async () => {
    await render(<ProviderLinksPanel projectId={null} workspaceId="w1" />);
    expect(listConnectionsMock).not.toHaveBeenCalled();
  });

  it("does NOT call listConnections without workspaceId", async () => {
    await render(<ProviderLinksPanel projectId="p1" workspaceId={null} />);
    expect(listConnectionsMock).not.toHaveBeenCalled();
  });

  it("does NOT call listConnections in safe mode", async () => {
    window.localStorage.setItem("yawb:safe-mode", "1");
    await render(<ProviderLinksPanel projectId="p1" workspaceId="w1" />);
    expect(listConnectionsMock).not.toHaveBeenCalled();
    const text = host!.textContent ?? "";
    expect(text).toContain("safe mode");
  });

  it("DOES call listConnections exactly once when fully enabled", async () => {
    await render(<ProviderLinksPanel projectId="p1" workspaceId="w1" />);
    expect(listConnectionsMock).toHaveBeenCalledTimes(1);
  });
});
