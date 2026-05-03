# yawB Build Runner

The yawB job runner delegates `build.typecheck` and `build.production` step
execution to an external HTTP worker. The Lovable serverless runtime
(Cloudflare Worker with `nodejs_compat`) cannot spawn child processes, so real
builds must run on a Node host that you control.

## Contract

`POST {BUILD_RUNNER_URL}`

### Request headers

```
Content-Type: application/json
Authorization: Bearer {BUILD_RUNNER_TOKEN}   # required if BUILD_RUNNER_TOKEN is set
```

### Request body

```json
{
  "command": "npm run build",
  "kind": "build", // "build" | "typecheck"
  "jobId": "uuid",
  "stepId": "uuid",
  "projectId": "uuid"
}
```

### Response body

```json
{
  "ok": true,
  "exitCode": 0,
  "stdout": "...", // trimmed to a tail; safe to truncate to ~4KB
  "stderr": "...",
  "durationMs": 1234,
  "error": null // string when ok=false
}
```

The yawB step is marked **succeeded** only when `ok === true`. There is no
mock fallback.

## Configuration

Set these env vars on the yawB Lovable project (server-side):

| Variable                | Required             | Description                                                           |
| ----------------------- | -------------------- | --------------------------------------------------------------------- |
| `BUILD_RUNNER_URL`      | yes                  | Full URL of your build runner worker                                  |
| `BUILD_RUNNER_TOKEN`    | strongly recommended | Shared bearer token; the runner sends `Authorization: Bearer <token>` |
| `BUILD_COMMAND`         | optional             | Override the default `npm run build`                                  |
| `TYPECHECK_COMMAND`     | optional             | Override the default `npm run typecheck`                              |
| `BUILD_PREVIEW_COMMAND` | optional             | Override the default preview/start command                            |

The runner diagnostics block in the Jobs panel surfaces presence-only flags:
`hasBuildRunnerUrl`, `hasBuildRunnerToken`, `mode` (`external` | `local` | `none`).
Secret values are never returned to the client.

## In-app reference endpoint

This project ships `/api/public/build-runner` which implements the exact
contract above. On the Lovable serverless runtime it cannot spawn processes
and will return a clear remediation error. It is useful as:

1. A **contract reference** for your own worker.
2. A **drop-in worker** when this route is hosted on a real Node server.

## Minimal external worker (Node 20+)

Save as `worker.mjs` on a host that has the project checked out and that can
run your build command:

```js
import http from "node:http";
import { spawn } from "node:child_process";

const PORT = process.env.PORT ?? 8787;
const TOKEN = process.env.BUILD_RUNNER_TOKEN ?? "";

function tail(s, n = 4000) {
  return s.length <= n ? s : s.slice(s.length - n);
}

function runCommand(command, cwd) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, { shell: true, cwd });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) =>
      resolve({
        ok: false,
        exitCode: null,
        stdout: tail(stdout),
        stderr: tail(stderr),
        durationMs: Date.now() - startedAt,
        error: err.message,
      }),
    );
    child.on("close", (code) =>
      resolve({
        ok: code === 0,
        exitCode: code,
        stdout: tail(stdout),
        stderr: tail(stderr),
        durationMs: Date.now() - startedAt,
        error: code === 0 ? null : `command exited with code ${code}`,
      }),
    );
  });
}

http
  .createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }
    if (TOKEN) {
      const auth = req.headers["authorization"] ?? "";
      const t = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      if (t !== TOKEN) {
        res
          .writeHead(401, { "content-type": "application/json" })
          .end(JSON.stringify({ ok: false, error: "invalid bearer token" }));
        return;
      }
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res
        .writeHead(400, { "content-type": "application/json" })
        .end(JSON.stringify({ ok: false, error: "invalid JSON body" }));
      return;
    }

    const required = ["command", "kind", "jobId", "stepId", "projectId"];
    for (const k of required) {
      if (typeof payload[k] !== "string" || !payload[k]) {
        res
          .writeHead(400, { "content-type": "application/json" })
          .end(JSON.stringify({ ok: false, error: `field "${k}" is required` }));
        return;
      }
    }

    const result = await runCommand(payload.command, process.env.BUILD_CWD);
    res
      .writeHead(result.ok ? 200 : 502, { "content-type": "application/json" })
      .end(JSON.stringify(result));
  })
  .listen(PORT, () => console.log(`build-runner listening on :${PORT}`));
```

Run it:

```bash
BUILD_RUNNER_TOKEN=$(openssl rand -hex 32) \
BUILD_CWD=/path/to/project \
PORT=8787 \
node worker.mjs
```

Expose it (e.g. via `cloudflared tunnel`, `ngrok http 8787`, or a real domain
behind TLS), then in yawB set:

```
BUILD_RUNNER_URL=https://your-host.example.com/         # or .../api/public/build-runner
BUILD_RUNNER_TOKEN=<same token as above>
```

Republish the preview so the server runner picks up the env vars.

## Security notes

- Always set `BUILD_RUNNER_TOKEN` in production. Without it the worker accepts
  any caller and will execute the supplied command.
- `command` is executed via `spawn(..., { shell: true })`. Treat the worker as
  a privileged execution surface — only point yawB (a trusted caller) at it,
  and run it on a host with no sensitive credentials.
- The `BUILD_COMMAND` / `TYPECHECK_COMMAND` env vars on yawB constrain which
  commands get sent. Keep them pinned to known build scripts.
