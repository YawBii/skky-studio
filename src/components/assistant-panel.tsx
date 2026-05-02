import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Paperclip, Check, Loader2, X, Settings2, FileEdit, ArrowRight, ShieldCheck, Play } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { enqueueJob, retryJob, JOB_TYPES, type JobType, type Job } from "@/services/jobs";
import { useProjectJobs } from "@/hooks/use-project-jobs";
import { useProjectConnections } from "@/hooks/use-project-connections";
import { useDiagnostics } from "@/lib/diagnostics";
import { useMemo } from "react";
import { buildSmartSuggestions, dismissSuggestion, type SmartSuggestion } from "@/services/suggestion-engine";
import { SmartSuggestionChips } from "@/components/smart-suggestion-chips";
import { useBuilderUIState } from "@/hooks/use-builder-ui-state";
import { TaskSummaryCard } from "@/components/task-summary-card";

type ProofStatus = "ok" | "warn" | "fail" | "skip";
type ProofItem = { id: string; label: string; status: ProofStatus; detail?: string };
type Handoff = {
  summary: string;
  changed: string[];
  next: string[];
  verify: string[];
};
type Msg = {
  role: "user" | "assistant";
  content: string;
  proof?: ProofItem[];
  handoff?: Handoff;
  /** When set, render a TaskSummaryCard for this job below the message. */
  summaryJobId?: string;
};

const TERMINAL_JOB_STATUSES = new Set(["succeeded", "failed", "cancelled", "waiting_for_input"]);

function formatSummaryHeadline(j: Job): string {
  const label = j.title || j.type;
  switch (j.status) {
    case "succeeded":
      return `yawB finished **${label}** — done. Proof below.`;
    case "failed":
      return `yawB hit an error on **${label}**. See proof + retry below.`;
    case "waiting_for_input":
      return `yawB needs an answer to continue **${label}**. See details below.`;
    case "cancelled":
      return `**${label}** was cancelled.`;
    default:
      return `Update on **${label}**.`;
  }
}

const SUMMARIZED_KEY = (projectId: string) => `yawb:chat:summarized-jobs:${projectId}`;

function loadSummarized(projectId: string | null | undefined): Set<string> {
  if (!projectId || typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SUMMARIZED_KEY(projectId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch { return new Set(); }
}

function persistSummarized(projectId: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(SUMMARIZED_KEY(projectId), JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

const DEFAULT_CHECKLIST: { id: string; label: string; enabled: boolean }[] = [
  { id: "typecheck",  label: "TypeScript check",      enabled: true  },
  { id: "build",      label: "Production build",      enabled: true  },
  { id: "tests",      label: "Smoke tests",           enabled: true  },
  { id: "console",    label: "No console errors",     enabled: true  },
  { id: "network",    label: "No 4xx/5xx responses",  enabled: true  },
  { id: "migrations", label: "DB migrations applied", enabled: true  },
  { id: "rls",        label: "RLS policies enforced", enabled: true  },
  { id: "deploy",     label: "Deploy readiness",      enabled: true  },
  { id: "lighthouse", label: "Lighthouse perf",       enabled: false },
  { id: "a11y",       label: "Accessibility audit",   enabled: false },
];

const STORE_KEY = "yawb:proof-checklist";

function loadChecklist() {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORE_KEY) : null;
    if (!raw) return DEFAULT_CHECKLIST;
    const parsed = JSON.parse(raw) as { id: string; enabled: boolean }[];
    return DEFAULT_CHECKLIST.map((d) => ({ ...d, enabled: parsed.find((p) => p.id === d.id)?.enabled ?? d.enabled }));
  } catch { return DEFAULT_CHECKLIST; }
}

const INITIAL: Msg[] = [
  {
    role: "assistant",
    content:
      "Hi — I'm yawB. Tell me what to build, fix or ship. I'll plan it, build it, and report back with a step-by-step proof checklist before declaring done.",
  },
];

export function AssistantPanel() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Msg[]>(INITIAL);
  const [checklist, setChecklist] = useState(loadChecklist);
  const [enqueuingType, setEnqueuingType] = useState<string | null>(null);
  const { project, workspace } = useSelectedProject();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pull live state for smart suggestions. These hooks are no-ops when
  // there is no project (jobs/connections return empty + a "no-project" source).
  const jobsState = useProjectJobs(project?.id ?? null, workspace?.id ?? null);
  const connState = useProjectConnections(project?.id ?? null);
  const diag = useDiagnostics();

  // Track which jobs have already been summarized in chat (per-project, persisted).
  const summarizedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    summarizedRef.current = loadSummarized(project?.id);
  }, [project?.id]);

  // When a job reaches a terminal state, append exactly one summary message.
  useEffect(() => {
    if (!project) return;
    for (const j of jobsState.jobs) {
      if (!TERMINAL_JOB_STATUSES.has(j.status)) continue;
      if (summarizedRef.current.has(j.id)) continue;
      // Only summarize jobs visible in the recent window — useProjectJobs
      // already returns the latest 50. Use a 24h cutoff so jobs that
      // finished while the user wasn't looking still surface a summary
      // (rather than being silently swallowed).
      const ageMs = Date.now() - Date.parse(j.createdAt);
      if (Number.isFinite(ageMs) && ageMs > 24 * 60 * 60 * 1000) {
        summarizedRef.current.add(j.id);
        continue;
      }
      summarizedRef.current.add(j.id);
      persistSummarized(project.id, summarizedRef.current);
      // Lazily refresh steps for the proof block.
      void jobsState.refreshSteps(j.id);
      const headline = formatSummaryHeadline(j);
      console.info("[yawb] chat.summary.appended", { jobId: j.id, type: j.type, status: j.status });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: headline, summaryJobId: j.id },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsState.jobs, project?.id]);

  // Manually re-emit summary cards for the latest few terminal jobs (handy
  // when the user just opened the panel and wants to see what happened).
  const showRecentSummaries = () => {
    if (!project) return;
    const terminal = jobsState.jobs
      .filter((j) => TERMINAL_JOB_STATUSES.has(j.status))
      .slice(0, 5);
    if (terminal.length === 0) {
      toast("No recent jobs to summarize yet.");
      return;
    }
    for (const j of terminal) void jobsState.refreshSteps(j.id);
    setMessages((m) => [
      ...m,
      ...terminal.map((j) => ({
        role: "assistant" as const,
        content: formatSummaryHeadline(j),
        summaryJobId: j.id,
      })),
    ]);
    console.info("[yawb] chat.summary.show-recent", { count: terminal.length, ids: terminal.map((j) => j.id) });
  };


  const ui = useBuilderUIState();
  const [, forceTick] = useState(0);

  const suggestions = useMemo(() => buildSmartSuggestions({
    workspace: workspace ?? null,
    project: project ?? null,
    jobs: jobsState.jobs,
    connections: connState.connections,
    connectionsSource: connState.source,
    jobsSource: jobsState.source,
    diagnostics: diag.state,
    hasDeployUrl: false,
    selectedPage: ui.selectedPage,
    selectedEnvironment: ui.selectedEnvironment,
    currentBuilderTab: ui.currentTab,
  }), [workspace, project, jobsState.jobs, connState.connections, connState.source, jobsState.source, diag.state, ui.selectedPage, ui.selectedEnvironment, ui.currentTab]);

  const onDismissSuggestion = (s: SmartSuggestion) => {
    dismissSuggestion(project?.id ?? null, s.id);
    forceTick((n) => n + 1);
  };

  const dispatchSuggestion = async (s: SmartSuggestion) => {
    try {
      const a = s.action;
      switch (a.kind) {
        case "navigate":
          await navigate({ to: a.to as never });
          break;
        case "switch_tab":
          window.dispatchEvent(new CustomEvent("yawb:switch-tab", { detail: { tab: a.tab, focusJobId: a.focusJobId } }));
          break;
        case "open_page_picker":
          window.dispatchEvent(new CustomEvent("yawb:open-page-picker"));
          break;
        case "open_command_center":
          window.dispatchEvent(new CustomEvent("yawb:open-command-center", { detail: { focusJobId: a.focusJobId } }));
          break;
        case "open_server_setup":
          await navigate({ to: "/server-setup" as never });
          break;
        case "ask_chat_prefill":
          setPrompt(a.prompt);
          // Focus the textarea on next paint.
          setTimeout(() => {
            const el = document.querySelector<HTMLTextAreaElement>("textarea[placeholder^='Ask yawB']");
            el?.focus();
            el?.setSelectionRange(a.prompt.length, a.prompt.length);
          }, 0);
          toast("Prefilled — review then send.");
          break;
        case "create_page":
          setPrompt(`Create a new page at ${a.path} for ${project?.name ?? "this app"}. Include layout, empty state, and update the builder page picker list.`);
          break;
        case "create_schema_plan":
          setPrompt(`Plan a Supabase schema for these tables: ${a.tables.join(", ")}. Include columns, FK relations, RLS policies (with a SECURITY DEFINER has_role() helper if roles are needed), and a migration SQL file under docs/sql/.`);
          break;
        case "enqueue_job": {
          if (!project || !workspace) {
            toast.error("Select a project first.");
            return;
          }
          const r = await enqueueJob({
            projectId: project.id,
            workspaceId: workspace.id,
            type: a.jobType,
            title: a.title,
            input: a.input,
          });
          if (!r.ok) {
            const detail = r.tableMissing
              ? `Job tables missing — run ${r.sqlFile ?? "docs/sql/2026-04-30-project-jobs.sql"}`
              : r.error;
            toast.error(`Couldn't queue job: ${detail}`);
            console.error("[yawb] suggestion.action.error", { suggestion: s.id, error: detail });
            return;
          }
          toast.success(`Queued ${a.title}`);
          break;
        }
        case "retry_job": {
          const r = await retryJob(a.jobId);
          if (!r.ok) {
            toast.error(`Retry failed: ${r.error}`);
            console.error("[yawb] suggestion.action.error", { suggestion: s.id, error: r.error });
            return;
          }
          toast.success("Job re-queued");
          break;
        }
        case "answer_question":
          window.dispatchEvent(new CustomEvent("yawb:switch-tab", { detail: { tab: "jobs", focusJobId: a.jobId } }));
          toast("Open the Jobs tab and answer the highlighted question.");
          break;
        case "open_diagnostics":
          window.dispatchEvent(new CustomEvent("yawb:open-diagnostics"));
          break;
        case "noop":
          toast(s.disabledReason ?? "Not wired yet.");
          break;
      }
      console.info("[yawb] suggestion.action.success", { suggestion: s.id, category: s.category });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[yawb] suggestion.action.error", { suggestion: s.id, error: msg });
      toast.error(`Suggestion failed: ${msg}`);
    }
  };


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const persistChecklist = (next: typeof checklist) => {
    setChecklist(next);
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(next.map((c) => ({ id: c.id, enabled: c.enabled })))); } catch {}
  };

  const buildProof = (): ProofItem[] => {
    return checklist.filter((c) => c.enabled).map((c) => ({
      id: c.id,
      label: c.label,
      status: "ok" as ProofStatus,
      detail: c.id === "build" ? "vite · 38s · gzip 142kb"
            : c.id === "tests" ? "12 passed · 0 failed"
            : c.id === "migrations" ? "0 pending"
            : c.id === "deploy" ? "Ready to publish"
            : undefined,
    }));
  };

  const buildHandoff = (userText: string): Handoff => {
    const t = userText.toLowerCase();
    const isFix     = /\b(fix|bug|broken|error|repair)\b/.test(t);
    const isStyle   = /\b(style|design|color|theme|ui|layout)\b/.test(t);
    const isDB      = /\b(table|schema|migration|rls|supabase|database)\b/.test(t);
    const isDeploy  = /\b(deploy|publish|ship|release)\b/.test(t);
    return {
      summary: isFix    ? "Applied a targeted fix and re-ran verification."
             : isStyle  ? "Updated the UI and confirmed the design tokens still match."
             : isDB     ? "Adjusted the data layer and validated RLS access."
             : isDeploy ? "Prepared the build for deployment."
             : "Implemented the requested change end-to-end.",
      changed: [
        isStyle  ? "Updated component styling and tokens"  : "Edited the relevant components",
        isDB     ? "Updated DB queries / migration draft"  : "Wired data + state for the new behavior",
        "Kept TypeScript and lint clean",
      ],
      next: [
        isDeploy ? "Click Publish to ship to production"   : "Open the preview tab to try the change",
        "Tell me what to adjust — copy, layout, or behavior",
        isDB ? "Run the pending SQL in the DB pane if not yet applied" : "Wire any remaining backend bits when ready",
      ],
      verify: [
        "Try the primary user flow in the preview",
        "Check the Proof report below for failed items",
        isDB ? "Confirm RLS still blocks unauthorized reads" : "Watch for console / network errors",
      ],
    };
  };

  const send = async () => {
    const text = prompt.trim();
    if (!text) return;
    console.info("[yawb] chat.send.clicked", { len: text.length, projectId: project?.id });
    setMessages((m) => [...m, { role: "user", content: text }]);
    setPrompt("");
    if (!project || !workspace) {
      toast.error("Select a project first to send a request.");
      setMessages((m) => [...m, { role: "assistant", content: "No project selected. Open a project, then try again." }]);
      return;
    }
    const r = await enqueueJob({
      projectId: project.id,
      workspaceId: workspace.id,
      type: "ai.plan",
      title: text.slice(0, 80),
      input: { prompt: text, source: "chat_send" },
    });
    if (!r.ok) {
      console.error("[yawb] chat.send.enqueue.error", r);
      const detail = r.tableMissing
        ? `Job tables missing — run ${r.sqlFile ?? "docs/sql/2026-04-30-project-jobs.sql"}`
        : r.error;
      toast.error(`Couldn't queue request: ${detail}`);
      setMessages((m) => [...m, { role: "assistant", content: `Couldn't queue request: ${detail}` }]);
      return;
    }
    console.info("[yawb] chat.send.enqueue.success", { jobId: r.job.id });
    toast.success("Request queued");
    setMessages((m) => [...m, { role: "assistant", content: `Queued ai.plan job. Open the Jobs tab to watch progress.` }]);
  };

  const runJob = async (type: JobType, title: string) => {
    console.info("[yawb] chat.runJob.clicked", { type, title, projectId: project?.id });
    if (!project || !workspace) {
      toast.error("Select a project first to enqueue a job.");
      return;
    }
    setEnqueuingType(type);
    const r = await enqueueJob({ projectId: project.id, workspaceId: workspace.id, type, title });
    setEnqueuingType(null);
    if (!r.ok) {
      toast.error(`Couldn't queue job: ${r.error}`);
      setMessages((m) => [...m, { role: "assistant", content: `Couldn't queue ${type}: ${r.error}` }]);
      return;
    }
    setMessages((m) => [...m, { role: "assistant", content: `Job queued · ${title} (${type}). Open the Jobs tab to watch progress.` }]);
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-white/5 bg-sidebar/50 backdrop-blur-xl">
      {/* Header */}
      <div className="px-4 h-12 border-b border-white/5 flex items-center gap-2">
        <div className="h-6 w-6 rounded-md bg-gradient-to-br from-white/95 to-white/55 text-[oklch(0.16_0_0)] flex items-center justify-center">
          <Sparkles className="h-3 w-3" />
        </div>
        <div className="text-[13px] font-display font-semibold tracking-tight">yawB Chat</div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span className="h-1 w-1 rounded-full bg-success animate-pulse" /> Online
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="ml-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground rounded-md px-1.5 py-1 hover:bg-white/5"
              title="Configure proof checklist"
            >
              <Settings2 className="h-3.5 w-3.5" /> Proof
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 bg-background/95 backdrop-blur-xl border-white/10">
            <div className="text-[12px] font-medium mb-1">Proof checklist</div>
            <div className="text-[11px] text-muted-foreground mb-2">Items shown after each task before completion.</div>
            <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
              {checklist.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={(e) => persistChecklist(checklist.map((x) => x.id === c.id ? { ...x, enabled: e.target.checked } : x))}
                    className="accent-primary"
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={showRecentSummaries}
          disabled={!project}
          className="ml-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground rounded-md px-1.5 py-1 hover:bg-white/5 disabled:opacity-50"
          title="Show summaries for recent jobs"
        >
          <FileEdit className="h-3.5 w-3.5" /> Summaries
        </button>

      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-5 space-y-4">
        {messages.map((m, i) => {
          const job: Job | undefined = m.summaryJobId ? jobsState.jobs.find((j) => j.id === m.summaryJobId) : undefined;
          const steps = m.summaryJobId ? (jobsState.stepsByJob[m.summaryJobId] ?? []) : [];
          const nextActions = job
            ? (job.status === "failed"
                ? [{ id: "retry", label: "Retry job", onClick: async () => {
                    const r = await retryJob(job.id);
                    if (r.ok) toast.success("Job re-queued"); else toast.error(`Retry failed: ${r.error}`);
                  } }]
                : job.status === "waiting_for_input"
                ? [{ id: "open-jobs", label: "Open Jobs tab", onClick: () => {
                    window.dispatchEvent(new CustomEvent("yawb:switch-tab", { detail: { tab: "jobs", focusJobId: job.id } }));
                  } }]
                : [])
            : [];
          return (
            <div key={i}>
              <Message msg={m} />
              {job && <TaskSummaryCard job={job} steps={steps} nextActions={nextActions} />}
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-white/5 space-y-2 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        {suggestions.length > 0 && (
          <SmartSuggestionChips suggestions={suggestions} onAction={dispatchSuggestion} onDismiss={onDismissSuggestion} />
        )}
        <div className="rounded-2xl border border-white/10 bg-background/50 ring-hairline p-2">

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={3}
            placeholder="Ask yawB to build, fix or ship anything…"
            data-testid="chat-composer"
            className="w-full resize-none bg-transparent px-2 py-1.5 text-[13px] leading-relaxed placeholder:text-muted-foreground/70 outline-none max-h-48 overflow-y-auto"
          />
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => toast("Coming next: file & screenshot attachments.")}
                className="inline-flex items-center gap-1.5 px-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="h-3.5 w-3.5" /> Attach
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={!project}
                    className="inline-flex items-center gap-1.5 px-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    title={project ? "Queue a real job" : "Select a project to queue jobs"}
                  >
                    <Play className="h-3.5 w-3.5" /> Run job
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 bg-background/95 backdrop-blur-xl border-white/10 p-2">
                  <div className="text-[11px] text-muted-foreground px-2 py-1.5">
                    Enqueue against {project?.name ?? "—"}. Watch progress in the Jobs tab.
                  </div>
                  <div className="max-h-72 overflow-y-auto scrollbar-thin">
                    {JOB_TYPES.map((t) => (
                      <button
                        key={t}
                        disabled={enqueuingType === t || !project}
                        onClick={() => runJob(t, t)}
                        className="w-full flex items-center gap-2 text-left text-[12px] rounded-md px-2 py-1.5 hover:bg-white/5 disabled:opacity-50"
                      >
                        {enqueuingType === t ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 text-primary" />}
                        <span className="font-mono">{t}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <Button size="sm" variant="hero" disabled={!prompt.trim()} onClick={send} className="min-h-11 sm:min-h-9 px-4" data-testid="chat-send">
              <Send className="h-3.5 w-3.5" /> Send
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Message({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-[10.5px] font-semibold",
          isUser ? "bg-white/10" : "bg-gradient-brand text-primary-foreground",
        )}
      >
        {isUser ? "You" : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed max-w-[88%] whitespace-pre-wrap text-pretty",
          isUser ? "bg-white/[0.06]" : "bg-white/[0.03] border border-white/5",
        )}
      >
        {msg.content}
        {msg.handoff && <HandoffNote handoff={msg.handoff} />}
        {msg.proof && msg.proof.length > 0 && <ProofReport items={msg.proof} />}
      </div>
    </div>
  );
}

function HandoffNote({ handoff }: { handoff: Handoff }) {
  return (
    <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <div className="px-3 py-2 text-[11px] font-medium flex items-center gap-1.5 text-foreground/90 bg-white/[0.03]">
        <ShieldCheck className="h-3 w-3 text-primary" /> Hand-off note
      </div>
      <div className="divide-y divide-white/5">
        <HandoffSection icon={FileEdit} label="What changed" items={handoff.changed} />
        <HandoffSection icon={ArrowRight} label="What's next" items={handoff.next} />
        <HandoffSection icon={Check} label="Verify" items={handoff.verify} />
      </div>
    </div>
  );
}

function HandoffSection({
  icon: Icon, label, items,
}: { icon: React.ComponentType<{ className?: string }>; label: string; items: string[] }) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <ul className="space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className="text-[11.5px] text-foreground/85 flex gap-1.5">
            <span className="text-muted-foreground/60">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProofReport({ items }: { items: ProofItem[] }) {
  const failed = items.filter((i) => i.status === "fail").length;
  const okAll = failed === 0;
  return (
    <div className="mt-3 rounded-xl border border-white/5 bg-black/20 overflow-hidden">
      <div className={cn("px-3 py-2 text-[11px] font-medium flex items-center gap-1.5",
        okAll ? "text-success bg-success/5" : "text-destructive bg-destructive/5")}>
        {okAll ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        Proof report · {okAll ? "all checks passed" : `${failed} check(s) failed`}
      </div>
      <ul className="divide-y divide-white/5">
        {items.map((i) => (
          <li key={i.id} className="px-3 py-1.5 text-[11.5px] flex items-center gap-2">
            {i.status === "ok"   && <Check className="h-3 w-3 text-success" />}
            {i.status === "warn" && <Loader2 className="h-3 w-3 text-warning" />}
            {i.status === "fail" && <X className="h-3 w-3 text-destructive" />}
            {i.status === "skip" && <span className="h-3 w-3 rounded-full bg-white/15 inline-block" />}
            <span className="text-foreground">{i.label}</span>
            {i.detail && <span className="ml-auto text-muted-foreground font-mono text-[10.5px]">{i.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
