import type { Job } from "@/services/jobs";

export const ACTIVE_JOB_STATUSES = new Set(["queued", "running", "waiting_for_input"]);
export const PREVIEW_JOB_TYPES = new Set(["ai.generate_changes", "ai.repair_failure", "build.production"]);
export const STALE_QUEUED_JOB_MS = 90_000;
export const STALE_PREVIEW_QUEUED_JOB_MS = 20_000;
export const STALE_RUNNING_JOB_MS = 5 * 60_000;

export interface VisualQualityBlock {
  jobId: string;
  failedGates: string[];
  error?: string | null;
}

export interface StaleJobBlock {
  jobId: string;
  reason: "queued_timeout" | "running_timeout";
  ageMs: number;
}

function jobAgeMs(job: Job, now = Date.now()): number {
  const anchor = job.status === "running" && job.startedAt ? job.startedAt : job.createdAt;
  const parsed = Date.parse(anchor);
  return Number.isFinite(parsed) ? now - parsed : 0;
}

function queuedTimeoutFor(job: Job): number {
  return PREVIEW_JOB_TYPES.has(job.type) ? STALE_PREVIEW_QUEUED_JOB_MS : STALE_QUEUED_JOB_MS;
}

export function isStaleActiveJob(job: Job, now = Date.now()): StaleJobBlock | null {
  if (!ACTIVE_JOB_STATUSES.has(job.status)) return null;
  const ageMs = jobAgeMs(job, now);
  if (job.status === "queued" && ageMs > queuedTimeoutFor(job)) {
    return { jobId: job.id, reason: "queued_timeout", ageMs };
  }
  if (job.status === "running" && ageMs > STALE_RUNNING_JOB_MS) {
    return { jobId: job.id, reason: "running_timeout", ageMs };
  }
  return null;
}

export function getStaleActiveJobs(jobs: Job[], now = Date.now()): StaleJobBlock[] {
  return jobs.flatMap((job) => {
    const stale = isStaleActiveJob(job, now);
    return stale ? [stale] : [];
  });
}

export function hasActiveJob(jobs: Job[]): boolean {
  return jobs.some((j) => ACTIVE_JOB_STATUSES.has(j.status) && !isStaleActiveJob(j));
}

export function isVisualQualityFailure(job: Job): boolean {
  if (!PREVIEW_JOB_TYPES.has(job.type) || job.status !== "failed") return false;
  const output = (job.output ?? {}) as Record<string, unknown>;
  const checks = (output.visualQuality as { checks?: unknown[] } | undefined)?.checks;
  const failedChecks = Array.isArray(checks)
    ? checks.filter((c) => (c as { passed?: unknown }).passed === false)
    : [];
  const failedGates = Array.isArray(output.failedGates) ? output.failedGates : [];
  return (
    failedChecks.length > 0 ||
    failedGates.length > 0 ||
    /visualQuality|visual quality|failed gates|Needs repair/i.test(job.error ?? "")
  );
}

export function getVisualQualityBlock(_jobs: Job[]): VisualQualityBlock | null {
  // Visual-quality failures should be warnings, not hard blockers.
  // The previous hard block caused this deadlock:
  // failed preview -> Preview blocked -> Repair preview queues a job -> active job blocks repair -> project trapped.
  // yawB should keep showing the latest local preview and let regenerate/repair continue.
  return null;
}
