import { useEffect, useState, useCallback } from "react";
import { listWorkspaces, type Workspace, type WorkspacesResult } from "@/services/workspaces";
import { useAuth } from "@/hooks/use-auth";
import { setDiag } from "@/lib/diagnostics";
import { readCurrentWorkspaceId, readDirectWorkspace, writeCurrentWorkspaceId } from "@/lib/project-selection";

export function useWorkspaces() {
  const { session, loading: authLoading } = useAuth();
  const [result, setResult] = useState<WorkspacesResult>({ workspaces: [], source: "demo-empty" });
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(readCurrentWorkspaceId());

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await listWorkspaces();
    setResult(r);
    setLoading(false);
    setDiag({
      hasSession: !!session,
      userId: session?.userId ?? null,
      workspacesCount: r.workspaces.length,
      workspaceSource: r.source,
    });
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.info("[yawb] workspaces source:", r.source, r.error ? `(${r.error})` : "", `count=${r.workspaces.length}`);
    }
    return r;
  }, [session]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, session?.userId, refresh]);

  useEffect(() => {
    const onSelection = () => setCurrentId(readCurrentWorkspaceId());
    const onBootstrap = () => setCurrentId(readCurrentWorkspaceId());
    window.addEventListener("yawb:selection-changed", onSelection as EventListener);
    window.addEventListener("yawb:project-bootstrap", onBootstrap as EventListener);
    return () => {
      window.removeEventListener("yawb:selection-changed", onSelection as EventListener);
      window.removeEventListener("yawb:project-bootstrap", onBootstrap as EventListener);
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const ids = new Set(result.workspaces.map((w) => w.id));
    if (currentId && ids.has(currentId)) return;
    const direct = readDirectWorkspace();
    const next = direct?.id ?? result.workspaces[0]?.id ?? null;
    setCurrentId(next);
    writeCurrentWorkspaceId(next);
  }, [loading, result.workspaces, currentId]);

  const select = useCallback((id: string) => {
    setCurrentId(id);
    writeCurrentWorkspaceId(id);
  }, []);

  const current: Workspace | null =
    result.workspaces.find((w) => w.id === currentId) ??
    (readDirectWorkspace()?.id === currentId ? { ...readDirectWorkspace()!, role: null } : null) ??
    result.workspaces[0] ?? null;

  return {
    workspaces: result.workspaces,
    current,
    source: result.source,
    error: result.error,
    isReal: result.source === "supabase" || !!readDirectWorkspace(),
    // Both "no rows" and "query failed" should drop the user into the empty
    // state instead of silently showing the Skky Group demo.
    isEmpty:
      (result.source === "demo-empty" || result.source === "error") &&
      result.workspaces.length === 0,
    isError: result.source === "error",
    loading,
    select,
    refresh,
  };
}
