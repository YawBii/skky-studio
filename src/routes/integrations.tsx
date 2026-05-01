import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Github, Triangle, Database, Server, RefreshCw, Check, X, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getProvidersOverview,
  type ProvidersOverview,
  type ProviderStatusDTO,
} from "@/services/providers.functions";

export const Route = createFileRoute("/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — yawB" },
      { name: "description", content: "Provider hub: GitHub, Vercel, Supabase, and the build runner. Real status, no fake states." },
    ],
  }),
  component: IntegrationsPage,
});

const META: Record<ProviderStatusDTO["provider"], {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  helpUrl: string;
  setupHint: string;
}> = {
  github: {
    label: "GitHub",
    Icon: Github,
    helpUrl: "https://github.com/settings/tokens",
    setupHint: "Add GITHUB_TOKEN (repo scope) in Lovable Cloud secrets.",
  },
  vercel: {
    label: "Vercel",
    Icon: Triangle,
    helpUrl: "https://vercel.com/account/tokens",
    setupHint: "Add VERCEL_TOKEN in Lovable Cloud secrets.",
  },
  supabase: {
    label: "Supabase (Lovable Cloud)",
    Icon: Database,
    helpUrl: "https://supabase.com/dashboard",
    setupHint: "Required: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY. Optional: SUPABASE_SERVICE_ROLE_KEY.",
  },
  "build-runner": {
    label: "Build Runner",
    Icon: Server,
    helpUrl: "/server-setup",
    setupHint: "Add BUILD_RUNNER_URL (and optional BUILD_RUNNER_TOKEN).",
  },
};

function IntegrationsPage() {
  const [data, setData] = useState<ProvidersOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getProvidersOverview();
      setData(snap);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const list: ProviderStatusDTO[] = data
    ? [data.github, data.vercel, data.supabase, data.buildRunner]
    : [];

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1200px] mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Workspace</div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Provider status, token diagnostics and sync health for the whole workspace.
            Project-level imports live in <Link to="/projects" className="text-primary">Projects</Link>.
          </p>
        </div>
        <Button variant="soft" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive flex items-start gap-2 mb-6">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div><div className="font-medium">Couldn't load providers</div><div className="text-muted-foreground mt-1">{error}</div></div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {loading && !data
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-gradient-card p-5 h-[180px] animate-pulse" />
            ))
          : list.map((p) => <ProviderCard key={p.provider} status={p} />)}
      </div>

      <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[12.5px] text-muted-foreground">
        Tokens are read from server-side environment variables only. They are never returned to the browser.
        Add or rotate them via Lovable Cloud secrets, then refresh this page.
        <span className="ml-1">
          See <Link to="/server-setup" className="text-primary">Server Setup</Link> for the full env matrix.
        </span>
      </div>
    </div>
  );
}

function ProviderCard({ status }: { status: ProviderStatusDTO }) {
  const meta = META[status.provider];
  const Icon = meta.Icon;
  const state = pickState(status);
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 grid place-items-center">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-display font-semibold">{meta.label}</div>
            <StateBadge state={state.kind} label={state.label} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {status.account ? `Account: ${status.account}` : meta.setupHint}
          </div>
        </div>
      </div>

      {status.missing.length > 0 && (
        <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[12px] text-warning">
          Missing env: <span className="font-mono">{status.missing.join(", ")}</span>
        </div>
      )}

      {status.error && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          {status.error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {status.provider === "github" && status.configured && (
          <Button variant="soft" size="sm" asChild>
            <Link to="/projects" search={{ tab: "github" } as never}>Browse repos</Link>
          </Button>
        )}
        {status.provider === "vercel" && status.configured && (
          <Button variant="soft" size="sm" asChild>
            <Link to="/projects" search={{ tab: "vercel" } as never}>Browse deployments</Link>
          </Button>
        )}
        {status.provider === "build-runner" && (
          <Button variant="soft" size="sm" asChild>
            <Link to="/server-setup">Open server setup</Link>
          </Button>
        )}
        <a
          href={meta.helpUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          Docs <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-3 text-[10.5px] text-muted-foreground">
        Last checked {new Date(status.checkedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

type State = { kind: "ok" | "warn" | "err" | "off"; label: string };

function pickState(s: ProviderStatusDTO): State {
  if (!s.configured) return { kind: "off", label: "Not configured" };
  if (s.reachable === false) return { kind: "err", label: "API failed" };
  if (s.reachable === true) return { kind: "ok", label: "Connected" };
  return { kind: "warn", label: "Configured" };
}

function StateBadge({ state, label }: { state: State["kind"]; label: string }) {
  const cls =
    state === "ok" ? "border-success/30 text-success bg-success/5" :
    state === "warn" ? "border-warning/30 text-warning bg-warning/5" :
    state === "err" ? "border-destructive/30 text-destructive bg-destructive/5" :
    "border-white/10 text-muted-foreground";
  const Icon = state === "ok" ? Check : state === "err" ? X : AlertTriangle;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full border", cls)}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}
