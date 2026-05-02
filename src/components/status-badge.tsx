import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/demo-data";

const map: Record<ProjectStatus, { label: string; cls: string; dot: string }> = {
  healthy: {
    label: "Healthy",
    cls: "bg-success/10 text-success border-success/20",
    dot: "bg-success",
  },
  warning: {
    label: "Warning",
    cls: "bg-warning/10 text-warning border-warning/20",
    dot: "bg-warning",
  },
  critical: {
    label: "Critical",
    cls: "bg-destructive/10 text-destructive border-destructive/25",
    dot: "bg-destructive",
  },
  building: {
    label: "Building",
    cls: "bg-accent/15 text-accent border-accent/25",
    dot: "bg-accent animate-pulse",
  },
};

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        s.cls,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
