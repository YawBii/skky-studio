// Lightweight diagnostics store. Captures runtime values and a rolling event
// log so the floating <DiagnosticsPanel /> can show them and let the user
// copy everything to share with support / the AI.
import { useSyncExternalStore } from "react";

export type DiagState = {
  hasSession: boolean | null;
  userId: string | null;
  workspaceId: string | null;
  projectId: string | null;
  projectsCount: number | null;
  workspacesCount: number | null;
  workspaceInsertPayload: unknown;
  workspaceInsertError: unknown;
  workspaceSelectError: unknown;
  projectInsertPayload: unknown;
  projectInsertError: unknown;
  projectSelectError: unknown;
};

export type DiagEvent = { ts: string; label: string; data: unknown };

const initialState: DiagState = {
  hasSession: null,
  userId: null,
  workspaceId: null,
  projectId: null,
  projectsCount: null,
  workspacesCount: null,
  workspaceInsertPayload: undefined,
  workspaceInsertError: undefined,
  workspaceSelectError: undefined,
  projectInsertPayload: undefined,
  projectInsertError: undefined,
  projectSelectError: undefined,
};

let state: DiagState = { ...initialState };
let events: DiagEvent[] = [];
const MAX_EVENTS = 80;
const listeners = new Set<() => void>();
let snapshot = { state, events };

function emit() {
  snapshot = { state, events };
  listeners.forEach((l) => l());
}

export function setDiag(patch: Partial<DiagState>) {
  state = { ...state, ...patch };
  emit();
}

export function pushDiag(label: string, data: unknown) {
  const evt: DiagEvent = { ts: new Date().toISOString(), label, data: safeClone(data) };
  events = [evt, ...events].slice(0, MAX_EVENTS);
  emit();
}

export function clearDiag() {
  state = { ...initialState };
  events = [];
  emit();
}

function safeClone(v: unknown): unknown {
  try { return JSON.parse(JSON.stringify(v)); } catch { return String(v); }
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function getSnapshot() { return snapshot; }

export function useDiagnostics() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function buildDiagnosticsReport(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "n/a";
  const url = typeof window !== "undefined" ? window.location.href : "n/a";
  const lines: string[] = [];
  lines.push("yawB diagnostics report");
  lines.push(`when: ${new Date().toISOString()}`);
  lines.push(`url:  ${url}`);
  lines.push(`ua:   ${ua}`);
  lines.push("");
  lines.push("--- state ---");
  lines.push(JSON.stringify(state, null, 2));
  lines.push("");
  lines.push("--- events (newest first) ---");
  for (const e of events) lines.push(`[${e.ts}] ${e.label}\n${JSON.stringify(e.data, null, 2)}`);
  return lines.join("\n");
}
