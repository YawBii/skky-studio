import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Github,
  Triangle,
  Database,
  Server,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getProvidersOverview,
  runProviderDiagnosticFn,
  type ProvidersOverview,
  type ProviderStatusDTO,
  type ProviderDiagnosticDTO,
} from "@/services/providers.functions";

export const Route = createFileRoute("/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — yawB" },
      {
        name: "description",
        content:
          "Provider hub: GitHub, Vercel, Supabase, and the build runner. Real status, no fake states.",
      },
    ],
  }),
  component: IntegrationsPage,
});

type ProviderId = ProviderStatusDTO["provider"];

const PROVIDERS: ProviderId[] = ["github", "vercel", "supabase", "build-runner"];

const META: Record<
  ProviderId,
  {
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    helpUrl: string;
    setupHint: string;
  }
> = {
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
    setupHint:
      "Required: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY. Optional: SUPABASE_SERVICE_ROLE_KEY.",
  },
  "build-runner": {
    label: "Build Runner",
    Icon: Server,
    helpUrl: "/server-setup",
    setupHint: "Add BUILD_RUNNER_URL (and optional BUILD_RUNNER_TOKEN).",
  },
};

const DIAG_STORAGE_KEY = "yawb.integrations.diagnostics.v1";

function loadDiagnostics(): Record<string, ProviderDiagnosticDTO> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DIAG_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ProviderDiagnosticDTO>) : {};
  } catch {
    return {};
  }
}

function saveDiagnostics(d: Record<string, ProviderDiagnosticDTO>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DIAG_STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

type CardState =
  | { kind: "loading" }
  | { kind: "ready"; status: ProviderStatusDTO }
  | { kind: "error"; message: string };

function IntegrationsPage() {
  // Each provider card is independent — its own loading / ready / error state.
  const [cards, setCards] = useState<Record<ProviderId, CardState>>({
    github: { kind: "loading" },
    vercel: { kind: "loading" },
    supabase: { kind: "loading" },
    "build-runner": { kind: "loading" },
  });
  const [diagnostics, setDiagnostics] = useState<Record<string, ProviderDiagnosticDTO>>({});
  const [diagOpen, setDiagOpen] = useState(false);
  const [testingProvider, setTestingProvider] = useState<ProviderId | null>(null);
  const [globalRefreshing, setGlobalRefreshing] = useState(false);

  // Hydrate cached diagnostics on mount.
  useEffect(() => {
    setDiagnostics(loadDiagnostics());
  }, []);

  const applyOverview = useCallback((o: ProvidersOverview) => {
    setCards({
      github: { kind: "ready", status: o.github },
      vercel: { kind: "ready", status: o.vercel },
      supabase: { kind: "ready", status: o.supabase },
      "build-runner": { kind: "ready", status: o.buildRunner },
    });
  }, []);

  const refreshAll = useCallback(async () => {
    setGlobalRefreshing(true);
    setCards({
      github: { kind: "loading" },
      vercel: { kind: "loading" },
      supabase: { kind: "loading" },
      "build-runner": { kind: "loading" },
    });
    try {
      const snap = await getProvidersOverview();
      applyOverview(snap);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCards({
        github: { kind: "error", message: msg },
        vercel: { kind: "error", message: msg },
        supabase: { kind: "error", message: msg },
        "build-runner": { kind: "error", message: msg },
      });
    } finally {
      setGlobalRefreshing(false);
    }
  }, [applyOverview]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const runTest = useCallback(async (provider: ProviderId) => {
    setTestingProvider(provider);
    setCards((prev) => ({ ...prev, [provider]: { kind: "loading" } }));
    try {
      const d = await runProviderDiagnosticFn({ data: { provider } });
      setDiagnostics((prev) => {
        const next = { ...prev, [provider]: d };
        saveDiagnostics(next);
        return next;
      });
      // Reflect into the card status (no overview reload needed).
      setCards((prev) => ({
        ...prev,
        [provider]: {
          kind: "ready",
          status: {
            provider,
            configured: d.configured,
            reachable: d.reachable,
            account: d.account,
            error: d.normalizedError,
            missing: d.missing,
            checkedAt: d.checkedAt,
          },
        },
      }));
      setDiagOpen(true);
    } catch (e) {
      setCards((prev) => ({
        ...prev,
        [provider]: { kind: "error", message: e instanceof Error ? e.message : String(e) },
      }));
    } finally {
      setTestingProvider(null);
    }
  }, []);

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1200px] mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Workspace
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
            Integrations
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Provider status, token diagnostics and sync health for the whole workspace.
            Project-level imports live in{" "}
            <Link to="/projects" className="text-primary">
              Projects
            </Link>
            .
          </p>
        </div>
        <Button variant="soft" size="sm" onClick={refreshAll} disabled={globalRefreshing}>
          <RefreshCw className={cn("h-4 w-4", globalRefreshing && "animate-spin")} /> Refresh all
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {PROVIDERS.map((p) => (
          <ProviderCard
            key={p}
            provider={p}
            state={cards[p]}
            testing={testingProvider === p}
            lastDiagnostic={diagnostics[p] ?? null}
            onTest={() => void runTest(p)}
          />
        ))}
      </div>

      <DiagnosticsPanel
        open={diagOpen}
        onToggle={() => setDiagOpen((v) => !v)}
        diagnostics={diagnostics}
      />

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[12.5px] text-muted-foreground">
        Tokens are read from server-side environment variables only. They are never returned to the
        browser. Add or rotate them via Lovable Cloud secrets, then refresh this page.
        <span className="ml-1">
          See{" "}
          <Link to="/server-setup" className="text-primary">
            Server Setup
          </Link>{" "}
          for the full env matrix.
        </span>
      </div>
    </div>
  );
}

/* -------------------- Provider card -------------------- */

function ProviderCard({
  provider,
  state,
  testing,
  lastDiagnostic,
  onTest,
}: {
  provider: ProviderId;
  state: CardState;
  testing: boolean;
  lastDiagnostic: ProviderDiagnosticDTO | null;
  onTest: () => void;
}) {
  const meta = META[provider];
  const Icon = meta.Icon;

  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 grid place-items-center">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-display font-semibold">{meta.label}</div>
            <CardBadge state={state} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {state.kind === "ready" && state.status.account
              ? `Account: ${state.status.account}`
              : meta.setupHint}
          </div>
        </div>
      </div>

      {/* Card body — independent per state. */}
      {state.kind === "loading" && (
        <div className="mt-3 h-10 rounded-lg bg-white/[0.03] animate-pulse" />
      )}

      {state.kind === "error" && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          Couldn't load: {state.message}
        </div>
      )}

      {state.kind === "ready" && state.status.missing.length > 0 && (
        <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[12px] text-warning">
          Missing env: <span className="font-mono">{state.status.missing.join(", ")}</span>
        </div>
      )}

      {state.kind === "ready" && state.status.error && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          {state.status.error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <Button variant="soft" size="sm" onClick={onTest} disabled={testing}>
          {testing ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PlayCircle className="h-3.5 w-3.5" />
          )}
          {testing ? "Testing…" : "Test"}
        </Button>

        {provider === "github" && state.kind === "ready" && state.status.configured && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects" search={{ tab: "github" } as never}>
              Browse repos
            </Link>
          </Button>
        )}
        {provider === "vercel" && state.kind === "ready" && state.status.configured && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects" search={{ tab: "vercel" } as never}>
              Browse deployments
            </Link>
          </Button>
        )}
        {provider === "build-runner" && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/server-setup">Open server setup</Link>
          </Button>
        )}
        <a
          href={meta.helpUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-auto"
        >
          Docs <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-3 text-[10.5px] text-muted-foreground">
        {state.kind === "ready" ? (
          <>Last checked {new Date(state.status.checkedAt).toLocaleTimeString()}</>
        ) : state.kind === "loading" ? (
          "Checking…"
        ) : (
          "Not checked"
        )}
        {lastDiagnostic && (
          <>
            {" "}
            · last test {lastDiagnostic.durationMs}ms · {lastDiagnostic.httpStatus ?? "—"}
          </>
        )}
      </div>
    </div>
  );
}

function CardBadge({ state }: { state: CardState }) {
  if (state.kind === "loading") {
    return (
      <Pill cls="border-white/10 text-muted-foreground" Icon={RefreshCw} label="Checking…" spin />
    );
  }
  if (state.kind === "error") {
    return (
      <Pill cls="border-destructive/30 text-destructive bg-destructive/5" Icon={X} label="Error" />
    );
  }
  const s = state.status;
  if (!s.configured)
    return (
      <Pill
        cls="border-white/10 text-muted-foreground"
        Icon={AlertTriangle}
        label="Not configured"
      />
    );
  if (s.reachable === false)
    return (
      <Pill
        cls="border-destructive/30 text-destructive bg-destructive/5"
        Icon={X}
        label="API failed"
      />
    );
  if (s.reachable === true)
    return (
      <Pill cls="border-success/30 text-success bg-success/5" Icon={Check} label="Connected" />
    );
  return (
    <Pill
      cls="border-warning/30 text-warning bg-warning/5"
      Icon={AlertTriangle}
      label="Configured"
    />
  );
}

function Pill({
  cls,
  Icon,
  label,
  spin,
}: {
  cls: string;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  spin?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full border",
        cls,
      )}
    >
      <Icon className={cn("h-3 w-3", spin && "animate-spin")} /> {label}
    </span>
  );
}

/* -------------------- Diagnostics panel -------------------- */

function DiagnosticsPanel({
  open,
  onToggle,
  diagnostics,
}: {
  open: boolean;
  onToggle: () => void;
  diagnostics: Record<string, ProviderDiagnosticDTO>;
}) {
  const entries = useMemo(
    () => PROVIDERS.map((p) => [p, diagnostics[p] ?? null] as const),
    [diagnostics],
  );
  const hasAny = entries.some(([, d]) => d !== null);

  return (
    <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-sm">Diagnostics</span>
          <span className="text-[11px] text-muted-foreground">
            {hasAny
              ? `${entries.filter(([, d]) => d).length}/4 providers tested`
              : "Run a Test on any card"}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-white/5 divide-y divide-white/5">
          {entries.map(([p, d]) => (
            <DiagnosticRow key={p} provider={p} diag={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function DiagnosticRow({
  provider,
  diag,
}: {
  provider: ProviderId;
  diag: ProviderDiagnosticDTO | null;
}) {
  const meta = META[provider];
  const Icon = meta.Icon;
  return (
    <div className="px-4 py-3 text-[12.5px]">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{meta.label}</span>
        {diag ? (
          <span className="text-muted-foreground">
            · {new Date(diag.checkedAt).toLocaleString()} · {diag.durationMs}ms
            {diag.httpStatus != null && <> · HTTP {diag.httpStatus}</>}
          </span>
        ) : (
          <span className="text-muted-foreground">· not tested yet</span>
        )}
      </div>
      {diag && (
        <div className="mt-2 grid sm:grid-cols-2 gap-2">
          <KV label="Status">{diag.status}</KV>
          <KV label="Configured">{String(diag.configured)}</KV>
          <KV label="Reachable">{diag.reachable === null ? "—" : String(diag.reachable)}</KV>
          <KV label="Account">{diag.account ?? "—"}</KV>
          <KV label="Target">{diag.target ?? "—"}</KV>
          <KV label="Missing env">{diag.missing.length ? diag.missing.join(", ") : "—"}</KV>
          {diag.normalizedError && (
            <KV label="Error" full>
              {diag.normalizedError}
            </KV>
          )}
          {diag.responseBody && (
            <div className="sm:col-span-2 mt-1">
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                Response body
              </div>
              <pre className="rounded-lg border border-white/10 bg-black/40 p-2 text-[11px] overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {diag.responseBody}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KV({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={cn(full && "sm:col-span-2")}>
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="text-[12px] font-mono break-all">{children}</div>
    </div>
  );
}
