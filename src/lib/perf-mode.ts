// Performance kill switch + dev fetch-loop diagnostics.
// Enable safe mode at runtime with:
//   localStorage.setItem("yawb:safe-mode", "1")
// Disable: localStorage.removeItem("yawb:safe-mode")
//
// In safe mode, heavy panels, integrations popovers, diagnostics-heavy panels,
// chat auto-jobs and background refreshes do not mount or run.

export function isSafeMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("yawb:safe-mode") === "1";
  } catch {
    return false;
  }
}

/**
 * Coarse iPad / tablet / mobile detection. Used to disable expensive visual
 * effects (backdrop-blur) and avoid heavy iframe remounts on Safari iPad,
 * where the builder was hitting "page not responding" warnings.
 */
export function isTabletOrMobile(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const w = window.innerWidth || 0;
    if (w > 0 && w <= 1180) return true;
    const ua = window.navigator?.userAgent ?? "";
    if (/iPad|iPhone|iPod|Android|Mobile/i.test(ua)) return true;
    // iPadOS 13+ reports as Mac with touch points.
    if (
      /Macintosh/i.test(ua) &&
      typeof window.navigator?.maxTouchPoints === "number" &&
      window.navigator.maxTouchPoints > 1
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Lightweight runtime perf counters for builder debugging.
 * Read with `(window as any).__yawbPerf` in the browser.
 */
export interface YawbPerfCounters {
  chatMounted: number;
  commandCenterMounted: number;
  iframeMounted: number;
  activePolls: number;
  iframeReloads: number;
  projectFilesFetches: number;
  builderRenders: number;
  lastRenderAt: number;
}

export const perfCounters: YawbPerfCounters = {
  chatMounted: 0,
  commandCenterMounted: 0,
  iframeMounted: 0,
  activePolls: 0,
  iframeReloads: 0,
  projectFilesFetches: 0,
  builderRenders: 0,
  lastRenderAt: 0,
};

if (typeof window !== "undefined") {
  (window as unknown as { __yawbPerf?: YawbPerfCounters }).__yawbPerf = perfCounters;
}

export function bumpPerf<K extends keyof YawbPerfCounters>(key: K, delta = 1): void {
  if (key === "lastRenderAt") {
    perfCounters.lastRenderAt = Date.now();
    return;
  }
  (perfCounters[key] as number) = (perfCounters[key] as number) + delta;
}

export function setPerf<K extends keyof YawbPerfCounters>(key: K, value: number): void {
  perfCounters[key] = value;
}

interface CallRecord {
  times: number[];
}
const calls = new Map<string, CallRecord>();

interface RenderRecord {
  count: number;
  startedAt: number;
}
const renders = new Map<string, RenderRecord>();

/**
 * Dev-only: warns if `key` is invoked more than 3 times in 5 seconds.
 * No-op outside dev. Safe to call in render or effects.
 */
export function noteFetchCall(key: string): void {
  if (typeof window === "undefined") return;
  if (!import.meta.env?.DEV) return;
  const now = Date.now();
  const rec = calls.get(key) ?? { times: [] };
  rec.times = rec.times.filter((t) => now - t < 5000);
  rec.times.push(now);
  calls.set(key, rec);
  if (rec.times.length > 3) {
    console.warn(
      `[yawb] fetch-loop suspect: "${key}" fired ${rec.times.length} times in <5s — check effect deps`,
    );
  }
}

/**
 * Dev-only: warns when a component renders suspiciously often.
 * Useful for catching browser-freezing render loops without changing UI.
 */
export function noteRender(key: string): void {
  if (typeof window === "undefined") return;
  if (!import.meta.env?.DEV) return;
  const now = Date.now();
  const rec = renders.get(key) ?? { count: 0, startedAt: now };
  const fresh = now - rec.startedAt > 5000 ? { count: 0, startedAt: now } : rec;
  fresh.count += 1;
  renders.set(key, fresh);
  if (fresh.count === 30) {
    console.warn(
      `[yawb] render-loop suspect: "${key}" rendered ${fresh.count} times in <5s — check state/effect churn`,
    );
  }
}
