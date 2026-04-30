import { useEffect, useState, useCallback } from "react";
import { listWorkspaces, type Workspace, type WorkspacesResult } from "@/services/workspaces";
import { useAuth } from "@/hooks/use-auth";

const LS_CURRENT = "yawb:current-workspace-id";

function readCurrent(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(LS_CURRENT); } catch { return null; }
}
function writeCurrent(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(LS_CURRENT, id);
    else window.localStorage.removeItem(LS_CURRENT);
  } catch {}
}

export function useWorkspaces() {
  const { session, loading: authLoading } = useAuth();
  const [result, setResult] = useState<WorkspacesResult>({ workspaces: [], source: "demo-empty" });
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(readCurrent());

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await listWorkspaces();
    setResult(r);
    setLoading(false);
    return r;
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, session?.userId, refresh]);

  // Reconcile selected workspace with available list.
  useEffect(() => {
    if (loading) return;
    const ids = new Set(result.workspaces.map((w) => w.id));
    if (currentId && ids.has(currentId)) return;
    const next = result.workspaces[0]?.id ?? null;
    setCurrentId(next);
    writeCurrent(next);
  }, [loading, result.workspaces, currentId]);

  const select = useCallback((id: string) => {
    setCurrentId(id);
    writeCurrent(id);
  }, []);

  const current: Workspace | null =
    result.workspaces.find((w) => w.id === currentId) ?? result.workspaces[0] ?? null;

  return {
    workspaces: result.workspaces,
    current,
    source: result.source,
    isReal: result.source === "supabase",
    isEmpty: result.source === "demo-empty" && result.workspaces.length === 0,
    loading,
    select,
    refresh,
  };
}
