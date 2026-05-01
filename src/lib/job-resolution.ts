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
 * A failed job is "resolved" when:
 *   1. A newer succeeded job of the SAME type exists, OR
 *   2. Its error matches a known transient pattern AND a newer
 *      build.production has succeeded (runner was fixed).
 */
export function isFailedJobResolved(failed: Job, allJobs: Job[]): boolean {
  if (failed.status !== "failed") return false;
  const failedAt = ts(failed);

  const sameTypeSuccess = latestSucceededJob(allJobs, failed.type);
  if (sameTypeSuccess && ts(sameTypeSuccess) > failedAt) return true;

  const errText = failed.error ?? "";
  if (TRANSIENT_ERROR_PATTERNS.some((re) => re.test(errText))) {
    const buildSuccess = latestSucceededJob(allJobs, "build.production");
    if (buildSuccess && ts(buildSuccess) > failedAt) return true;
  }
  return false;
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
