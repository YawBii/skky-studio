import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/proof/$projectId")({
  head: ({ params }) => ({ meta: [{ title: `Build proof — ${params.projectId} | yawB` }] }),
  component: ProofPage,
});

interface ProofRow {
  id: string;
  created_at: string;
  ok: boolean;
  generator: string;
  user_request: string | null;
  plan: Record<string, unknown> | null;
  files_written: string[] | null;
  checks: Array<{ name: string; ok: boolean; detail?: string }> | null;
  repairs: Array<{ path: string; reason: string; attempt: number; ok: boolean }> | null;
  critique: {
    score?: number;
    summary?: string;
    issues?: string[];
    redesigned?: boolean;
    generic?: boolean;
  } | null;
  preview_source: string | null;
  limitations: string[] | null;
}

function ProofPage() {
  const { projectId } = Route.useParams();
  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [selected, setSelected] = useState<ProofRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void supabase
      .from("project_proofs")
      .select(
        "id, created_at, ok, generator, user_request, plan, files_written, checks, repairs, critique, preview_source, limitations",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          const rows = data as unknown as ProofRow[];
          setProofs(rows);
          setSelected(rows[0] ?? null);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Build proof</h1>
        </div>
        <Link to="/builder/$projectId" params={{ projectId }} className="text-sm text-primary hover:underline">
          ← Back to builder
        </Link>
      </header>

      {loading ? (
        <div className="p-12 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading proofs…
        </div>
      ) : proofs.length === 0 ? (
        <div className="p-12 text-muted-foreground">
          No proofs yet. Run an agentic build (chat: "build the first version") and the proof will appear here.
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-0 min-h-[calc(100vh-65px)]">
          <aside className="col-span-3 border-r border-border overflow-y-auto">
            {proofs.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`w-full text-left px-4 py-3 border-b border-border hover:bg-muted ${
                  selected?.id === p.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center gap-2 text-sm">
                  {p.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="font-mono text-xs">{new Date(p.created_at).toLocaleString()}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">{p.user_request ?? p.generator}</div>
                <div className="text-xs mt-1">
                  Score: <span className="font-semibold">{p.critique?.score ?? "—"}/100</span>
                </div>
              </button>
            ))}
          </aside>

          <main className="col-span-9 p-6 overflow-y-auto space-y-6">
            {selected ? <ProofDetail proof={selected} /> : <p>Select a proof.</p>}
          </main>
        </div>
      )}
    </div>
  );
}

function ProofDetail({ proof }: { proof: ProofRow }) {
  const plan = (proof.plan ?? {}) as {
    appType?: string;
    designDirection?: string;
    users?: string[];
    workflows?: string[];
    pages?: Array<{ path: string; name: string; purpose: string }>;
    dataModel?: Array<{ table: string; columns: string[]; purpose: string }>;
    integrations?: string[];
    backendNeeds?: string[];
  };
  return (
    <>
      <Section title="User request">
        <p className="text-sm">{proof.user_request ?? "—"}</p>
      </Section>

      <Section title={`Plan — ${plan.appType ?? "—"}`}>
        <p className="text-sm italic text-muted-foreground mb-3">{plan.designDirection ?? ""}</p>
        <Grid>
          <Card label="Users" items={plan.users ?? []} />
          <Card label="Workflows" items={plan.workflows ?? []} />
          <Card label="Integrations" items={plan.integrations ?? []} />
          <Card label="Backend needs" items={plan.backendNeeds ?? []} />
        </Grid>
        <div className="mt-4">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Pages</h4>
          <ul className="text-sm space-y-1">
            {(plan.pages ?? []).map((p) => (
              <li key={p.path}>
                <span className="font-mono text-xs">{p.path}</span> — <strong>{p.name}</strong>: {p.purpose}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Data model</h4>
          <ul className="text-sm space-y-1">
            {(plan.dataModel ?? []).map((t) => (
              <li key={t.table}>
                <span className="font-mono text-xs">{t.table}</span> ({t.columns.join(", ")}) — {t.purpose}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title={`Files written (${proof.files_written?.length ?? 0})`}>
        <ul className="text-xs font-mono grid grid-cols-2 gap-x-4">
          {(proof.files_written ?? []).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Section>

      <Section title={`Checks (${proof.checks?.filter((c) => c.ok).length ?? 0}/${proof.checks?.length ?? 0} passed)`}>
        <ul className="text-sm space-y-1">
          {(proof.checks ?? []).map((c, i) => (
            <li key={i} className="flex items-start gap-2">
              {c.ok ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              )}
              <span>
                <span className="font-mono text-xs">{c.name}</span>
                {c.detail ? <span className="text-muted-foreground"> — {c.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {proof.repairs && proof.repairs.length > 0 && (
        <Section title={`Repairs (${proof.repairs.length})`}>
          <ul className="text-sm space-y-2">
            {proof.repairs.map((r, i) => (
              <li key={i} className="border border-border rounded p-2">
                <div className="font-mono text-xs">{r.path} (attempt {r.attempt}, {r.ok ? "fixed" : "failed"})</div>
                <div className="text-xs text-muted-foreground mt-1">{r.reason}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Critique — ${proof.critique?.score ?? "—"}/100${proof.critique?.redesigned ? " (redesigned)" : ""}`}>
        <p className="text-sm mb-2">{proof.critique?.summary}</p>
        {proof.critique?.issues && proof.critique.issues.length > 0 && (
          <ul className="text-sm list-disc pl-5 text-muted-foreground">
            {proof.critique.issues.map((i, k) => (
              <li key={k}>{i}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Preview source (index.html)">
        {proof.preview_source ? (
          <details>
            <summary className="cursor-pointer text-sm text-primary">Show source ({proof.preview_source.length} chars)</summary>
            <pre className="text-xs bg-muted p-3 rounded mt-2 overflow-auto max-h-96">
              {proof.preview_source}
            </pre>
          </details>
        ) : (
          <p className="text-sm text-muted-foreground">No preview source recorded.</p>
        )}
      </Section>

      <Section title="Remaining limitations">
        <ul className="text-sm list-disc pl-5 text-muted-foreground">
          {(proof.limitations ?? []).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border rounded-lg p-4 bg-card">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function Card({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{label}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="text-sm list-disc pl-5">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
