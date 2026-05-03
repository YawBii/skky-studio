// Build-time identification. These values are captured the first time this
// module is evaluated (per process / per page load).
export const BUILD_VERSION =
  (typeof process !== "undefined" && (process.env?.VERCEL_GIT_COMMIT_SHA || process.env?.GIT_COMMIT)) ||
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env?.VITE_BUILD_VERSION) ||
  "dev";

export const BUILD_TIME = new Date().toISOString();
export const BUILD_MODE =
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env?.MODE) || "unknown";
