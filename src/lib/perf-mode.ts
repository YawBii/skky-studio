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

interface CallRecord {
  times: number[];
}
const calls = new Map<string, CallRecord>();

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
