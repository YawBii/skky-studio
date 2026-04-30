import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Paperclip, Check, Loader2, X, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";

type ProofStatus = "ok" | "warn" | "fail" | "skip";
type ProofItem = { id: string; label: string; status: ProofStatus; detail?: string };
type Msg = { role: "user" | "assistant"; content: string; proof?: ProofItem[] };

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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const send = () => {
    const text = prompt.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setPrompt("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Done — I planned the change, applied the edits, and ran the verification pass below.\n\n**Hand-off note**\nReady for your review. Try it in the preview, then click Publish to ship — or tell me what to adjust.",
          proof: buildProof(),
        },
      ]);
    }, 600);
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
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-5 space-y-4">
        {messages.map((m, i) => (
          <Message key={i} msg={m} />
        ))}
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-white/5">
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
            className="w-full resize-none bg-transparent px-2 py-1.5 text-[13px] leading-relaxed placeholder:text-muted-foreground/70 outline-none"
          />
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => toast("Coming next: file & screenshot attachments.")}
              className="inline-flex items-center gap-1.5 px-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="h-3.5 w-3.5" /> Attach
            </button>
            <Button size="sm" variant="hero" disabled={!prompt.trim()} onClick={send}>
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
        {msg.proof && msg.proof.length > 0 && <ProofReport items={msg.proof} />}
      </div>
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
