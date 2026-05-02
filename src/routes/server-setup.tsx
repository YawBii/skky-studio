import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Server, Check, X, RefreshCw, AlertTriangle, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getServerSetup, type ServerSetupSnapshot } from "@/services/server-setup.functions";

export const Route = createFileRoute("/server-setup")({
  head: () => ({
    meta: [
      { title: "Server Setup — yawB" },
      {
        name: "description",
        content:
          "Inspect server-side environment variables yawB needs to run real builds and provider jobs.",
      },
    ],
  }),
  component: ServerSetupPage,
});

type Row = { name: string; configured: boolean; required: boolean; help: string };

function ServerSetupPage() {
  const [data, setData] = useState<ServerSetupSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const snap = await getServerSetup();
      setData(snap);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows: Row[] = data
    ? [
        {
          name: "BUILD_RUNNER_URL",
          configured: data.buildRunner.hasBuildRunnerUrl,
          required: true,
          help: "HTTPS URL of an external Node worker that executes build/typecheck commands. yawB cannot run real builds without this.",
        },
        {
          name: "BUILD_RUNNER_TOKEN",
          configured: data.buildRunner.hasBuildRunnerToken,
          required: false,
          help: "Bearer token sent to the build worker. Recommended whenever the worker is reachable from the public internet.",
        },
        {
          name: "SUPABASE_URL",
          configured: data.supabase.hasSupabaseUrl,
          required: true,
          help: "Server-side Supabase project URL. Mirrors VITE_SUPABASE_URL.",
        },
        {
          name: "SUPABASE_PUBLISHABLE_KEY",
          configured: data.supabase.hasSupabasePublishableKey,
          required: true,
          help: "Server-side anon/publishable key used by the runner to honor RLS. Mirrors VITE_SUPABASE_PUBLISHABLE_KEY.",
        },
        {
          name: "SUPABASE_SERVICE_ROLE_KEY",
          configured: data.supabase.hasSupabaseServiceRoleKey,
          required: false,
          help: "Service-role key for admin jobs. Server-only — never expose to the browser.",
        },
        {
          name: "GITHUB_TOKEN",
          configured: data.providers.hasGithubToken,
          required: false,
          help: "Personal access token (repo scope) for GitHub provider jobs (commits, PRs, repo creation).",
        },
        {
          name: "VERCEL_TOKEN",
          configured: data.providers.hasVercelToken,
          required: false,
          help: "Vercel API token for deploy provider jobs.",
        },
      ]
    : [];

  const buildRunnerOk = Boolean(data?.buildRunner.hasBuildRunnerUrl);

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1100px] mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-[0.2em] mb-1">
            <Server className="h-3 w-3" /> Server Setup
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
            Server Setup
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Live presence check of the environment variables yawB's server runner depends on. Values
            are never shown — only whether each variable is configured.
          </p>
        </div>
        <Button variant="soft" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load server setup: {error}
        </div>
      )}

      {/* Build runner banner */}
      <div
        className={cn(
          "mb-6 rounded-2xl border p-5",
          buildRunnerOk
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-amber-500/30 bg-amber-500/5",
        )}
      >
        <div className="flex items-start gap-3">
          {buildRunnerOk ? (
            <Check className="h-5 w-5 text-emerald-400 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="font-semibold mb-1">
              {buildRunnerOk ? "Build runner is configured." : "Build runner is not configured."}
            </div>
            <p className="text-sm text-muted-foreground">
              {data?.buildRunner.reason ?? "Loading…"}
            </p>
            {!buildRunnerOk && (
              <div className="mt-3 text-sm text-muted-foreground space-y-2">
                <p>
                  yawB{" "}
                  <strong>
                    cannot run real <code className="font-mono text-xs">build.typecheck</code> or
                    <code className="font-mono text-xs"> build.production</code> jobs
                  </strong>{" "}
                  until
                  <code className="font-mono text-xs"> BUILD_RUNNER_URL</code> points to an external
                  Node worker. The Lovable runtime (Cloudflare Worker) does not allow spawning child
                  processes, so an external host is required.
                </p>
                <p>
                  Add the following secrets in{" "}
                  <strong>Lovable → Project → Settings → Secrets</strong>:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <code className="font-mono text-xs">BUILD_RUNNER_URL</code> — HTTPS URL of your
                    Node worker
                  </li>
                  <li>
                    <code className="font-mono text-xs">BUILD_RUNNER_TOKEN</code> — bearer token the
                    worker requires
                  </li>
                </ul>
                <p>
                  Reference worker contract and a minimal Node 20 implementation are documented in
                  <code className="font-mono text-xs"> docs/build-runner.md</code>.
                </p>
              </div>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              Mode: <span className="font-mono">{data?.buildRunner.mode ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Env table */}
      <div className="rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-display font-semibold">Environment variables</h2>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            presence only
          </span>
        </div>
        <ul className="divide-y divide-white/5">
          {rows.map((r) => (
            <li
              key={r.name}
              className="px-5 py-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 items-center"
            >
              <div className="flex items-center gap-2 min-w-0">
                <code className="font-mono text-sm">{r.name}</code>
                {r.required && (
                  <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                    required
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(r.name)
                      .then(() => toast.success(`Copied ${r.name}`));
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  title="Copy variable name"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              <StatusPill configured={r.configured} />
              <p className="col-span-2 text-xs text-muted-foreground">{r.help}</p>
            </li>
          ))}
          {!data && !error && (
            <li className="px-5 py-6 text-sm text-muted-foreground">Loading server setup…</li>
          )}
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        <Link to="/settings" className="text-muted-foreground hover:text-foreground underline">
          Back to Settings
        </Link>
        <span className="text-muted-foreground">·</span>
        <a
          href="https://docs.lovable.dev/features/cloud"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground underline"
        >
          Lovable Cloud docs <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <p className="mt-6 text-[11px] text-muted-foreground">
        Secret values are never returned by this screen. yawB only reports whether each variable is
        set on the server.
      </p>
    </div>
  );
}

function StatusPill({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
      <Check className="h-3 w-3" /> configured
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
      <X className="h-3 w-3" /> missing
    </span>
  );
}
