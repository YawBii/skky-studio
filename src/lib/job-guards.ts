import type { Job } from "@/services/jobs";

export const ACTIVE_JOB_STATUSES = new Set(["queued", "running", "waiting_for_input"]);
export const PREVIEW_JOB_TYPES = new Set(["ai.generate_changes", "build.production"]);

export interface VisualQualityBlock {
  jobId: string;
  failedGates: string[];
  error?: string | null;
}

export function hasActiveJob(jobs: Job[]): boolean {
  return jobs.some((j) => ACTIVE_JOB_STATUSES.has(j.status));
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

export function getVisualQualityBlock(jobs: Job[]): VisualQualityBlock | null {
  const previewJobs = [...jobs]
    .filter((j) => PREVIEW_JOB_TYPES.has(j.type))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const failed = previewJobs.find(isVisualQualityFailure);
  if (!failed) return null;
  const newerSuccess = previewJobs.find(
    (j) => j.status === "succeeded" && Date.parse(j.createdAt) > Date.parse(failed.createdAt),
  );
  if (newerSuccess) return null;

  const output = (failed.output ?? {}) as Record<string, unknown>;
  const failedGates = Array.isArray(output.failedGates)
    ? output.failedGates.filter((v): v is string => typeof v === "string")
    : Array.isArray((output.visualQuality as { checks?: unknown[] } | undefined)?.checks)
      ? (
          output.visualQuality as {
            checks: Array<{ passed?: unknown; label?: unknown; detail?: unknown }>;
          }
        ).checks
          .filter((c) => c.passed === false)
          .map((c) => `${String(c.label ?? "Visual quality")}: ${String(c.detail ?? "failed")}`)
      : [];

  return {
    jobId: failed.id,
    failedGates: failedGates.length > 0 ? failedGates : [failed.error || "Visual quality failed"],
    error: failed.error,
  };
}
