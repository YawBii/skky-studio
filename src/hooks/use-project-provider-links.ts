// Reads project-level provider connections (GitHub/Vercel) and runs the
// consistency checker. Lazy by default: only fetches when explicitly enabled
// AND a real projectId/workspaceId is present. This stops freeze-causing
// background polling from mounted-but-hidden surfaces.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { listConnections, type ProjectConnection } from "@/services/project-connections";
import {
  checkProjectConnectionConsistency,
  type ConsistencyResult,
} from "@/lib/connection-consistency";
import { isSafeMode, noteFetchCall } from "@/lib/perf-mode";

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

export interface UseProjectProviderLinksOptions {
  /** Only fetch when true. Defaults to true for back-compat, but callers
   * (panels, popovers) should pass an explicit visibility flag. */
  enabled?: boolean;
}

export function useProjectProviderLinks(
  projectId: string | null | undefined,
  workspaceId: string | null | undefined,
  options: UseProjectProviderLinksOptions = {},
) {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<ProviderLinksState>(empty);
  // Stable workspaceId capture so refresh's identity does not flip every render
  // when callers pass a freshly-derived value.
  const workspaceIdRef = useRef(workspaceId);
  workspaceIdRef.current = workspaceId;

  const active = enabled && !isSafeMode() && !!projectId;

  const refresh = useCallback(
    async (opts?: { silent?: boolean; toastOnComplete?: boolean }) => {
      if (!active || !projectId) {
        setState(empty);
        return { ok: false as const, error: "No current project" };
      }
      noteFetchCall(`useProjectProviderLinks:${projectId}`);
      if (!opts?.silent) setState((s) => ({ ...s, loading: true, error: null }));
      const r = await listConnections(projectId);
      if (r.source === "error" || r.source === "table-missing") {
        const err = r.error ?? "project_connections could not be loaded";
        setState((s) => ({ ...s, loading: false, error: err }));
        if (opts?.toastOnComplete) toast.error(`Links refresh failed — ${err}`);
        return { ok: false as const, error: err };
      }
      const consistency = checkProjectConnectionConsistency(
        projectId,
        workspaceIdRef.current,
        r.connections,
      );
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
    [active, projectId],
  );

  useEffect(() => {
    if (!active) {
      // Reset to idle whenever we become disabled.
      setState((s) => (s === empty ? s : empty));
      return;
    }
    let cancelled = false;
    void (async () => {
      const before = await refresh({ silent: false });
      if (cancelled) {
        // Ignore late state set — refresh already wrote, but parent may have
        // unmounted. Nothing actionable here, kept for clarity.
        void before;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, refresh]);

  const isGithubLinked = useMemo(
    () => !!state.github && state.github.status === "connected",
    [state.github],
  );
  const isVercelLinked = useMemo(
    () => !!state.vercel && state.vercel.status === "connected",
    [state.vercel],
  );

  return { ...state, isGithubLinked, isVercelLinked, refresh, enabled: active };
}
