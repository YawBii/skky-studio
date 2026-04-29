// TODO(codex): wire to Vercel REST API using VERCEL_TOKEN secret.
export interface Deployment {
  id: string;
  url: string;
  state: "READY" | "BUILDING" | "ERROR" | "QUEUED" | "CANCELED";
  target: "production" | "preview";
  branch: string;
  commitSha: string;
  commitMessage: string;
  createdAt: string;
  durationMs: number;
}

export async function listDeployments(_projectId: string): Promise<Deployment[]> {
  return [
    { id: "dpl_1", url: "portal.skky.group", state: "READY", target: "production", branch: "main",
      commitSha: "a4f2c91", commitMessage: "feat(settings): add billing tab", createdAt: "2h ago", durationMs: 42_000 },
    { id: "dpl_2", url: "preview-portal.vercel.app", state: "READY", target: "preview", branch: "yawb/settings-tabs",
      commitSha: "b9112e8", commitMessage: "wip: tabs", createdAt: "5h ago", durationMs: 38_000 },
  ];
}

export async function deploy(_projectId: string, _opts?: { branch?: string; production?: boolean }): Promise<Deployment> {
  return { id: "dpl_new", url: "preview.vercel.app", state: "BUILDING", target: "preview", branch: "main",
    commitSha: "pending", commitMessage: "Triggered by yawB", createdAt: "now", durationMs: 0 };
}

export async function streamLogs(_deploymentId: string): Promise<string[]> {
  return [
    "✓ Cloned skky-group/portal at main (a4f2c91)",
    "✓ Installed 412 packages in 12.4s",
    "✓ Generated route tree (8 routes)",
    "✓ Built client bundle (188 kB gzipped)",
    "✓ Built server bundle for Edge runtime",
    "✓ Uploaded to Vercel (region: iad1)",
    "✓ Health check passed",
    "✓ Lighthouse: 98 perf · 100 a11y · 100 seo",
    "✅ Deployment complete — promoted to production",
  ];
}
