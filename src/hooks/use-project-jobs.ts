// React hook around the jobs service. Provides list state, a runner ticker
// (polls `tickJobs` while there is active work), and stable action helpers.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  enqueueJob,
  cancelJob,
  retryJob,
  listJobs,
  listJobSteps,
  tickJobs,
  reportProviderConnections,
  type Job,
  type JobStep,
  type JobsSource,
  type JobType,
} from "@/services/jobs";

const TICK_MS = 1500;

export function useProjectJobs(projectId: string | null | undefined, workspaceId: string | null | undefined) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [source, setSource] = useState<JobsSource>("no-project");
  const [error, setError] = useState<string | null>(null);
  const [sqlFile, setSqlFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stepsByJob, setStepsByJob] = useState<Record<string, JobStep[]>>({});
  const [ticking, setTicking] = useState(false);
  const tickingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setJobs([]); setSource("no-project"); return;
    }
    setLoading(true);
    const r = await listJobs(projectId);
    setJobs(r.jobs);
    setSource(r.source);
    setError(r.error ?? null);
    setSqlFile(r.sqlFile ?? null);
    setLoading(false);
    void reportProviderConnections(projectId);
  }, [projectId]);

  const refreshSteps = useCallback(async (jobId: string) => {
    const r = await listJobSteps(jobId);
    setStepsByJob((prev) => ({ ...prev, [jobId]: r.steps }));
  }, []);

  // Driver: while there are queued/running jobs, keep ticking.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = async () => {
      if (cancelled || !projectId) return;
      const hasActive = jobs.some((j) => j.status === "queued" || j.status === "running");
      if (!hasActive) { setTicking(false); tickingRef.current = false; return; }
      if (tickingRef.current) return;
      tickingRef.current = true;
      setTicking(true);
      const r = await tickJobs(projectId);
      tickingRef.current = false;
      if (cancelled) return;
      // Refresh affected job's steps + the job list (for status changes).
      if (r.jobId) await refreshSteps(r.jobId);
      await refresh();
      timer = setTimeout(loop, TICK_MS);
    };

    void loop();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [projectId, jobs, refresh, refreshSteps]);

  // Initial load + when project changes.
  useEffect(() => { void refresh(); }, [refresh]);

  const enqueue = useCallback(async (input: { type: JobType | string; title: string; input?: Record<string, unknown> }) => {
    if (!projectId || !workspaceId) return { ok: false as const, error: "No project selected" };
    const r = await enqueueJob({ projectId, workspaceId, ...input });
    if (r.ok) {
      await refresh();
      await refreshSteps(r.job.id);
    }
    return r;
  }, [projectId, workspaceId, refresh, refreshSteps]);

  const cancel = useCallback(async (jobId: string) => {
    const r = await cancelJob(jobId);
    await refresh();
    await refreshSteps(jobId);
    return r;
  }, [refresh, refreshSteps]);

  const retry = useCallback(async (jobId: string) => {
    const r = await retryJob(jobId);
    await refresh();
    await refreshSteps(jobId);
    return r;
  }, [refresh, refreshSteps]);

  return {
    jobs, source, error, sqlFile, loading, ticking,
    stepsByJob, refresh, refreshSteps,
    enqueue, cancel, retry,
  };
}
