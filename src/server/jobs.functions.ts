// Client-callable server function. Runs server-side; verifies the caller's
// auth via the bearer token they send. Browser never executes provider work.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { runNextJobStepServer, type TickResult } from "./jobs-runner.server";

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
      return await runNextJobStepServer({ accessToken: token, projectId: data.projectId });
    } catch (e) {
      return { advanced: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
