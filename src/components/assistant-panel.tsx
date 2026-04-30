import { useState } from "react";
import {
  Sparkles, Wrench, BookOpen, Rocket, Send, Paperclip,
  CheckCircle2, GitCommit, Hammer, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Mode = "build" | "repair" | "explain" | "deploy";

const MODES: { id: Mode; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { id: "build",   label: "Build",   icon: Sparkles, hint: "Describe a feature, page, or component to add." },
  { id: "repair",  label: "Repair",  icon: Wrench,   hint: "Paste an error or describe a bug to fix in production." },
  { id: "explain", label: "Explain", icon: BookOpen, hint: "Ask anything about the codebase, schema, or deploys." },
  { id: "deploy",  label: "Deploy",  icon: Rocket,   hint: "Promote, rollback, or schedule a production release." },
];

const SUGGESTED_BY_MODE: Record<Mode, string[]> = {
  build:   ["Add a billing tab to settings", "Generate an admin dashboard from `orders`", "Add Stripe webhook handler"],
  repair:  ["Fix failing build on main", "Resolve missing Supabase RLS on `profiles`", "Investigate p95 latency spike"],
  explain: ["What does the auth flow do?", "Map all routes that hit `posts` table", "Summarise last 5 deploys"],
  deploy:  ["Promote preview to production", "Rollback to previous deploy", "Schedule deploy for 22:00 UTC"],
};

const ACTIVITY = [
  { icon: GitCommit,   text: "feat(auth): wire Supabase session to AuthProvider", time: "2m ago", tone: "default" as const },
  { icon: Hammer,      text: "Build #248 succeeded · 38s",                          time: "12m ago", tone: "success" as const },
  { icon: CheckCircle2,text: "Health check passed · 8/8 OK",                        time: "1h ago",  tone: "success" as const },
  { icon: Brain,       text: "AI repaired 2 missing tables in `atlas-ops`",         time: "3h ago",  tone: "default" as const },
];

export function AssistantPanel() {
  const [mode, setMode] = useState<Mode>("build");
  const [prompt, setPrompt] = useState("");

  return (
    <aside className="hidden xl:flex w-[360px] shrink-0 flex-col border-l border-white/5 bg-sidebar/60 backdrop-blur-xl">
      <div className="px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-white/95 to-white/55 text-[oklch(0.16_0_0)] flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[13px] font-display font-semibold tracking-tight">yawB Copilot</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Production assistant</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 text-success text-[10px] px-2 py-0.5">
            <span className="h-1 w-1 rounded-full bg-success animate-pulse" /> Online
          </span>
        </div>
      </div>

      {/* Mode switcher */}
      <div className="px-4 pt-3">
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium uppercase tracking-[0.14em] transition",
                  active
                    ? "bg-foreground text-background shadow-glow"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
                )}
              >
                <m.icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground px-1">{MODES.find((m) => m.id === mode)?.hint}</p>
      </div>

      {/* Prompt input */}
      <div className="px-4 pt-3">
        <div className="rounded-2xl border border-white/10 bg-background/40 ring-hairline p-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder={`Ask Copilot in ${mode} mode…`}
            className="w-full resize-none bg-transparent text-[13px] leading-relaxed placeholder:text-muted-foreground/70 outline-none"
          />
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="h-3.5 w-3.5" /> Attach
            </button>
            <Button size="sm" variant="hero" disabled={!prompt.trim()}>
              <Send className="h-3.5 w-3.5" /> Send
            </Button>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      <div className="px-4 pt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80 mb-2 px-1">
          Suggested next actions
        </div>
        <div className="space-y-1.5">
          {SUGGESTED_BY_MODE[mode].map((s) => (
            <button
              key={s}
              onClick={() => setPrompt(s)}
              className="w-full text-left text-[12px] rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 px-3 py-2 transition"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Activity feed */}
      <div className="px-4 pt-5 pb-4 mt-2 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80 mb-2 px-1">
          Activity
        </div>
        <ol className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-white/10">
          {ACTIVITY.map((a, i) => (
            <li key={i} className="relative">
              <span className={cn(
                "absolute -left-[11px] top-0.5 h-2.5 w-2.5 rounded-full border border-background",
                a.tone === "success" ? "bg-success" : "bg-foreground/70",
              )} />
              <div className="flex items-center gap-1.5 text-[12px]">
                <a.icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-pretty">{a.text}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{a.time}</div>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
