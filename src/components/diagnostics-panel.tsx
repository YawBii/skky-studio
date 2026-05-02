import { useState } from "react";
import { Bug, Copy, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDiagnostics, buildDiagnosticsReport, clearDiag } from "@/lib/diagnostics";

const HANDS_OFF_NOTE = `HANDS-OFF NOTE
This diagnostics block is generated automatically by yawB.
Do not edit values by hand — they reflect the live runtime state of the
authenticated app (session, selected workspace/project, last insert/select
errors, row counts). Paste this entire block into a support ticket or
share it with the AI assistant. The assistant should treat the values
below as ground truth and use them to diagnose the failure rather than
asking the user to re-describe the symptom.`;

export function DiagnosticsPanel() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { state, events } = useDiagnostics();

  async function copyAll() {
    const report = `${HANDS_OFF_NOTE}\n\n${buildDiagnosticsReport()}`;
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      toast.success("Diagnostics copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select-and-copy via a temporary textarea.
      const ta = document.createElement("textarea");
      ta.value = report;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast.success("Diagnostics copied"); }
      catch { toast.error("Couldn't copy. Select the text manually."); }
      document.body.removeChild(ta);
    }
  }

  if (!open) {
    const hasError = Boolean(
      state.workspaceInsertError ||
      state.workspaceSelectError ||
      state.projectInsertError ||
      state.projectSelectError
    );
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed left-3 z-40 bottom-[calc(env(safe-area-inset-bottom)+4rem)] md:bottom-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-lg backdrop-blur transition ${
          hasError
            ? "border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/25"
            : "border-white/10 bg-background/80 text-muted-foreground hover:text-foreground hover:border-white/25"
        }`}
        aria-label="Open diagnostics"
      >
        <Bug className="h-3 w-3" />
        Diagnostics
        {hasError && <span className="ml-1 rounded-full bg-destructive px-1.5 text-[9px] text-destructive-foreground">!</span>}
      </button>
    );
  }

  return (
    <div className="fixed left-3 z-50 bottom-[calc(env(safe-area-inset-bottom)+4rem)] md:bottom-3 w-[420px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/10 bg-background/95 backdrop-blur shadow-2xl">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Bug className="h-3 w-3" /> Diagnostics
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyAll}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] hover:bg-white/5"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            Copy all
          </button>
          <button
            type="button"
            onClick={() => { clearDiag(); toast("Diagnostics cleared"); }}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] hover:bg-white/5"
            title="Clear captured state and events"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center rounded-md border border-white/10 p-1 hover:bg-white/5"
            aria-label="Close diagnostics"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </header>

      <div className="max-h-[60vh] overflow-y-auto px-3 py-2 text-[11.5px] font-mono leading-relaxed">
        <Section title="Hands-off note">
          <p className="whitespace-pre-wrap text-[11px] text-muted-foreground">{HANDS_OFF_NOTE}</p>
        </Section>

        <Section title="State">
          <Row k="hasSession" v={fmt(state.hasSession)} />
          <Row k="userId" v={fmt(state.userId)} />
          <Row k="workspaceId" v={fmt(state.workspaceId)} />
          <Row k="projectId" v={fmt(state.projectId)} />
          <Row k="workspacesCount" v={fmt(state.workspacesCount)} />
          <Row k="projectsCount" v={fmt(state.projectsCount)} />
        </Section>

        <Section title="Workspace create">
          <Block label="workspaceInsertPayload" v={state.workspaceInsertPayload} />
          <Block label="workspaceInsertError" v={state.workspaceInsertError} error />
          <Block label="workspaceSelectError" v={state.workspaceSelectError} error />
        </Section>

        <Section title="Project create">
          <Block label="projectInsertPayload" v={state.projectInsertPayload} />
          <Block label="projectInsertError" v={state.projectInsertError} error />
          <Block label="projectSelectError" v={state.projectSelectError} error />
        </Section>

        <Section title={`Events (${events.length})`}>
          {events.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No events captured yet.</p>
          ) : (
            <div className="space-y-1.5">
              {events.map((e, i) => (
                <details key={i} className="rounded border border-white/5 bg-white/[0.02] px-2 py-1">
                  <summary className="cursor-pointer text-[11px]">
                    <span className="text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</span>{" "}
                    <span className="text-foreground">{e.label}</span>
                  </summary>
                  <pre className="mt-1 whitespace-pre-wrap break-all text-[10.5px] text-muted-foreground">
                    {safeStringify(e.data)}
                  </pre>
                </details>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h3 className="mb-1 text-[10px] font-sans font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="break-all">{v}</span>
    </div>
  );
}

function Block({ label, v, error }: { label: string; v: unknown; error?: boolean }) {
  const empty = v === undefined || v === null;
  return (
    <div className="mb-1">
      <div className={`text-[10.5px] uppercase tracking-[0.16em] ${error && !empty ? "text-destructive" : "text-muted-foreground"}`}>
        {label}
      </div>
      <pre className={`mt-0.5 whitespace-pre-wrap break-all rounded border px-2 py-1 text-[10.5px] ${
        error && !empty
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-white/5 bg-white/[0.02] text-muted-foreground"
      }`}>
        {empty ? "—" : safeStringify(v)}
      </pre>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null) return "—";
  if (v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function safeStringify(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}
