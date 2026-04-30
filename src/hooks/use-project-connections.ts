import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listConnections,
  type ConnectionsResult,
  type ConnectionProvider,
  type ProjectConnection,
} from "@/services/project-connections";

export function useProjectConnections(projectId: string | null | undefined) {
  const [result, setResult] = useState<ConnectionsResult>({ connections: [], source: "no-project" });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await listConnections(projectId ?? null);
    setResult(r);
    setLoading(false);
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.info("[yawb] project_connections source:", r.source, `count=${r.connections.length}`, r.error ?? "");
    }
    return r;
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

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
