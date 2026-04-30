// Public build-runner endpoint conforming to the yawB BuildRunner contract.
//
// POST /api/public/build-runner
// Headers:
//   Authorization: Bearer <BUILD_RUNNER_TOKEN>   (required if BUILD_RUNNER_TOKEN env is set)
//   Content-Type:  application/json
// Body (JSON):
//   { command: string, kind: "build" | "typecheck", jobId: string, stepId: string, projectId: string }
// Response (JSON):
//   { ok: boolean, exitCode: number | null, stdout: string, stderr: string, durationMs: number, error: string | null }
//
// NOTE: the Lovable serverless Worker runtime does NOT support spawning child
// processes. When this route runs on Worker, it returns ok=false with a clear
// remediation error. To get real builds, host this same route on a Node server
// (or a small custom worker) and point yawB's BUILD_RUNNER_URL at that host.
// See docs/build-runner.md for a minimal Node reference implementation.

import { createFileRoute } from "@tanstack/react-router";

interface BuildRunnerRequest {
  command: string;
  kind: "build" | "typecheck" | string;
  jobId: string;
  stepId: string;
  projectId: string;
}
interface BuildRunnerResponse {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  error: string | null;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

function json(status: number, body: BuildRunnerResponse | { error: string }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function tail(s: string, n = 4000): string {
  return s.length <= n ? s : s.slice(s.length - n);
}

function validate(body: unknown): { ok: true; data: BuildRunnerRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body must be a JSON object" };
  const b = body as Record<string, unknown>;
  for (const k of ["command", "kind", "jobId", "stepId", "projectId"] as const) {
    if (typeof b[k] !== "string" || (b[k] as string).length === 0) {
      return { ok: false, error: `field "${k}" is required and must be a non-empty string` };
    }
    if ((b[k] as string).length > 4096) {
      return { ok: false, error: `field "${k}" exceeds 4096 chars` };
    }
  }
  return { ok: true, data: b as unknown as BuildRunnerRequest };
}

async function runCommand(command: string): Promise<BuildRunnerResponse> {
  const startedAt = Date.now();
  try {
    // Dynamic import so the Worker bundler does not eagerly resolve native bindings.
    const cp = await import("node:child_process");
    return await new Promise<BuildRunnerResponse>((resolve) => {
      try {
        const child = cp.spawn(command, { shell: true });
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (d) => { stdout += d.toString(); });
        child.stderr?.on("data", (d) => { stderr += d.toString(); });
        child.on("error", (err) => {
          resolve({
            ok: false, exitCode: null, stdout: tail(stdout), stderr: tail(stderr),
            durationMs: Date.now() - startedAt,
            error: err instanceof Error ? err.message : String(err),
          });
        });
        child.on("close", (code) => {
          resolve({
            ok: code === 0,
            exitCode: code,
            stdout: tail(stdout),
            stderr: tail(stderr),
            durationMs: Date.now() - startedAt,
            error: code === 0 ? null : `command exited with code ${code}`,
          });
        });
      } catch (err) {
        resolve({
          ok: false, exitCode: null, stdout: "", stderr: "",
          durationMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const unsupported = /unenv|not implemented|child_process/i.test(msg);
    return {
      ok: false, exitCode: null, stdout: "", stderr: "",
      durationMs: Date.now() - startedAt,
      error: unsupported
        ? "Build runner requires an external worker. The Lovable serverless runtime cannot spawn child processes. Host this endpoint on a Node server and set BUILD_RUNNER_URL to point at it. See docs/build-runner.md."
        : msg,
    };
  }
}

export const Route = createFileRoute("/api/public/build-runner")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const expectedToken = process.env.BUILD_RUNNER_TOKEN;
        if (expectedToken) {
          const auth = request.headers.get("authorization") ?? "";
          const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
          if (token !== expectedToken) {
            return json(401, {
              ok: false, exitCode: null, stdout: "", stderr: "",
              durationMs: 0, error: "invalid or missing bearer token",
            });
          }
        }
        let parsed: unknown;
        try { parsed = await request.json(); }
        catch { return json(400, { ok: false, exitCode: null, stdout: "", stderr: "", durationMs: 0, error: "invalid JSON body" }); }
        const v = validate(parsed);
        if (!v.ok) {
          return json(400, { ok: false, exitCode: null, stdout: "", stderr: "", durationMs: 0, error: v.error });
        }
        const result = await runCommand(v.data.command);
        return json(result.ok ? 200 : 502, result);
      },
    },
  },
});
