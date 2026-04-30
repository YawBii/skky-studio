// Client-callable server function. Runs server-side; verifies the caller's
// auth via the bearer token they send. Browser never executes provider work.
//
// NOTE: both the server runtime util and the runner are imported dynamically
// inside the handler so neither `@tanstack/react-start/server` nor any
// `.server.ts` module appears as a static import in the client bundle —
// TanStack import-protection forbids both from client-reachable modules.
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
