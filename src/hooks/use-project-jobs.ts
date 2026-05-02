// React hook around the jobs service. Provides list state, a runner ticker
// (polls `tickJobs` while there is active work), and stable action helpers.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  enqueueJob,
  cancelJob,
  retryJob,
  retryStep,
  listJobs,
  listJobSteps,
  listJobQuestions,
  listJobStepAttempts,
  answerJobQuestion,
  tickJobs,
  reportProviderConnections,
  type Job,
  type JobStep,
  type JobQuestion,
  type JobsSource,
  type JobType,
  type StepAttempt,
} from "@/services/jobs";

const TICK_MS = 1500;
const IDLE_REFRESH_MS = 2500;

export function useProjectJobs(
  projectId: string | null | undefined,
  workspaceId: string | null | undefined,
) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [source, setSource] = useState<JobsSource>("no-project");
  const [error, setError] = useState<string | null>(null);
  const [sqlFile, setSqlFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stepsByJob, setStepsByJob] = useState<Record<string, JobStep[]>>({});
  const [questionsByJob, setQuestionsByJob] = useState<Record<string, JobQuestion[]>>({});
  const [attemptsByJob, setAttemptsByJob] = useState<Record<string, StepAttempt[]>>({});
  const [lastTick, setLastTick] = useState<{
    advanced: boolean;
    jobId?: string;
    stepKey?: string;
    status?: string;
    error?: string;
    questionId?: string;
    cancelled?: boolean;
  } | null>(null);
  const [ticking, setTicking] = useState(false);
  const tickingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setJobs([]);
      setSource("no-project");
      return;
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

  const refreshQuestions = useCallback(async (jobId: string) => {
    const r = await listJobQuestions(jobId);
    setQuestionsByJob((prev) => ({ ...prev, [jobId]: r.questions }));
  }, []);

  const refreshAttempts = useCallback(async (jobId: string) => {
    const r = await listJobStepAttempts(jobId);
    setAttemptsByJob((prev) => ({ ...prev, [jobId]: r.attempts }));
  }, []);

  // Driver: keep polling while the project is open. This is intentionally
  // not limited to the current `jobs` array being active, because chat sends
  // call enqueueJob() directly and then render a queued summary before this
  // hook has refreshed. The idle refresh catches those newly queued jobs and
  // the next loop triggers the server runner.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = setTimeout(loop, ms);
    };

    const loop = async () => {
      if (cancelled || !projectId) return;
      const latest = await listJobs(projectId);
      if (cancelled) return;
      setJobs(latest.jobs);
      setSource(latest.source);
      setError(latest.error ?? null);
      setSqlFile(latest.sqlFile ?? null);
      void reportProviderConnections(projectId);

      const hasActive = latest.jobs.some((j) => j.status === "queued" || j.status === "running");
      if (!hasActive) {
        setTicking(false);
        tickingRef.current = false;
        schedule(IDLE_REFRESH_MS);
        return;
      }
      if (tickingRef.current) {
        schedule(TICK_MS);
        return;
      }
      tickingRef.current = true;
      setTicking(true);
      const r = await tickJobs(projectId);
      setLastTick(r);
      tickingRef.current = false;
      if (cancelled) return;
      if (r.jobId) {
        await refreshSteps(r.jobId);
        await refreshQuestions(r.jobId);
        await refreshAttempts(r.jobId);
      }
      schedule(TICK_MS);
    };

    void loop();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, refreshSteps, refreshQuestions, refreshAttempts]);

  // Initial load + when project changes.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enqueue = useCallback(
    async (input: { type: JobType | string; title: string; input?: Record<string, unknown> }) => {
      if (!projectId || !workspaceId) return { ok: false as const, error: "No project selected" };
      const r = await enqueueJob({ projectId, workspaceId, ...input });
      if (r.ok) {
        await refresh();
        await refreshSteps(r.job.id);
      }
      return r;
    },
    [projectId, workspaceId, refresh, refreshSteps],
  );

  const cancel = useCallback(
    async (jobId: string) => {
      const r = await cancelJob(jobId);
      await refresh();
      await refreshSteps(jobId);
      await refreshAttempts(jobId);
      return r;
    },
    [refresh, refreshSteps, refreshAttempts],
  );

  const retry = useCallback(
    async (jobId: string) => {
      const r = await retryJob(jobId);
      await refresh();
      await refreshSteps(jobId);
      await refreshAttempts(jobId);
      return r;
    },
    [refresh, refreshSteps, refreshAttempts],
  );

  const retryOneStep = useCallback(
    async (jobId: string, stepId: string) => {
      const r = await retryStep({ jobId, stepId });
      await refresh();
      await refreshSteps(jobId);
      await refreshAttempts(jobId);
      return r;
    },
    [refresh, refreshSteps, refreshAttempts],
  );

  const answer = useCallback(
    async (input: {
      questionId: string;
      jobId: string;
      stepId: string | null;
      answer: unknown;
      skipped?: boolean;
    }) => {
      const r = await answerJobQuestion(input);
      await refresh();
      await refreshSteps(input.jobId);
      await refreshQuestions(input.jobId);
      return r;
    },
    [refresh, refreshSteps, refreshQuestions],
  );

  return {
    jobs,
    source,
    error,
    sqlFile,
    loading,
    ticking,
    lastTick,
    stepsByJob,
    questionsByJob,
    attemptsByJob,
    refresh,
    refreshSteps,
    refreshQuestions,
    refreshAttempts,
    enqueue,
    cancel,
    retry,
    retryStep: retryOneStep,
    answer,
  };
}
