import { useState } from "react";
import {
  Sparkles, Send, Paperclip, CheckCircle2, GitCommit, Hammer, Brain,
  Wrench, BookOpen, Rocket, GitPullRequest, Undo2, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const QUICK_ACTIONS = [
  { id: "fix",      label: "Fix build error",  icon: Wrench,           toast: "yawB is investigating the latest build…" },
  { id: "explain",  label: "Explain change",   icon: BookOpen,         toast: "Generating an explanation of the latest commit…" },
  { id: "pr",       label: "Create PR",        icon: GitPullRequest,   toast: "Coming next: open a pull request from yawB." },
  { id: "deploy",   label: "Deploy preview",   icon: Rocket,           toast: "Queueing a preview deploy…" },
  { id: "rollback", label: "Rollback",         icon: Undo2,            toast: "Rolling back to the previous deploy…" },
];

const BUILD_LOGS = [
  { t: "00:00", text: "Resolving dependencies (412 packages)…" },
  { t: "00:08", text: "Compiling routes · 18 files" },
  { t: "00:14", text: "Generating Supabase types from `yawb-prod`" },
  { t: "00:21", text: "Bundling client (vite) · gzip 142kb" },
  { t: "00:29", text: "Running smoke tests · 12 passed" },
];

const ACTIVITY = [
  { icon: GitCommit,   text: "feat(billing): wire Stripe webhook handler",      time: "2m ago",  tone: "default" as const },
  { icon: Hammer,      text: "Build #248 succeeded · 38s",                       time: "12m ago", tone: "success" as const },
  { icon: CheckCircle2,text: "Health check passed · 8/8 OK",                     time: "1h ago",  tone: "success" as const },
  { icon: Brain,       text: "AI repaired 2 missing tables in `atlas-ops`",      time: "3h ago",  tone: "default" as const },
];

export function AssistantPanel() {
  const [prompt, setPrompt] = useState("");

  const send = () => {
    if (!prompt.trim()) return;
    toast.success("Sent to yawB Copilot", { description: prompt.slice(0, 80) });
    setPrompt("");
  };

  return (
    <aside className="hidden xl:flex w-[360px] shrink-0 flex-col border-l border-white/5 bg-sidebar/60 backdrop-blur-xl">
      {/* Header */}
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

      {/* Current task */}
      <div className="px-4 pt-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80 mb-2 px-1">
          Current task
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/80" />
            <div className="text-[12.5px] font-medium">Building subscription dashboard</div>
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground">Step 3 of 6 · generating routes & data model</div>
          <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-gradient-brand" style={{ width: "48%" }} />
          </div>
        </div>
      </div>

      {/* Build logs */}
      <div className="px-4 pt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80 mb-2 px-1">
          Build logs
        </div>
        <div className="rounded-xl border border-white/10 bg-background/40 font-mono text-[11px] p-2.5 max-h-[140px] overflow-y-auto scrollbar-thin">
          {BUILD_LOGS.map((l, i) => (
            <div key={i} className="flex gap-2 leading-relaxed">
              <span className="text-muted-foreground/70 shrink-0 num">{l.t}</span>
              <span className="text-foreground/90 truncate">{l.text}</span>
            </div>
          ))}
          <div className="flex gap-2 text-warning"><span className="num">00:36</span><span>compiling…</span></div>
        </div>
      </div>

      {/* Suggested next action */}
      <div className="px-4 pt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80 mb-2 px-1">
          Suggested next action
        </div>
        <button
          onClick={() => toast.success("Deploying preview…")}
          className="w-full text-left rounded-xl border border-foreground/20 bg-white/[0.04] hover:bg-white/[0.07] transition p-3"
        >
          <div className="flex items-center gap-2">
            <Rocket className="h-3.5 w-3.5" />
            <div className="text-[12.5px] font-medium">Deploy a preview to validate the new billing flow</div>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Catches Stripe webhook regressions before production.</div>
        </button>
      </div>

      {/* Ask yawB */}
      <div className="px-4 pt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80 mb-2 px-1">
          Ask yawB
        </div>
        <div className="rounded-2xl border border-white/10 bg-background/40 ring-hairline p-2.5">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="Ask anything about your project…"
            className="w-full resize-none bg-transparent text-[12.5px] leading-relaxed placeholder:text-muted-foreground/70 outline-none"
          />
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => toast("Coming next: file & screenshot attachments.")}
              className="inline-flex items-center gap-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="h-3.5 w-3.5" /> Attach
            </button>
            <Button size="sm" variant="hero" disabled={!prompt.trim()} onClick={send}>
              <Send className="h-3.5 w-3.5" /> Send
            </Button>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-4 pt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80 mb-2 px-1">
          Quick actions
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => toast(a.toast)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition px-2.5 py-2 text-[11.5px] text-left"
            >
              <a.icon className="h-3.5 w-3.5 text-foreground/80 shrink-0" />
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Activity */}
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
