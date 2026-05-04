import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUILD_MODE, BUILD_TIME, BUILD_VERSION } from "@/lib/build-info";
import {
  clearTelemetry,
  getTelemetry,
  initClientTelemetry,
  subscribeTelemetry,
  type TelemetryEvent,
} from "@/lib/client-telemetry";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Status — yawB" },
      {
        name: "description",
        content: "Build version, deploy status, uptime checks and client diagnostics.",
      },
    ],
  }),
  component: StatusPage,
});

const TARGETS = [
  { label: "yawb.lovable.app", url: "https://yawb.lovable.app" },
  { label: "yawb.skky.se", url: "https://yawb.skky.se" },
];

type CheckStep = "DNS" | "TLS" | "HTTP" | "RENDER";
type CheckResult = {
  url: string;
  label: string;
  ok: boolean;
  ms: number;
  status?: number;
  failedStep?: CheckStep;
  error?: string;
};

async function probe(target: { label: string; url: string }): Promise<CheckResult> {
  const started = performance.now();
  // Use HEAD via fetch with no-cors so we still measure reachability even
  // when the target lacks CORS headers. A network/DNS/TLS failure throws;
  // an opaque success means DNS+TLS+HTTP all worked.
  try {
    const healthUrl = `${target.url}/api/public/health`;
    const res = await fetch(healthUrl, { method: "GET", mode: "cors", cache: "no-store" });
    return {
      url: target.url,
      label: target.label,
      ok: res.ok,
      ms: Math.round(performance.now() - started),
      status: res.status,
      failedStep: res.ok ? undefined : "HTTP",
    };
  } catch (corsErr) {
    // CORS-blocked or no /health — fall back to opaque ping.
    try {
      await fetch(target.url, { method: "GET", mode: "no-cors", cache: "no-store" });
      return {
        url: target.url,
        label: target.label,
        ok: true,
        ms: Math.round(performance.now() - started),
        failedStep: "RENDER",
        error: "Reachable but health endpoint blocked by CORS — render path not verified",
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      let step: CheckStep = "DNS";
      if (/certificate|ssl|tls/i.test(msg)) step = "TLS";
      else if (/cors|http|status/i.test(msg)) step = "HTTP";
      return {
        url: target.url,
        label: target.label,
        ok: false,
        ms: Math.round(performance.now() - started),
        failedStep: step,
        error:
          msg +
          " (also possibly: " +
          (corsErr instanceof Error ? corsErr.message : String(corsErr)) +
          ")",
      };
    }
  }
}

function useTelemetry(): TelemetryEvent[] {
  return useSyncExternalStore(
    subscribeTelemetry,
    () => getTelemetry(),
    () => [],
  );
}

function StatusPage() {
  useEffect(() => {
    initClientTelemetry();
  }, []);

  const events = useTelemetry();
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    const out = await Promise.all(TARGETS.map(probe));
    setResults(out);
    setLastRun(new Date().toLocaleString());
    setRunning(false);
  };

  useEffect(() => {
    void run();
  }, []);

  const recentFailures = useMemo(
    () =>
      events
        .filter((e) => e.kind === "error" || e.kind === "rejection" || e.kind === "render-timeout")
        .slice(-25)
        .reverse(),
    [events],
  );

  return (
    <div className="px-6 md:px-10 py-10 max-w-[1100px] mx-auto space-y-8">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Status</div>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
          Deployment & uptime
        </h1>
        <p className="text-muted-foreground mt-1">
          Front-end build info, reachability checks, and live client telemetry.
        </p>
      </header>

      <section className="rounded-2xl border border-white/5 bg-gradient-card p-6">
        <h2 className="font-display font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4" /> Build version
        </h2>
        <dl className="mt-4 grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wider">Version</dt>
            <dd className="font-mono mt-1 break-all">{BUILD_VERSION}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wider">Mode</dt>
            <dd className="font-mono mt-1">{BUILD_MODE}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wider">
              Last deploy / page load
            </dt>
            <dd className="font-mono mt-1">{new Date(BUILD_TIME).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-white/5 bg-gradient-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold">Reachability</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Checks DNS → TLS → HTTP → render path. Last run: {lastRun ?? "—"}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={run} disabled={running}>
            <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} /> Re-check
          </Button>
        </div>
        <ul className="mt-4 space-y-3">
          {results.map((r) => (
            <li
              key={r.url}
              className="flex items-start justify-between gap-4 rounded-lg border border-white/5 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {r.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>{r.label}</span>
                  <span className="text-muted-foreground text-xs">{r.ms}ms</span>
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {r.url}
                </a>
                {r.failedStep && (
                  <div className="mt-1 text-xs">
                    <span className="font-mono text-muted-foreground">step: </span>
                    <span className={r.ok ? "text-warning" : "text-destructive"}>
                      {r.failedStep}
                    </span>
                    {r.status && (
                      <span className="font-mono text-muted-foreground"> · http {r.status}</span>
                    )}
                  </div>
                )}
                {r.error && (
                  <div className="mt-1 text-xs text-muted-foreground break-all">{r.error}</div>
                )}
              </div>
            </li>
          ))}
          {results.length === 0 && <li className="text-sm text-muted-foreground">Running…</li>}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/5 bg-gradient-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Recent client failures
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Errors, rejected promises, and render timeouts from this browser. A render-timeout
              with a long gap typically precedes a Chrome RESULT_CODE_HUNG kill.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={clearTelemetry}>
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
        <ul className="mt-4 space-y-2 text-xs font-mono">
          {recentFailures.length === 0 && (
            <li className="text-muted-foreground">No failures recorded.</li>
          )}
          {recentFailures.map((e, i) => (
            <li key={i} className="rounded border border-white/5 p-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{new Date(e.t).toLocaleTimeString()}</span>
                <span className="text-warning uppercase">{e.kind}</span>
              </div>
              <div className="mt-1 break-all">
                {e.kind === "render-timeout"
                  ? `main thread blocked for ~${e.ms}ms`
                  : "message" in e
                    ? e.message
                    : ""}
              </div>
              {"stack" in e && e.stack && (
                <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap">
                  {e.stack.split("\n").slice(0, 3).join("\n")}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/5 bg-gradient-card p-6">
        <h2 className="font-display font-semibold">All telemetry events ({events.length})</h2>
        <ul className="mt-3 space-y-1 text-[11px] font-mono max-h-72 overflow-auto">
          {events
            .slice()
            .reverse()
            .map((e, i) => (
              <li key={i} className="text-muted-foreground">
                <span>{new Date(e.t).toLocaleTimeString()}</span>{" "}
                <span className="text-foreground">{e.kind}</span>{" "}
                <span>{"message" in e ? e.message : JSON.stringify(e)}</span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
