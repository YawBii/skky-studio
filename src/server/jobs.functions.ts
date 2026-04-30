// Client-callable server function. Runs server-side; verifies the caller's
// auth via the bearer token they send. Browser never executes provider work.
//
// NOTE: the runner is imported dynamically inside the handler so the
// `.server.ts` module never appears as a static import in the client bundle
// (TanStack import-protection forbids `.server.*` imports from client-reachable
// modules, even when the handler body is stripped).
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

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
    const auth = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    const token = auth?.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : null;
    if (!token) {
      return { advanced: false, error: "Not authenticated (no bearer token)." };
    }
    try {
      const { runNextJobStepServer } = await import("./jobs-runner.server");
      return await runNextJobStepServer({ accessToken: token, projectId: data.projectId });
    } catch (e) {
      return { advanced: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
