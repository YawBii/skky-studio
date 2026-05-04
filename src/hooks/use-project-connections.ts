import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listConnections,
  type ConnectionsResult,
  type ConnectionProvider,
  type ProjectConnection,
} from "@/services/project-connections";
import { isSafeMode, noteFetchCall } from "@/lib/perf-mode";

interface UseProjectConnectionsOptions {
  enabled?: boolean;
}

export function useProjectConnections(
  projectId: string | null | undefined,
  options: UseProjectConnectionsOptions = {},
) {
  const enabled = (options.enabled ?? true) && !isSafeMode();
  const [result, setResult] = useState<ConnectionsResult>({
    connections: [],
    source: "no-project",
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled || !projectId) {
      setResult({ connections: [], source: "no-project" });
      setLoading(false);
      return { connections: [], source: "no-project" } satisfies ConnectionsResult;
    }
    setLoading(true);
    noteFetchCall(`useProjectConnections:${projectId}`);
    const r = await listConnections(projectId ?? null);
    setResult(r);
    setLoading(false);
    if (typeof window !== "undefined") {
      console.info(
        "[yawb] project_connections source:",
        r.source,
        `count=${r.connections.length}`,
        r.error ?? "",
      );
    }
    return r;
  }, [enabled, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byProvider = useMemo(() => {
    const map = new Map<ConnectionProvider, ProjectConnection>();
    for (const c of result.connections) if (!map.has(c.provider)) map.set(c.provider, c);
    return map;
  }, [result.connections]);

  return {
    connections: result.connections,
    byProvider,
    source: result.source,
    error: result.error,
    sqlFile: result.sqlFile,
    isTableMissing: result.source === "table-missing",
    isError: result.source === "error",
    isEmpty: result.source === "empty",
    loading,
    refresh,
  };
}
