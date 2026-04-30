// Renders smart-suggestion chips above the chat composer (or in any empty state).
// Each chip dispatches via the parent-provided onAction callback so the host
// route owns side effects (tab switching, navigation, enqueue, etc.).
import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SmartSuggestion } from "@/hooks/use-smart-suggestions";

interface Props {
  suggestions: SmartSuggestion[];
  onAction: (s: SmartSuggestion) => void | Promise<void>;
  className?: string;
}

export function SmartSuggestionChips({ suggestions, onAction, className }: Props) {
  useEffect(() => {
    if (suggestions.length === 0) return;
    console.info("[yawb] suggestion.rendered", suggestions.map((s) => ({ id: s.id, intent: s.intent, priority: s.priority })));
  }, [suggestions]);

  if (suggestions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {suggestions.map((s) => {
        const disabled = !!s.disabledReason;
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            title={s.disabledReason ?? undefined}
            onClick={() => {
              console.info("[yawb] suggestion.clicked", { id: s.id, intent: s.intent });
              void onAction(s);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] border touch-manipulation transition",
              disabled
                ? "border-white/5 text-muted-foreground/60 cursor-not-allowed"
                : "border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.07] hover:border-white/20",
            )}
          >
            <Sparkles className="h-3 w-3 text-primary" />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
