// Lovable-style summary card: displayed in chat after a job reaches a
// terminal state. Pulls data straight from project_jobs + step output and
// produces a status, what-changed bullets, files touched (when reported),
// proof, and 1–3 suggested next actions.
import { useMemo, useState } from "react";
import {
  Check,
  AlertTriangle,
  X,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  FileText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job, JobStep } from "@/services/jobs";
import { toast } from "sonner";

export type SummaryStatus = "done" | "needs_attention" | "failed" | "waiting";

export interface NextAction {
  id: string;
  label: string;
  onClick?: () => void;
}

interface Props {
  job: Job;
  steps: JobStep[];
  nextActions?: NextAction[];
}

function deriveStatus(job: Job, steps: JobStep[]): SummaryStatus {
  if (job.status === "waiting_for_input") return "waiting";
  if (job.status === "succeeded") return "done";
  if (steps.some((s) => s.status === "failed")) return "failed";
  if (job.status === "failed") return "failed";
  return "needs_attention";
}

function pickStdoutTail(steps: JobStep[]): string | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const out = steps[i].output as Record<string, unknown> | undefined;
    if (out && typeof out.stdoutTail === "string") return out.stdoutTail as string;
  }
  return null;
}

function pickField<T = unknown>(steps: JobStep[], key: string): T | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const out = steps[i].output as Record<string, unknown> | undefined;
    if (out && key in out) return out[key] as T;
  }
  return null;
}

function pickFiles(steps: JobStep[]): string[] {
  for (let i = steps.length - 1; i >= 0; i--) {
    const out = steps[i].output as Record<string, unknown> | undefined;
    const files = out?.filesTouched ?? out?.files;
    if (Array.isArray(files)) {
      return files.filter((f): f is string => typeof f === "string");
    }
  }
  return [];
}

const STATUS_META: Record<SummaryStatus, { label: string; tone: string; Icon: typeof Check }> = {
  done: { label: "Done", tone: "text-success bg-success/10 border-success/30", Icon: Check },
  failed: {
    label: "Failed",
    tone: "text-destructive bg-destructive/10 border-destructive/30",
    Icon: X,
  },
  needs_attention: {
    label: "Needs attention",
    tone: "text-warning bg-warning/10 border-warning/30",
    Icon: AlertTriangle,
  },
  waiting: {
    label: "Waiting for answer",
    tone: "text-warning bg-warning/10 border-warning/30",
    Icon: HelpCircle,
  },
};

export function TaskSummaryCard({ job, steps, nextActions = [] }: Props) {
  const [expanded, setExpanded] = useState(false);
  const status = useMemo(() => deriveStatus(job, steps), [job, steps]);
  const meta = STATUS_META[status];

  const stdoutTail = pickStdoutTail(steps);
  const command = pickField<string>(steps, "command");
  const exitCode = pickField<number>(steps, "exitCode");
  const files = pickFiles(steps);
  const generator = pickField<string>(steps, "generator");
  const archetype = pickField<string>(steps, "archetype");
  const designSignature = pickField<string>(steps, "designSignature");
  const filesWritten = (() => {
    const fw = pickField<unknown>(steps, "filesWritten");
    return Array.isArray(fw) ? fw.filter((f): f is string => typeof f === "string") : null;
  })();
  const previewReady = pickField<boolean>(steps, "previewReady");
  const regenerationSeed = pickField<string>(steps, "regenerationSeed");
  const visualFingerprint = pickField<string>(steps, "visualFingerprint");
  const designMode = pickField<string>(steps, "designMode");
  const heroLayout = pickField<string>(steps, "heroLayout");
  const palette = pickField<string>(steps, "palette");
  const typography = pickField<string>(steps, "typography");
  const hasGenerator = Boolean(
    generator ||
    archetype ||
    designSignature ||
    filesWritten ||
    previewReady !== null ||
    regenerationSeed ||
    visualFingerprint ||
    designMode,
  );
  const isAiPlanUnwired =
    job.type === "ai.plan" &&
    (job.error?.includes("not wired") || stdoutTail?.includes("not wired"));

  const startedTs = job.startedAt ? Date.parse(job.startedAt) : Date.parse(job.createdAt);
  const finishedTs = job.finishedAt ? Date.parse(job.finishedAt) : Date.now();
  const durationMs = Math.max(0, finishedTs - startedTs);

  const changed: string[] = [];
  if (isAiPlanUnwired) {
    changed.push("Provider call is not wired yet — no real changes were made.");
  } else {
    for (const s of steps) {
      if (s.status === "succeeded") changed.push(`${s.title} — ok`);
      else if (s.status === "failed")
        changed.push(`${s.title} — failed${s.error ? `: ${s.error}` : ""}`);
      else if (s.status === "skipped") changed.push(`${s.title} — skipped`);
    }
    if (changed.length === 0) changed.push("No step-level changes recorded.");
  }

  const copyText = () => {
    const parts = [
      `Summary: ${meta.label}`,
      `Job: ${job.type} (${job.id})`,
      `Duration: ${Math.round(durationMs / 100) / 10}s`,
      command ? `Command: ${command}` : "",
      typeof exitCode === "number" ? `Exit: ${exitCode}` : "",
      "",
      "What changed:",
      ...changed.map((c) => `  • ${c}`),
      "",
      files.length ? "Files touched:" : "",
      ...files.map((f) => `  • ${f}`),
      hasGenerator ? "" : "",
      hasGenerator ? "Generator:" : "",
      generator ? `  generator: ${generator}` : "",
      archetype ? `  archetype: ${archetype}` : "",
      designSignature ? `  designSignature: ${designSignature}` : "",
      filesWritten ? `  filesWritten: ${filesWritten.join(", ")}` : "",
      previewReady !== null ? `  previewReady: ${previewReady}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    void navigator.clipboard.writeText(parts);
    toast.success("Summary copied");
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 overflow-hidden">
      <div
        className={cn(
          "px-3 py-2 text-[11.5px] font-medium flex items-center gap-1.5 border-b border-white/5",
          meta.tone,
        )}
      >
        <meta.Icon className="h-3.5 w-3.5" />
        Summary · {meta.label}
        <button
          type="button"
          onClick={copyText}
          className="ml-auto inline-flex items-center gap-1 text-[10.5px] opacity-80 hover:opacity-100"
          title="Copy summary"
        >
          <ClipboardCopy className="h-3 w-3" /> Copy
        </button>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1">
            What changed
          </div>
          <ul className="space-y-0.5">
            {changed.map((c, i) => (
              <li key={i} className="text-[11.5px] text-foreground/85 flex gap-1.5">
                <span className="text-muted-foreground/60">•</span>
                <span className="whitespace-pre-wrap">{c}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <FileText className="h-3 w-3" /> Files touched
          </div>
          {files.length === 0 ? (
            <div className="text-[11.5px] text-muted-foreground">No file list reported.</div>
          ) : (
            <ul className="space-y-0.5">
              {files.map((f) => (
                <li key={f} className="text-[11px] font-mono text-foreground/80 truncate">
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasGenerator && (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-2">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" /> Generator
            </div>
            <dl className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5 text-[10.5px] font-mono">
              {generator && (
                <>
                  <dt className="text-muted-foreground">generator</dt>
                  <dd className="text-foreground/90">{generator}</dd>
                </>
              )}
              {archetype && (
                <>
                  <dt className="text-muted-foreground">archetype</dt>
                  <dd className="text-foreground/90">{archetype}</dd>
                </>
              )}
              {designSignature && (
                <>
                  <dt className="text-muted-foreground">designSignature</dt>
                  <dd className="text-foreground/90 break-all">{designSignature}</dd>
                </>
              )}
              {regenerationSeed && (
                <>
                  <dt className="text-muted-foreground">regenerationSeed</dt>
                  <dd className="text-foreground/90 break-all">{regenerationSeed}</dd>
                </>
              )}
              {designMode && (
                <>
                  <dt className="text-muted-foreground">designMode</dt>
                  <dd className="text-foreground/90">{designMode}</dd>
                </>
              )}
              {heroLayout && (
                <>
                  <dt className="text-muted-foreground">heroLayout</dt>
                  <dd className="text-foreground/90">{heroLayout}</dd>
                </>
              )}
              {palette && (
                <>
                  <dt className="text-muted-foreground">palette</dt>
                  <dd className="text-foreground/90">{palette}</dd>
                </>
              )}
              {typography && (
                <>
                  <dt className="text-muted-foreground">typography</dt>
                  <dd className="text-foreground/90">{typography}</dd>
                </>
              )}
              {visualFingerprint && (
                <>
                  <dt className="text-muted-foreground">visualFingerprint</dt>
                  <dd className="text-foreground/90 break-all">{visualFingerprint}</dd>
                </>
              )}
              {filesWritten && (
                <>
                  <dt className="text-muted-foreground">filesWritten</dt>
                  <dd className="text-foreground/90">{filesWritten.join(", ") || "—"}</dd>
                </>
              )}
              {previewReady !== null && (
                <>
                  <dt className="text-muted-foreground">previewReady</dt>
                  <dd
                    className={cn(
                      "text-foreground/90",
                      previewReady ? "text-success" : "text-warning",
                    )}
                  >
                    {previewReady ? "✓ true" : "false"}
                  </dd>
                </>
              )}
            </dl>
          </div>
        )}

        <div className="rounded-md border border-white/5 bg-black/30 p-2">
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1">
            Proof
          </div>
          <dl className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5 text-[10.5px] font-mono">
            <dt className="text-muted-foreground">job id</dt>
            <dd className="text-foreground/90 break-all">{job.id}</dd>
            <dt className="text-muted-foreground">type</dt>
            <dd className="text-foreground/90">{job.type}</dd>
            <dt className="text-muted-foreground">status</dt>
            <dd className="text-foreground/90">{job.status}</dd>
            <dt className="text-muted-foreground">duration</dt>
            <dd className="text-foreground/90">{Math.round(durationMs / 100) / 10}s</dd>
            {command && (
              <>
                <dt className="text-muted-foreground">command</dt>
                <dd className="text-foreground/90 break-all">{command}</dd>
              </>
            )}
            {typeof exitCode === "number" && (
              <>
                <dt className="text-muted-foreground">exit</dt>
                <dd className={cn("text-foreground/90", exitCode !== 0 && "text-destructive")}>
                  {exitCode}
                </dd>
              </>
            )}
          </dl>
          {(stdoutTail || job.error) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {expanded ? "Hide raw output" : "Show raw output"}
            </button>
          )}
          {expanded && (stdoutTail || job.error) && (
            <pre className="mt-1 text-[10.5px] font-mono text-muted-foreground/90 whitespace-pre-wrap max-h-48 overflow-y-auto bg-black/40 rounded p-2">
              {job.error ? `error: ${job.error}\n\n` : ""}
              {stdoutTail ?? ""}
            </pre>
          )}
        </div>

        {nextActions.length > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1">
              Next actions
            </div>
            <div className="flex flex-wrap gap-1.5">
              {nextActions.slice(0, 3).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => a.onClick?.()}
                  className="inline-flex items-center px-2 py-1 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-[11px]"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
