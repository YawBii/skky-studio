// Lightweight diagnostics store. Captures runtime values and a rolling event
// log so the floating <DiagnosticsPanel /> can show them and let the user
// copy everything to share with support / the AI.
import { useSyncExternalStore } from "react";

export type DiagState = {
  hasSession: boolean | null;
  userId: string | null;
  workspaceId: string | null;
  workspaceSource: string | null;
  projectId: string | null;
  activeProjectId: string | null;
  projectsSource: string | null;
  projectsCount: number | null;
  workspacesCount: number | null;
  workspaceMembersError: unknown;
  projectsQueryError: unknown;
  workspaceInsertPayload: unknown;
  workspaceInsertError: unknown;
  workspaceSelectError: unknown;
  projectInsertPayload: unknown;
  projectInsertError: unknown;
  projectSelectError: unknown;
  // Job runner
  jobId: string | null;
  jobType: string | null;
  jobStatus: string | null;
  currentStep: string | null;
  currentStepId: string | null;
  providerConnectionStatus: Record<string, string> | null;
  lastError: string | null;
  retryCount: number | null;
  // Interactive job questions
  questionId: string | null;
  questionKind: string | null;
  answerSaved: boolean | null;
  resumeTriggered: boolean | null;
};

export type DiagEvent = { ts: string; label: string; data: unknown };

const initialState: DiagState = {
  hasSession: null,
  userId: null,
  workspaceId: null,
  workspaceSource: null,
  projectId: null,
  projectsSource: null,
  projectsCount: null,
  workspacesCount: null,
  workspaceMembersError: undefined,
  projectsQueryError: undefined,
  workspaceInsertPayload: undefined,
  workspaceInsertError: undefined,
  workspaceSelectError: undefined,
  projectInsertPayload: undefined,
  projectInsertError: undefined,
  projectSelectError: undefined,
  jobId: null,
  jobType: null,
  jobStatus: null,
  currentStep: null,
  providerConnectionStatus: null,
  lastError: null,
  retryCount: null,
  currentStepId: null,
  questionId: null,
  questionKind: null,
  answerSaved: null,
  resumeTriggered: null,
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
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return String(v);
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
function getSnapshot() {
  return snapshot;
}

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
