// A compact, always-visible strip at the top of PreviewPane showing the
// latest task's status and a quick proof timeline (steps). Tap to deep-link
// into the Jobs tab focused on that exact run, or tap "Open in chat" to
// reveal the full TaskSummaryCard. Lets phone users see what changed without
// opening chat.
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader2,
  AlertTriangle,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import type { Job, JobStep } from "@/services/jobs";
import { cn } from "@/lib/utils";

interface Props {
  jobs: Job[];
  stepsByJob: Record<string, JobStep[]>;
  onJumpToJob: (jobId: string) => void;
  onOpenInChat: (jobId: string) => void;
}

const TERMINAL = new Set(["succeeded", "failed", "cancelled", "waiting_for_input"]);

function statusMeta(j: Job) {
  switch (j.status) {
    case "succeeded":
      return { Icon: Check, tone: "text-success bg-success/10 border-success/30", label: "Done" };
    case "failed":
      return {
        Icon: X,
        tone: "text-destructive bg-destructive/10 border-destructive/30",
        label: "Failed",
      };
    case "waiting_for_input":
      return {
        Icon: AlertTriangle,
        tone: "text-warning bg-warning/10 border-warning/30",
        label: "Needs answer",
      };
    case "running":
    case "queued":
      return {
        Icon: Loader2,
        tone: "text-primary bg-primary/10 border-primary/30",
        label: j.status === "running" ? "Running" : "Queued",
      };
    default:
      return {
        Icon: Check,
        tone: "text-muted-foreground bg-white/5 border-white/10",
        label: j.status,
      };
  }
}

export function PreviewSummaryStrip({ jobs, stepsByJob, onJumpToJob, onOpenInChat }: Props) {
  // Pick the most recent job (running OR terminal). Sort by createdAt desc.
  const latest = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return (
      sorted.find(
        (j) => TERMINAL.has(j.status) || j.status === "running" || j.status === "queued",
      ) ?? null
    );
  }, [jobs]);

  const [expanded, setExpanded] = useState(false);

  if (!latest) return null;

  const meta = statusMeta(latest);
  const steps = stepsByJob[latest.id] ?? [];
  const spinning = latest.status === "running" || latest.status === "queued";

  return (
    <div
      data-testid="preview-summary-strip"
      data-job-id={latest.id}
      className={cn(
        "border-b border-white/5 bg-background/60 backdrop-blur-xl",
        expanded && "shadow-elevated",
      )}
    >
      <div className="px-2 sm:px-4 h-10 flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 h-6 rounded-md border text-[10.5px] uppercase tracking-[0.14em] shrink-0",
            meta.tone,
          )}
        >
          <meta.Icon className={cn("h-3 w-3", spinning && "animate-spin")} />
          {meta.label}
        </span>
        <span className="text-[12px] text-foreground/85 truncate min-w-0 flex-1">
          {latest.title || latest.type}
        </span>
        <button
          type="button"
          data-testid="preview-summary-jump"
          onClick={() => onJumpToJob(latest.id)}
          className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground rounded-md px-2 h-7 hover:bg-white/[0.05] touch-manipulation"
          title="Open run details"
        >
          <ExternalLink className="h-3 w-3" /> Run details
        </button>
        <button
          type="button"
          data-testid="preview-summary-chat"
          onClick={() => onOpenInChat(latest.id)}
          className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground rounded-md px-2 h-7 hover:bg-white/[0.05] touch-manipulation"
          title="Show full summary in chat"
        >
          <MessageSquare className="h-3 w-3" /> In chat
        </button>
        <button
          type="button"
          data-testid="preview-summary-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.05] touch-manipulation shrink-0"
          aria-label={expanded ? "Hide proof timeline" : "Show proof timeline"}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-2 sm:px-4 pb-3 pt-1 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Proof timeline
          </div>
          {steps.length === 0 ? (
            <div className="text-[12px] text-muted-foreground">No step output yet.</div>
          ) : (
            <ol className="space-y-1">
              {steps.map((s) => (
                <li
                  key={s.id}
                  data-testid={`preview-summary-step-${s.id}`}
                  className="flex items-start gap-2 text-[11.5px]"
                >
                  <StepDot status={s.status} />
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground/90 truncate">{s.title}</div>
                    {s.error && (
                      <div className="text-destructive text-[11px] truncate" title={s.error}>
                        {s.error}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onJumpToJob(latest.id)}
              className="inline-flex items-center gap-1 text-[11px] rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-2 h-8 touch-manipulation min-h-8"
            >
              <ExternalLink className="h-3 w-3" /> Open run details
            </button>
            <button
              type="button"
              onClick={() => onOpenInChat(latest.id)}
              className="inline-flex items-center gap-1 text-[11px] rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-2 h-8 touch-manipulation min-h-8"
            >
              <MessageSquare className="h-3 w-3" /> Show full summary in chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepDot({ status }: { status: JobStep["status"] }) {
  if (status === "succeeded") return <Check className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />;
  if (status === "failed") return <X className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />;
  if (status === "running")
    return <Loader2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0 animate-spin" />;
  if (status === "skipped")
    return (
      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 inline-block mt-1.5 shrink-0" />
    );
  return <span className="h-2 w-2 rounded-full bg-white/20 inline-block mt-1.5 shrink-0" />;
}
