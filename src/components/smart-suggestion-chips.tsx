// Renders smart-suggestion chips above the chat composer.
// Each chip dispatches via the parent-provided onAction callback so the host
// owns side effects. Includes a small "x" affordance to dismiss a suggestion
// (per-project, persisted for 24h via the engine).
import { useEffect } from "react";
import {
  Sparkles,
  X,
  AlertTriangle,
  HelpCircle,
  Wrench,
  Layers,
  Rocket,
  Search,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SmartSuggestion, SuggestionCategory } from "@/services/suggestion-engine";

interface Props {
  suggestions: SmartSuggestion[];
  onAction: (s: SmartSuggestion) => void | Promise<void>;
  onDismiss?: (s: SmartSuggestion) => void;
  className?: string;
}

const CATEGORY_ICON: Record<SuggestionCategory, React.ComponentType<{ className?: string }>> = {
  blocking: AlertTriangle,
  fix_failure: Wrench,
  ask_clarifying: HelpCircle,
  build_next: Layers,
  improve_quality: Sparkles,
  publish_deploy: Rocket,
  inspect_proof: Search,
  connect_provider: Plug,
};

export function SmartSuggestionChips({ suggestions, onAction, onDismiss, className }: Props) {
  useEffect(() => {
    if (suggestions.length === 0) return;
    console.info(
      "[yawb] suggestions.rendered",
      suggestions.map((s) => ({ id: s.id, category: s.category, priority: s.priority })),
    );
  }, [suggestions]);

  if (suggestions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mr-1">
        Smart next
      </span>
      {suggestions.map((s) => {
        const Icon = CATEGORY_ICON[s.category] ?? Sparkles;
        const disabled = !!s.disabledReason;
        return (
          <span
            key={s.id}
            className={cn(
              "group inline-flex items-center gap-1 rounded-full border touch-manipulation transition",
              disabled
                ? "border-white/5 text-muted-foreground/60"
                : s.category === "blocking" || s.category === "fix_failure"
                  ? "border-destructive/30 bg-destructive/5 text-foreground hover:bg-destructive/10"
                  : s.category === "ask_clarifying"
                    ? "border-warning/30 bg-warning/5 text-foreground hover:bg-warning/10"
                    : "border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.07] hover:border-white/20",
            )}
          >
            <button
              type="button"
              disabled={disabled}
              title={s.disabledReason ?? s.explanation ?? s.reason}
              onClick={() => {
                console.info("[yawb] suggestion.clicked", {
                  id: s.id,
                  label: s.label,
                  action: s.action.kind,
                  reason: s.reason,
                });
                void onAction(s);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-[11.5px] rounded-full",
                disabled ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              <Icon className="h-3 w-3 text-primary" />
              {s.label}
              {s.category === "fix_failure" && s.unresolvedReason && (
                <span
                  className="ml-1 inline-flex items-center px-1 py-0.5 rounded-full text-[9.5px] font-mono uppercase tracking-wide bg-destructive/15 text-destructive border border-destructive/30"
                  title={s.unresolvedReason}
                >
                  unresolved
                </span>
              )}
            </button>
            {onDismiss && (
              <button
                type="button"
                aria-label="Dismiss suggestion"
                title="Hide for 24h"
                onClick={(e) => {
                  e.stopPropagation();
                  console.info("[yawb] suggestion.dismissed", { id: s.id });
                  onDismiss(s);
                }}
                className="mr-1 rounded-full p-0.5 text-muted-foreground/60 hover:text-foreground hover:bg-white/10 touch-manipulation"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
