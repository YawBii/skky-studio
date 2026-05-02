// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: supabaseMock.from },
}));

vi.mock("@/lib/diagnostics", () => ({
  setDiag: vi.fn(),
  pushDiag: vi.fn(),
}));

describe("mobile bootstrap project loading", () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it("non-UUID demo-workspace never queries projects table", async () => {
    const { listProjects } = await import("./projects");
    const result = await listProjects("demo-workspace");

    expect(result).toEqual({ projects: [], source: "no-workspace" });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("mobile /builder/:projectId loads project by id before workspace list", async () => {
    const projectId = "11111111-1111-4111-8111-111111111111";
    const workspaceId = "22222222-2222-4222-8222-222222222222";
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: projectId,
        workspace_id: workspaceId,
        name: "Goodhand",
        slug: "goodhand",
        description: null,
        created_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    supabaseMock.from.mockReturnValue({ select });

    const { getProjectById } = await import("./projects");
    const result = await getProjectById(projectId);

    expect(supabaseMock.from).toHaveBeenCalledWith("projects");
    expect(eq).toHaveBeenCalledWith("id", projectId);
    expect(result.project?.workspaceId).toBe(workspaceId);
    expect(result.project?.name).toBe("Goodhand");
  });
});