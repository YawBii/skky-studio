// Command Center: compact job status UI for yawB.
//
// Important builder rule:
// Preview regenerate / repair jobs must NEVER blank the preview or trap the project.
// They are best-effort background proofs only. The visible preview should stay on the
// last good project_files while those jobs run or queue.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Loader2,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronUp,
  ChevronDown,
  GripHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { JobsPanel } from "@/components/jobs-panel";
import type { Job } from "@/services/jobs";
import { isFailedJobResolved } from "@/lib/job-resolution";
import { isStaleActiveJob } from "@/lib/job-guards";
import { isTabletOrMobile, setPerf } from "@/lib/perf-mode";

export type CommandCenterMode = "idle" | "running" | "waiting" | "failed" | "succeeded";

export interface CommandCenterDerivedState {
  mode: CommandCenterMode;
  activeJob: Job | null;
  runningCount: number;
  waitingCount: number;
  failedJob: Job | null;
}

function jobInput(job: Job): Record<string, unknown> {
  return (job.input ?? {}) as Record<string, unknown>;
}

function isPreviewBackgroundJob(job: Job): boolean {
  if (job.type !== "ai.generate_changes" && job.type !== "ai.repair_failure") return false;
  const source = String(jobInput(job).source ?? "");
  return (
    source === "preview_regenerate_design" ||
    source === "preview_visual_quality_repair" ||
    source === "direct_build_controller" ||
    /regenerate design|repair preview/i.test(job.title)
  );
}

function isBlockingRunningJob(job: Job): boolean {
  if (job.status !== "running" && job.status !== "queued") return false;
  if (isStaleActiveJob(job)) return false;
  if (isPreviewBackgroundJob(job)) return false;
  return true;
}

function isBlockingWaitingJob(job: Job): boolean {
  if (job.status !== "waiting_for_input") return false;
  if (isPreviewBackgroundJob(job)) return false;
  return true;
}

/** Reduce a list of jobs to a single Command Center state. */
export function deriveCommandCenterState(jobs: Job[]): CommandCenterDerivedState {
  const running = jobs.filter(isBlockingRunningJob);
  const waiting = jobs.filter(isBlockingWaitingJob);
  const failedJob =
    jobs.find(
      (j) =>
        j.status === "failed" && !isPreviewBackgroundJob(j) && !isFailedJobResolved(j, jobs),
    ) ?? null;
  const lastSucceeded = jobs.find((j) => j.status === "succeeded") ?? null;

  let mode: CommandCenterMode = "idle";
  let activeJob: Job | null = null;
  if (waiting.length > 0) {
    mode = "waiting";
    activeJob = waiting[0];
  } else if (running.length > 0) {
    mode = "running";
    activeJob = running[0];
  } else if (failedJob) {
    mode = "failed";
    activeJob = failedJob;
  } else if (lastSucceeded) {
    mode = "succeeded";
    activeJob = lastSucceeded;
  }

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

export function CommandCenterPill({ state, open, onToggle }: PillProps) {
  const { mode, runningCount } = state;
  const Icon =
    mode === "running"
      ? Loader2
      : mode === "waiting"
        ? HelpCircle
        : mode === "failed"
          ? AlertTriangle
          : mode === "succeeded"
            ? CheckCircle2
            : Activity;
  const label =
    mode === "running" && runningCount > 1
      ? `Running ${runningCount} jobs`
      : mode === "running"
        ? "Running 1 job"
        : PILL_LABEL[mode];

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "absolute bottom-3 left-3 z-30 inline-flex items-center gap-2 h-8 px-3 rounded-full",
        "text-[12px] font-medium border backdrop-blur-md shadow-elevated transition-colors",
        mode === "idle" &&
          "bg-white/[0.06] border-white/10 text-foreground/80 hover:bg-white/[0.1]",
        mode === "running" && "bg-primary/15 border-primary/40 text-primary hover:bg-primary/20",
        mode === "waiting" && "bg-warning/15 border-warning/40 text-warning hover:bg-warning/20",
        mode === "failed" &&
          "bg-destructive/15 border-destructive/40 text-destructive hover:bg-destructive/20",
        mode === "succeeded" && "bg-success/15 border-success/40 text-success hover:bg-success/20",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", mode === "running" && "animate-spin")} />
      <span>{label}</span>
      {open ? (
        <ChevronDown className="h-3 w-3 opacity-70" />
      ) : (
        <ChevronUp className="h-3 w-3 opacity-70" />
      )}
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
  previewBlocked?: boolean;
  hasActiveJob?: boolean;
}

const HEIGHT_KEY = "yawb:command-center:height";
const MIN_HEIGHT = 220;

function loadHeight(defaultPx: number): number {
  if (typeof window === "undefined") return defaultPx;
  try {
    const raw = window.localStorage.getItem(HEIGHT_KEY);
    if (!raw) return defaultPx;
    const n = Number(raw);
    return Number.isFinite(n) && n >= MIN_HEIGHT ? n : defaultPx;
  } catch {
    return defaultPx;
  }
}

export function CommandCenterDrawer({
  open,
  onClose,
  projectId,
  workspaceId,
  focusJobId,
  onOpenJobsTab,
  previewBlocked,
  hasActiveJob,
}: DrawerProps) {
  const defaultPx = typeof window !== "undefined" ? Math.round(window.innerHeight * 0.45) : 480;
  const lightweight = useMemo(() => isTabletOrMobile(), []);
  const [height, setHeight] = useState<number>(() => loadHeight(defaultPx));
  const draggingRef = useRef(false);
  const startRef = useRef<{ y: number; h: number } | null>(null);

  const clamp = useCallback((px: number) => {
    const max = typeof window !== "undefined" ? window.innerHeight * 0.85 : 800;
    return Math.max(MIN_HEIGHT, Math.min(max, px));
  }, []);

  useEffect(() => {
    if (!draggingRef.current) return;
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current || !startRef.current) return;
      const dy = startRef.current.y - e.clientY;
      setHeight(clamp(startRef.current.h + dy));
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      startRef.current = null;
      try {
        window.localStorage.setItem(HEIGHT_KEY, String(Math.round(height)));
      } catch {
        /* ignore */
      }
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [height, clamp]);

  const onHandlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    startRef.current = { y: e.clientY, h: height };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";
  };

  if (!open) return null;
  return (
    <>
      <CommandCenterMountedCounter />
      <CommandCenterDrawerContent
        open={open}
        onClose={onClose}
        projectId={projectId}
        workspaceId={workspaceId}
        focusJobId={focusJobId}
        onOpenJobsTab={onOpenJobsTab}
        height={height}
        onHandlePointerDown={onHandlePointerDown}
        lightweight={lightweight}
        previewBlocked={previewBlocked}
        hasActiveJob={hasActiveJob}
      />
    </>
  );
}

function CommandCenterMountedCounter() {
  useEffect(() => {
    setPerf("commandCenterMounted", 1);
    return () => setPerf("commandCenterMounted", 0);
  }, []);
  return null;
}

export function CommandCenterDrawerContent({
  open,
  height,
  onHandlePointerDown,
  onOpenJobsTab,
  onClose,
  projectId,
  workspaceId,
  focusJobId,
  lightweight,
  previewBlocked,
  hasActiveJob,
}: DrawerProps & {
  height: number;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  lightweight: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-label="Command Center"
      style={{ height: `${height}px` }}
      className={cn(
        "absolute left-3 right-3 bottom-14 z-30 flex flex-col",
        "rounded-xl border border-white/10 bg-sidebar/95 overflow-hidden",
        !lightweight && "backdrop-blur-xl shadow-elevated",
      )}
    >
      <div
        onPointerDown={onHandlePointerDown}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize Command Center"
        className="h-2.5 flex items-center justify-center cursor-row-resize bg-white/[0.03] hover:bg-white/[0.07] border-b border-white/5 touch-none select-none"
        title="Drag to resize"
      >
        <GripHorizontal className="h-3 w-3 text-muted-foreground/60" />
      </div>
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
          pollEnabled={open}
          detailsEnabled={open}
          activePollingEnabled={open}
          previewBlocked={previewBlocked}
          hasActiveJob={hasActiveJob}
        />
      </div>
    </div>
  );
}

export function useCommandCenterAutoOpen(
  state: CommandCenterDerivedState,
  opts: {
    onJobSucceeded?: (job: Job) => void;
    onJobFailed?: (job: Job) => void;
    autoOpen?: boolean;
  } = {},
) {
  const [open, setOpen] = useState(false);
  const [showSucceeded, setShowSucceeded] = useState<string | null>(null);
  const lastJobIdRef = useRef<string | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  const { mode, activeJob } = state;

  useEffect(() => {
    if (opts.autoOpen === false) return;
    if (mode === "waiting" || mode === "failed") setOpen(true);
  }, [mode, opts.autoOpen]);

  useEffect(() => {
    if (!activeJob) return;
    const prevStatus = lastJobIdRef.current === activeJob.id ? lastStatusRef.current : null;
    if (prevStatus && prevStatus !== activeJob.status) {
      if (activeJob.status === "succeeded") {
        opts.onJobSucceeded?.(activeJob);
        setShowSucceeded(activeJob.id);
        const t = setTimeout(
          () => setShowSucceeded((id) => (id === activeJob.id ? null : id)),
          4000,
        );
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

  const effectiveMode: CommandCenterMode = useMemo(() => {
    if (showSucceeded && mode === "idle") return "succeeded";
    return mode;
  }, [mode, showSucceeded]);

  return { open, setOpen, effectiveMode };
}
