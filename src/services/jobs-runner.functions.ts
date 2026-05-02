import { createServerFn } from "@tanstack/react-start";

export interface TickResult {
  advanced: boolean;
  jobId?: string;
  stepKey?: string;
  status?: "succeeded" | "failed" | "skipped" | "waiting_for_input";
  error?: string;
  questionId?: string;
}

export const runNextJobStep = createServerFn({ method: "POST" })
  .inputValidator((data: { projectId: string }) => {
    if (!data || typeof data.projectId !== "string" || data.projectId.length === 0) {
      throw new Error("projectId is required");
    }
    return { projectId: data.projectId };
  })
  .handler(async ({ data }): Promise<TickResult> => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const auth = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    const accessToken = auth?.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : null;
    if (!accessToken) {
      return { advanced: false, error: "Not authenticated." };
    }
    try {
      const { runNextJobStepServer } = await import("../server/monster-jobs-runner.server");
      return await runNextJobStepServer({ accessToken, projectId: data.projectId });
    } catch (e) {
      return { advanced: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
