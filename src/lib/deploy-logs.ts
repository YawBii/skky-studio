// Demo data for the Vercel deploy logs viewer.
// TODO(codex): replace with real data from services/vercel.ts streamLogs()

export type StageStatus = "ok" | "running" | "warn" | "error" | "pending";

export interface LogLine {
  ts: string; // HH:MM:SS.mmm
  level: "info" | "warn" | "error" | "success";
  text: string;
}

export interface LogStage {
  id: string;
  label: string;
  status: StageStatus;
  durationMs: number;
  lines: LogLine[];
}

export interface ErrorGroup {
  id: string;
  signature: string;
  count: number;
  firstStage: string;
  snippet: string;
  hint: string;
}

export interface DeployRun {
  id: string;
  url: string;
  target: "production" | "preview";
  branch: string;
  commitSha: string;
  commitMessage: string;
  author: string;
  triggeredAt: string;
  durationMs: number;
  status: "READY" | "BUILDING" | "ERROR" | "CANCELED";
  region: string;
  stages: LogStage[];
  errorGroups: ErrorGroup[];
}

export const deployRuns: DeployRun[] = [
  {
    id: "dpl_a4f2c91",
    url: "portal.skky.group",
    target: "production",
    branch: "main",
    commitSha: "a4f2c91",
    commitMessage: "feat(settings): add billing tab",
    author: "Skky Bot",
    triggeredAt: "2h ago",
    durationMs: 42_300,
    status: "READY",
    region: "iad1",
    stages: [
      {
        id: "queue",
        label: "Queued",
        status: "ok",
        durationMs: 1_100,
        lines: [
          {
            ts: "10:42:01.004",
            level: "info",
            text: "Webhook received from github.com/skky-group/portal",
          },
          { ts: "10:42:01.812", level: "info", text: "Build assigned to runner iad1-build-7f3" },
        ],
      },
      {
        id: "clone",
        label: "Clone",
        status: "ok",
        durationMs: 2_400,
        lines: [
          { ts: "10:42:02.110", level: "info", text: "git clone --depth=1 origin/main" },
          { ts: "10:42:04.502", level: "success", text: "✓ Cloned skky-group/portal at a4f2c91" },
        ],
      },
      {
        id: "install",
        label: "Install",
        status: "ok",
        durationMs: 12_400,
        lines: [
          { ts: "10:42:04.610", level: "info", text: "Detected bun.lockb — using bun install" },
          { ts: "10:42:16.998", level: "success", text: "✓ Installed 412 packages in 12.4s" },
        ],
      },
      {
        id: "build",
        label: "Build",
        status: "ok",
        durationMs: 18_900,
        lines: [
          { ts: "10:42:17.110", level: "info", text: "vite build --mode production" },
          { ts: "10:42:22.001", level: "info", text: "Generated route tree (8 routes)" },
          { ts: "10:42:34.770", level: "success", text: "✓ Built client bundle (188 kB gzipped)" },
          { ts: "10:42:35.998", level: "success", text: "✓ Built server bundle for Edge runtime" },
        ],
      },
      {
        id: "upload",
        label: "Upload",
        status: "ok",
        durationMs: 4_300,
        lines: [
          {
            ts: "10:42:36.110",
            level: "info",
            text: "Uploading 24 files to Vercel edge (region: iad1)",
          },
          { ts: "10:42:40.401", level: "success", text: "✓ Upload complete" },
        ],
      },
      {
        id: "verify",
        label: "Verify",
        status: "ok",
        durationMs: 3_200,
        lines: [
          {
            ts: "10:42:40.510",
            level: "info",
            text: "GET https://portal.skky.group → 200 OK (412ms)",
          },
          {
            ts: "10:42:43.701",
            level: "success",
            text: "✓ Lighthouse: 98 perf · 100 a11y · 100 seo",
          },
          { ts: "10:42:43.998", level: "success", text: "✅ Promoted to production" },
        ],
      },
    ],
    errorGroups: [],
  },
  {
    id: "dpl_b9112e8",
    url: "preview-portal-x91.vercel.app",
    target: "preview",
    branch: "yawb/cloud-secrets",
    commitSha: "b9112e8",
    commitMessage: "wip: secrets tab — failing build",
    author: "Skky Team",
    triggeredAt: "26m ago",
    durationMs: 21_700,
    status: "ERROR",
    region: "iad1",
    stages: [
      {
        id: "queue",
        label: "Queued",
        status: "ok",
        durationMs: 800,
        lines: [
          {
            ts: "11:58:03.001",
            level: "info",
            text: "Webhook received from github.com/skky-group/portal",
          },
        ],
      },
      {
        id: "clone",
        label: "Clone",
        status: "ok",
        durationMs: 2_100,
        lines: [
          { ts: "11:58:05.110", level: "success", text: "✓ Cloned skky-group/portal at b9112e8" },
        ],
      },
      {
        id: "install",
        label: "Install",
        status: "ok",
        durationMs: 9_900,
        lines: [{ ts: "11:58:15.001", level: "success", text: "✓ Installed 414 packages in 9.9s" }],
      },
      {
        id: "build",
        label: "Build",
        status: "error",
        durationMs: 8_900,
        lines: [
          { ts: "11:58:15.402", level: "info", text: "vite build --mode production" },
          {
            ts: "11:58:21.110",
            level: "error",
            text: "src/routes/cloud.tsx(142,18): error TS2322: Type 'string | undefined' is not assignable to type 'string'.",
          },
          {
            ts: "11:58:21.111",
            level: "error",
            text: "  142 |       value={selectedSecret.value}",
          },
          {
            ts: "11:58:21.220",
            level: "error",
            text: "src/services/cloud.ts(58,7): error TS2554: Expected 1 arguments, but got 0.",
          },
          { ts: "11:58:23.998", level: "error", text: "✗ Build failed with 2 errors" },
        ],
      },
      { id: "upload", label: "Upload", status: "pending", durationMs: 0, lines: [] },
      { id: "verify", label: "Verify", status: "pending", durationMs: 0, lines: [] },
    ],
    errorGroups: [
      {
        id: "ts2322",
        signature: "TS2322 — undefined not assignable to string",
        count: 1,
        firstStage: "build",
        snippet: `src/routes/cloud.tsx:142:18
  140 |   <Input
  141 |     id="secret-value"
> 142 |     value={selectedSecret.value}
      |                  ^^^^^^^^^^^^^^
  143 |     onChange={(e) => setValue(e.target.value)}
  144 |   />`,
        hint: "Provide a fallback: value={selectedSecret.value ?? ''} or narrow with a guard.",
      },
      {
        id: "ts2554",
        signature: "TS2554 — missing required argument",
        count: 1,
        firstStage: "build",
        snippet: `src/services/cloud.ts:58:7
  56 | export async function rotateSecret(name: string) {
  57 |   // TODO(codex): wire to Supabase admin API
> 58 |   await rotate();
     |         ^^^^^^^^
  59 |   return { name, rotatedAt: new Date().toISOString() };
  60 | }`,
        hint: "rotate() requires a secret id. Pass the name through: await rotate(name).",
      },
    ],
  },
];
