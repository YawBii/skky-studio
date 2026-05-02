// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MobileBootstrapPanel } from "./mobile-bootstrap-panel";
import { AuthProvider } from "@/hooks/use-auth";

let mockSession: { userId: string; email: string; displayName: string } | null = null;

vi.mock("@/services/auth", () => ({
  getSession: () => Promise.resolve(mockSession),
  onAuthChange: () => Promise.resolve(() => {}),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
  },
  getSupabaseDiagnostics: () => ({
    hasUrl: true, hasKey: true, urlHost: "test.supabase.co",
    isPlaceholder: false, ok: true,
  }),
}));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => { mockSession = null; try { window.localStorage.clear(); } catch { /* ignore */ } });
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  host?.remove(); host = null;
});

function render(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<AuthProvider>{node}</AuthProvider>));
  return host;
}

describe("MobileBootstrapPanel", () => {
  it("renders all required diagnostic rows", () => {
    const c = render(
      <MobileBootstrapPanel
        membershipsCount={0}
        selectedWorkspaceId={null}
        projectsCount={0}
        activeProjectId={null}
        urlProjectId="abc-123"
        lastError="boom"
      />,
    );
    expect(c.querySelector('[data-testid="mobile-bootstrap-panel"]')).toBeTruthy();
    const keys = [
      "authLoading", "hasSession", "userId", "userEmail",
      "selectedWorkspaceId", "workspaceSource", "workspacesCount", "projectsCount",
      "projectsSource", "activeProjectId", "routeProjectId", "supabaseUrlProjectRef",
      "latestWorkspaceMembersError", "latestProjectsQueryError", "lastSupabaseError",
    ];
    for (const k of keys) {
      expect(
        c.querySelector(`[data-testid="mbp-${k}-value"]`),
        `missing row ${k}`,
      ).toBeTruthy();
    }
    expect(c.querySelector('[data-testid="mbp-routeProjectId-value"]')?.textContent).toBe("abc-123");
    expect(c.querySelector('[data-testid="mbp-lastSupabaseError-value"]')?.textContent).toBe("boom");
    expect(c.querySelector('[data-testid="mbp-supabaseUrlProjectRef-value"]')?.textContent).toBe("test.supabase.co / test");
  });

  it("highlights hasSession=false and lastSupabaseError as error tone", () => {
    const c = render(<MobileBootstrapPanel lastError="rls denied" />);
    const session = c.querySelector('[data-testid="mbp-hasSession-value"]') as HTMLElement;
    const err = c.querySelector('[data-testid="mbp-lastSupabaseError-value"]') as HTMLElement;
    expect(session.className).toMatch(/text-destructive/);
    expect(err.className).toMatch(/text-destructive/);
  });

  it("hasSession=false shows sign-in state", () => {
    const c = render(<MobileBootstrapPanel projectsCount={0} workspacesCount={0} />);
    expect(c.querySelector('[data-testid="mobile-bootstrap-state-title"]')?.textContent).toBe("Not signed in on this device");
    expect(c.querySelector('[data-testid="mobile-bootstrap-sign-in"]')).toBeTruthy();
  });

  it("workspace_members empty shows membership debug state", () => {
    mockSession = { userId: "user-1", email: "user@example.com", displayName: "User" };
    const c = render(<MobileBootstrapPanel workspacesCount={0} projectsCount={0} />);
    expect(c.textContent).toContain("No workspace membership found for this account");
  });

  it("projects query empty shows projects debug state when workspace exists", () => {
    mockSession = { userId: "user-1", email: "user@example.com", displayName: "User" };
    const c = render(<MobileBootstrapPanel selectedWorkspaceId="workspace-1" workspacesCount={1} projectsCount={0} />);
    expect(c.textContent).toContain("Workspace found but no projects returned");
    expect(c.textContent).toContain("workspace-1");
  });
});
