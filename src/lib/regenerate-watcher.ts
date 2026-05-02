// Pure helper used by the builder route to react to a regenerate-design job
// reaching a terminal state. Keeping it isolated makes the wiring testable
// without standing up the whole route.
export type RegenerateJobLike = {
  id: string;
  status: "queued" | "running" | "waiting_for_input" | "succeeded" | "failed" | "cancelled";
  error?: string | null;
};

export type RegenerateOutcome =
  | { kind: "pending" }
  | { kind: "missing" }
  | { kind: "succeeded" }
  | { kind: "failed"; message: string };

export function regenerateOutcome(
  jobs: RegenerateJobLike[],
  jobId: string | null,
): RegenerateOutcome {
  if (!jobId) return { kind: "pending" };
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return { kind: "missing" };
  if (job.status === "succeeded") return { kind: "succeeded" };
  if (job.status === "failed" || job.status === "cancelled") {
    return { kind: "failed", message: job.error || "Regenerate design failed" };
  }
  return { kind: "pending" };
}
