// Hook wrapper around runProviderAutoLink. Lazy & gated — only runs when:
//   - explicitly enabled
//   - we have a real project + workspace
//   - we have a session (caller responsibility — gate via auth)
//   - we are not in safe mode
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { runProviderAutoLink, type AutoLinkResult } from "@/services/provider-auto-link";
import { isSafeMode, noteFetchCall } from "@/lib/perf-mode";
import type { Project } from "@/services/projects";

export interface UseProviderAutoLinkOptions {
  enabled?: boolean;
  /** Only auto-run on first activation. Manual refresh always runs. */
  autoRun?: boolean;
  skipIfAlreadyLinked?: boolean;
}

export interface UseProviderAutoLinkState {
  result: AutoLinkResult | null;
  running: boolean;
  error: string | null;
  refresh: (opts?: { toast?: boolean }) => Promise<AutoLinkResult | null>;
}

export function useProviderAutoLink(
  project: Project | null | undefined,
  workspaceId: string | null | undefined,
  options: UseProviderAutoLinkOptions = {},
): UseProviderAutoLinkState {
  const { enabled = true, autoRun = true, skipIfAlreadyLinked = true } = options;
  const [result, setResult] = useState<AutoLinkResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAutoRun = useRef<string | null>(null);

  const active = enabled && !isSafeMode() && !!project && !!workspaceId;

  const refresh = useCallback(
    async (opts?: { toast?: boolean }) => {
      if (!project || !workspaceId) return null;
      setRunning(true);
      setError(null);
      noteFetchCall(`useProviderAutoLink:${project.id}`);
      try {
        const r = await runProviderAutoLink({
          project,
          workspaceId,
          skipIfAlreadyLinked: opts?.toast ? false : skipIfAlreadyLinked,
        });
        setResult(r);
        if (opts?.toast) {
          const matched = [r.github, r.vercel, r.supabase]
            .filter((x) => x.outcome === "match")
            .map((x) => x.provider);
          if (matched.length) toast.success(`Linked: ${matched.join(", ")}`);
          else toast.message("Provider auto-link complete — no new matches");
        }
        return r;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        if (opts?.toast) toast.error(`Auto-link failed: ${msg}`);
        return null;
      } finally {
        setRunning(false);
      }
    },
    [project, workspaceId, skipIfAlreadyLinked],
  );

  useEffect(() => {
    if (!active || !autoRun || !project) return;
    if (hasAutoRun.current === project.id) return;
    hasAutoRun.current = project.id;
    void refresh();
  }, [active, autoRun, project, refresh]);

  return { result, running, error, refresh };
}
