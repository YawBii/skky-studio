// Command Center: a compact status pill + collapsible drawer that surfaces
// the most recent / active job for a project without taking over the page.
//
// State is derived from `project_jobs` (via useProjectJobs) and reduced to
// one of: idle | running | waiting | failed | succeeded (transient).
//
// The drawer reuses <JobsPanel /> for deep inspection so the runner/job
// system stays unchanged.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Loader2, HelpCircle, AlertTriangle, CheckCircle2, X,
  ChevronUp, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { JobsPanel } from "@/components/jobs-panel";
import type { Job } from "@/services/jobs";
import { isFailedJobResolved } from "@/lib/job-resolution";

export type CommandCenterMode = "idle" | "running" | "waiting" | "failed" | "succeeded";

export interface CommandCenterDerivedState {
  mode: CommandCenterMode;
  activeJob: Job | null;
  runningCount: number;
  waitingCount: number;
  failedJob: Job | null;
}

/** Reduce a list of jobs to a single Command Center state. */
export function deriveCommandCenterState(jobs: Job[]): CommandCenterDerivedState {
  const running = jobs.filter((j) => j.status === "running" || j.status === "queued");
  const waiting = jobs.filter((j) => j.status === "waiting_for_input");
  // Most recent failed job (jobs are ordered desc by createdAt in listJobs).
  const failedJob = jobs.find((j) => j.status === "failed") ?? null;
  const lastSucceeded = jobs.find((j) => j.status === "succeeded") ?? null;

  let mode: CommandCenterMode = "idle";
  let activeJob: Job | null = null;
  if (waiting.length > 0) { mode = "waiting"; activeJob = waiting[0]; }
  else if (running.length > 0) { mode = "running"; activeJob = running[0]; }
  else if (failedJob) { mode = "failed"; activeJob = failedJob; }
  else if (lastSucceeded) { mode = "succeeded"; activeJob = lastSucceeded; }

  return {
    mode,
    activeJob,
    runningCount: running.length,
    waitingCount: waiting.length,
    failedJob,
  };
}

interface PillProps {
  state: CommandCenterDerivedState;
  open: boolean;
  onToggle: () => void;
}

const PILL_LABEL: Record<CommandCenterMode, string> = {
  idle: "Command Center",
  running: "Running",
  waiting: "Needs answer",
  failed: "Action needed",
  succeeded: "Done",
};

/**
 * Compact floating pill anchored to the bottom-left of its containing
 * relative parent. Click to expand the drawer. Color/icon adapts to state.
 */
export function CommandCenterPill({ state, open, onToggle }: PillProps) {
  const { mode, runningCount } = state;

  const Icon =
    mode === "running" ? Loader2 :
    mode === "waiting" ? HelpCircle :
    mode === "failed" ? AlertTriangle :
    mode === "succeeded" ? CheckCircle2 :
    Activity;

  const label =
    mode === "running" && runningCount > 1 ? `Running ${runningCount} jobs` :
    mode === "running" ? "Running 1 job" :
    PILL_LABEL[mode];

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "absolute bottom-3 left-3 z-30 inline-flex items-center gap-2 h-8 px-3 rounded-full",
        "text-[12px] font-medium border backdrop-blur-md shadow-elevated transition-colors",
        mode === "idle" && "bg-white/[0.06] border-white/10 text-foreground/80 hover:bg-white/[0.1]",
        mode === "running" && "bg-primary/15 border-primary/40 text-primary hover:bg-primary/20",
        mode === "waiting" && "bg-warning/15 border-warning/40 text-warning hover:bg-warning/20",
        mode === "failed" && "bg-destructive/15 border-destructive/40 text-destructive hover:bg-destructive/20",
        mode === "succeeded" && "bg-success/15 border-success/40 text-success hover:bg-success/20",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", mode === "running" && "animate-spin")} />
      <span>{label}</span>
      {open ? <ChevronDown className="h-3 w-3 opacity-70" /> : <ChevronUp className="h-3 w-3 opacity-70" />}
    </button>
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  workspaceId: string;
  focusJobId?: string | null;
  onOpenJobsTab: () => void;
}

/**
 * Bottom-anchored drawer that hosts the full JobsPanel for the active job.
 * Stays inside the preview pane (not full-screen) so chat remains visible.
 */
export function CommandCenterDrawer({
  open, onClose, projectId, workspaceId, focusJobId, onOpenJobsTab,
}: DrawerProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-label="Command Center"
      className={cn(
        "absolute left-3 right-3 bottom-14 top-3 z-30 flex flex-col",
        "md:top-auto md:max-h-[80vh] md:h-[min(80vh,640px)]",
        "rounded-xl border border-white/10 bg-sidebar/95 backdrop-blur-xl shadow-elevated",
        "overflow-hidden",
      )}
    >
      <div className="h-10 px-3 flex items-center gap-2 border-b border-white/5">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <div className="text-[12.5px] font-medium">Command Center</div>
        <button
          type="button"
          onClick={onOpenJobsTab}
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Open full Jobs tab
        </button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <JobsPanel
          projectId={projectId}
          workspaceId={workspaceId}
          initialExpandedJobId={focusJobId ?? undefined}
        />
      </div>
    </div>
  );
}

/**
 * Hook that auto-opens the drawer when state requires attention, returns to
 * the Preview tab after a build succeeds, and briefly shows the "Done" pill
 * before collapsing back to idle.
 *
 * Pure UI orchestration — does NOT touch the runner.
 */
export function useCommandCenterAutoOpen(
  state: CommandCenterDerivedState,
  opts: {
    onJobSucceeded?: (job: Job) => void;
    onJobFailed?: (job: Job) => void;
  } = {},
) {
  const [open, setOpen] = useState(false);
  const [showSucceeded, setShowSucceeded] = useState<string | null>(null);
  const lastJobIdRef = useRef<string | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  const { mode, activeJob } = state;

  // Auto-open when running/waiting/failed.
  useEffect(() => {
    if (mode === "waiting" || mode === "failed") setOpen(true);
  }, [mode]);

  // Detect job-just-completed transitions to fire callbacks + transient "Done".
  useEffect(() => {
    if (!activeJob) return;
    const prevStatus = lastJobIdRef.current === activeJob.id ? lastStatusRef.current : null;
    if (prevStatus && prevStatus !== activeJob.status) {
      if (activeJob.status === "succeeded") {
        opts.onJobSucceeded?.(activeJob);
        setShowSucceeded(activeJob.id);
        // Auto-collapse the pill back to "idle" after 4s.
        const t = setTimeout(() => setShowSucceeded((id) => (id === activeJob.id ? null : id)), 4000);
        // Also auto-close the drawer on success.
        setOpen(false);
        return () => clearTimeout(t);
      }
      if (activeJob.status === "failed") {
        opts.onJobFailed?.(activeJob);
      }
    }
    lastJobIdRef.current = activeJob.id;
    lastStatusRef.current = activeJob.status;
  }, [activeJob, opts]);

  // Effective mode used for the pill: keep "succeeded" sticky for the brief
  // confirmation window even if derived state has already moved to idle.
  const effectiveMode: CommandCenterMode = useMemo(() => {
    if (showSucceeded && mode === "idle") return "succeeded";
    return mode;
  }, [mode, showSucceeded]);

  return { open, setOpen, effectiveMode };
}
