// Status pill summarising the result of provider auto-link for a project.
// Used on the Projects list and the Health page.
import { Check, AlertCircle, Triangle, Loader2 } from "lucide-react";
import type { AutoLinkResult } from "@/services/provider-auto-link";

export type AutoLinkBadgeStatus =
  | "auto-linked"
  | "needs-confirmation"
  | "no-match"
  | "running"
  | "error";

export function summariseAutoLink(r: AutoLinkResult | null): AutoLinkBadgeStatus {
  if (!r) return "running";
  const outs = [r.github.outcome, r.vercel.outcome];
  if (outs.includes("error")) return "error";
  if (outs.includes("ambiguous")) return "needs-confirmation";
  if (outs.includes("match") || r.github.outcome === "skipped" || r.vercel.outcome === "skipped")
    return "auto-linked";
  return "no-match";
}

export function AutoLinkStatusBadge({
  status,
  className = "",
  noMatchLabel,
}: {
  status: AutoLinkBadgeStatus;
  className?: string;
  /** Override the displayed label when status is "no-match". The Builder
   * topbar passes "Local-only project" when local project_files exist,
   * instead of the alarming "No match found" used on the Health screen. */
  noMatchLabel?: string;
}) {
  const map: Record<AutoLinkBadgeStatus, { label: string; tone: string; Icon: typeof Check }> = {
    "auto-linked": {
      label: "Auto-linked",
      tone: "text-success border-success/40 bg-success/5",
      Icon: Check,
    },
    "needs-confirmation": {
      label: "Needs confirmation",
      tone: "text-warning border-warning/40 bg-warning/5",
      Icon: Triangle,
    },
    "no-match": {
      label: noMatchLabel ?? "No match found",
      tone: "text-muted-foreground border-white/10 bg-white/[0.02]",
      Icon: AlertCircle,
    },
    running: {
      label: "Linking…",
      tone: "text-muted-foreground border-white/10 bg-white/[0.02]",
      Icon: Loader2,
    },
    error: {
      label: "Link error",
      tone: "text-destructive border-destructive/40 bg-destructive/5",
      Icon: AlertCircle,
    },
  };
  const { label, tone, Icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] uppercase tracking-[0.14em] ${tone} ${className}`}
    >
      <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}
