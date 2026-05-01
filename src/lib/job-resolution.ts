// Shared helper to determine whether a failed job has been "resolved" by a
// newer succeeded job of the same type. Used to suppress stale failures from:
//   - Smart Suggestions ("Retry failed step")
//   - Command Center (Needs attention)
//   - Jobs panel (collapses old failures into "Resolved history")
//
// Also treats certain transient errors (e.g. "invalid bearer token") as
// resolved when any newer build.production succeeded — the runner was fixed.
import type { Job } from "@/services/jobs";

const TRANSIENT_ERROR_PATTERNS = [
  /invalid bearer token/i,
  /no bearer token/i,
];

function ts(j: Job): number {
  const t = Date.parse(j.createdAt);
  return Number.isFinite(t) ? t : 0;
}

/** Latest succeeded job of a given type (or any type if `type` omitted). */
export function latestSucceededJob(jobs: Job[], type?: string): Job | null {
  let best: Job | null = null;
  for (const j of jobs) {
    if (j.status !== "succeeded") continue;
    if (type && j.type !== type) continue;
    if (!best || ts(j) > ts(best)) best = j;
  }
  return best;
}

/** Latest failed job of a given type (or any type if `type` omitted). */
export function latestFailedJob(jobs: Job[], type?: string): Job | null {
  let best: Job | null = null;
  for (const j of jobs) {
    if (j.status !== "failed") continue;
    if (type && j.type !== type) continue;
    if (!best || ts(j) > ts(best)) best = j;
  }
  return best;
}

/**
 * Returns the succeeded Job that "resolves" a given failed job, or null.
 *  - Same-type success newer than the failure, OR
 *  - For transient runner/auth errors on build.production: the next successful
 *    build.production after it.
 */
export function getResolvingSuccess(failed: Job, allJobs: Job[]): Job | null {
  if (failed.status !== "failed") return null;
  const failedAt = ts(failed);

  const sameTypeSuccess = latestSucceededJob(allJobs, failed.type);
  if (sameTypeSuccess && ts(sameTypeSuccess) > failedAt) return sameTypeSuccess;

  const errText = failed.error ?? "";
  if (
    failed.type === "build.production" &&
    TRANSIENT_ERROR_PATTERNS.some((re) => re.test(errText))
  ) {
    const buildSuccess = latestSucceededJob(allJobs, "build.production");
    if (buildSuccess && ts(buildSuccess) > failedAt) return buildSuccess;
  }
  return null;
}

/**
 * A failed job is "resolved" when getResolvingSuccess returns a non-null Job.
 */
export function isFailedJobResolved(failed: Job, allJobs: Job[]): boolean {
  return getResolvingSuccess(failed, allJobs) !== null;
}

/** Partition failed jobs into active (needs attention) vs resolved (history). */
export function partitionFailures(jobs: Job[]): { activeFailed: Job[]; resolvedFailed: Job[] } {
  const activeFailed: Job[] = [];
  const resolvedFailed: Job[] = [];
  for (const j of jobs) {
    if (j.status !== "failed") continue;
    if (isFailedJobResolved(j, jobs)) resolvedFailed.push(j);
    else activeFailed.push(j);
  }
  return { activeFailed, resolvedFailed };
}

/** Group resolved failures by job type. Order preserved within each group. */
export function groupResolvedFailuresByType(jobs: Job[]): Map<string, Job[]> {
  const out = new Map<string, Job[]>();
  const { resolvedFailed } = partitionFailures(jobs);
  for (const j of resolvedFailed) {
    const arr = out.get(j.type) ?? [];
    arr.push(j);
    out.set(j.type, arr);
  }
  return out;
}

/**
 * Compute an "unresolved reason" for a failed job that explains why it is
 * still considered active (no newer same-type success).
 */
export function describeUnresolvedReason(failed: Job, allJobs: Job[]): string {
  if (failed.status !== "failed") return "Not a failed job.";
  const sameTypeSuccess = latestSucceededJob(allJobs, failed.type);
  if (!sameTypeSuccess) {
    return `No newer ${failed.type} success yet.`;
  }
  if (ts(sameTypeSuccess) <= ts(failed)) {
    return `Latest failure is newer than latest ${failed.type} success.`;
  }
  return "Failure is resolved.";
}
