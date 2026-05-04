// Verify endpoint: forwards to an external runner if YAWB_BUILD_RUNNER_URL is
// configured, otherwise returns a heuristic-only response so the agentic loop
// has a stable shape to call. This is the "runner-later" hook.
//
// POST /api/public/verify
// Body: { command: string, kind: "build"|"typecheck", jobId: string, stepId: string, projectId: string }

import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

interface VerifyResponse {
  ok: boolean;
  mode: "external-runner" | "heuristic-stub";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  error: string | null;
}

function json(status: number, body: VerifyResponse | { error: string }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/verify")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(400, {
            ok: false,
            mode: "heuristic-stub",
            exitCode: null,
            stdout: "",
            stderr: "",
            durationMs: 0,
            error: "invalid JSON body",
          });
        }
        const runnerUrl = process.env.YAWB_BUILD_RUNNER_URL;
        const runnerToken = process.env.BUILD_RUNNER_TOKEN;
        if (!runnerUrl) {
          return json(200, {
            ok: true,
            mode: "heuristic-stub",
            exitCode: 0,
            stdout:
              "verify: heuristic-only mode. Set YAWB_BUILD_RUNNER_URL to enable real tsc/build runs.",
            stderr: "",
            durationMs: 0,
            error: null,
          });
        }
        const startedAt = Date.now();
        try {
          const upstream = await fetch(runnerUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(runnerToken ? { Authorization: `Bearer ${runnerToken}` } : {}),
            },
            body: JSON.stringify(body),
          });
          const text = await upstream.text();
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(text) as Record<string, unknown>;
          } catch {
            parsed = { stdout: text };
          }
          return json(upstream.ok ? 200 : 502, {
            ok: Boolean(parsed.ok ?? upstream.ok),
            mode: "external-runner",
            exitCode: (parsed.exitCode as number | null) ?? null,
            stdout: String(parsed.stdout ?? ""),
            stderr: String(parsed.stderr ?? ""),
            durationMs:
              (parsed.durationMs as number | undefined) ?? Date.now() - startedAt,
            error: (parsed.error as string | null) ?? (upstream.ok ? null : `runner ${upstream.status}`),
          });
        } catch (err) {
          return json(502, {
            ok: false,
            mode: "external-runner",
            exitCode: null,
            stdout: "",
            stderr: "",
            durationMs: Date.now() - startedAt,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    },
  },
});
