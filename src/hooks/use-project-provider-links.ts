// Reads project-level provider connections (GitHub/Vercel) and runs the
// consistency checker. The result is the canonical "is this project linked?"
// source for builder/deploy UIs — provider-list lookups are supplemental only.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { listConnections, type ProjectConnection } from "@/services/project-connections";
import {
  checkProjectConnectionConsistency,
  type ConsistencyResult,
} from "@/lib/connection-consistency";

export interface ProviderLinksState {
  connections: ProjectConnection[];
  github: ProjectConnection | null;
  vercel: ProjectConnection | null;
  consistency: ConsistencyResult | null;
  lastRefreshAt: string | null;
  loading: boolean;
  error: string | null;
}

const empty: ProviderLinksState = {
  connections: [],
  github: null,
  vercel: null,
  consistency: null,
  lastRefreshAt: null,
  loading: false,
  error: null,
};

export function useProjectProviderLinks(
  projectId: string | null | undefined,
  workspaceId: string | null | undefined,
) {
  const [state, setState] = useState<ProviderLinksState>(empty);

  const refresh = useCallback(
    async (opts?: { silent?: boolean; toastOnComplete?: boolean }) => {
      if (!projectId) {
        setState(empty);
        return { ok: false as const, error: "No current project" };
      }
      if (!opts?.silent) setState((s) => ({ ...s, loading: true, error: null }));
      const r = await listConnections(projectId);
      if (r.source === "error" || r.source === "table-missing") {
        const err = r.error ?? "project_connections could not be loaded";
        setState((s) => ({ ...s, loading: false, error: err }));
        if (opts?.toastOnComplete) toast.error(`Links refresh failed — ${err}`);
        return { ok: false as const, error: err };
      }
      const consistency = checkProjectConnectionConsistency(projectId, workspaceId, r.connections);
      const github = r.connections.find((c) => c.provider === "github") ?? null;
      const vercel = r.connections.find((c) => c.provider === "vercel") ?? null;
      const lastRefreshAt = new Date().toISOString();
      setState({
        connections: r.connections,
        github,
        vercel,
        consistency,
        lastRefreshAt,
        loading: false,
        error: null,
      });
      if (opts?.toastOnComplete) {
        if (consistency.errors.length) {
          toast.error(`Links refresh failed — ${consistency.errors[0]}`);
        } else if (consistency.warnings.length) {
          toast.warning(`Links refreshed — ${consistency.warnings[0]}`);
        } else {
          const linked = [github && "GitHub", vercel && "Vercel"].filter(Boolean).join(" and ");
          toast.success(
            linked
              ? `Links refreshed — ${linked} ${linked.includes("and") ? "are" : "is"} connected`
              : "Links refreshed — no provider connections yet",
          );
        }
      }
      return { ok: true as const, connections: r.connections, consistency };
    },
    [projectId, workspaceId],
  );

  useEffect(() => {
    void refresh({ silent: false });
  }, [refresh]);

  const isGithubLinked = useMemo(
    () => !!state.github && state.github.status === "connected",
    [state.github],
  );
  const isVercelLinked = useMemo(
    () => !!state.vercel && state.vercel.status === "connected",
    [state.vercel],
  );

  return { ...state, isGithubLinked, isVercelLinked, refresh };
}
