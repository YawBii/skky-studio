// Lightweight client-side error + performance logger.
// Buffers events in memory and mirrors a tail to localStorage so the
// /status page can show why a tab might appear hung or fail to render.

export type TelemetryEvent =
  | { kind: "error"; t: number; message: string; source?: string; stack?: string }
  | { kind: "rejection"; t: number; message: string; stack?: string }
  | { kind: "longtask"; t: number; duration: number }
  | { kind: "render-timeout"; t: number; ms: number }
  | { kind: "nav"; t: number; type: string; loadMs: number; domMs: number; ttfbMs: number }
  | { kind: "info"; t: number; message: string };

const KEY = "yawb:telemetry";
const MAX = 200;
const buffer: TelemetryEvent[] = [];
let initialized = false;
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(buffer.slice(-MAX)));
  } catch {
    /* ignore quota */
  }
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function pushTelemetry(ev: TelemetryEvent) {
  buffer.push(ev);
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
  persist();
}

export function getTelemetry(): TelemetryEvent[] {
  return [...buffer];
}

export function subscribeTelemetry(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearTelemetry() {
  buffer.length = 0;
  persist();
}

export function initClientTelemetry() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TelemetryEvent[];
      if (Array.isArray(parsed)) buffer.push(...parsed.slice(-MAX));
    }
  } catch {
    /* ignore */
  }

  window.addEventListener("error", (e) => {
    pushTelemetry({
      kind: "error",
      t: Date.now(),
      message: e.message || String(e.error ?? "error"),
      source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined,
      stack: e.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    pushTelemetry({
      kind: "rejection",
      t: Date.now(),
      message: typeof reason === "string" ? reason : reason?.message || "unhandled rejection",
      stack: reason?.stack,
    });
  });

  // Long tasks (> 50ms blocking the main thread). RESULT_CODE_HUNG comes
  // from Chrome killing a tab whose main thread didn't yield in time.
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= 200) {
          pushTelemetry({ kind: "longtask", t: Date.now(), duration: Math.round(entry.duration) });
        }
      }
    });
    po.observe({ entryTypes: ["longtask"] });
  } catch {
    /* longtask not supported */
  }

  // Navigation timing summary.
  try {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav) {
      pushTelemetry({
        kind: "nav",
        t: Date.now(),
        type: nav.type,
        loadMs: Math.round(nav.loadEventEnd),
        domMs: Math.round(nav.domContentLoadedEventEnd),
        ttfbMs: Math.round(nav.responseStart),
      });
    }
  } catch {
    /* ignore */
  }

  // Render timeout heartbeat — if the main thread is wedged we'll never see
  // the next tick fire on schedule; record the gap so we can prove it later.
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const drift = now - last - 2000;
    if (drift > 1500) {
      pushTelemetry({ kind: "render-timeout", t: Date.now(), ms: Math.round(drift) });
    }
    last = now;
  }, 2000);

  pushTelemetry({ kind: "info", t: Date.now(), message: "telemetry initialized" });
}
