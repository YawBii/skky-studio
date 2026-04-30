import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Paperclip, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Msg = { role: "user" | "assistant"; content: string; proof?: boolean };

const INITIAL: Msg[] = [
  {
    role: "assistant",
    content:
      "Hi — I'm yawB. Tell me what to build, fix or ship. I'll plan it, build it, and report back with proof before declaring done.",
  },
];

export function AssistantPanel() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Msg[]>(INITIAL);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
            "Got it. I'll plan the change, implement it, and run a verification pass before reporting back.",
        },
      ]);
    }, 600);
  };

  return (
    <aside className="hidden lg:flex w-[380px] shrink-0 flex-col border-l border-white/5 bg-sidebar/50 backdrop-blur-xl">
      {/* Header */}
      <div className="px-4 h-12 border-b border-white/5 flex items-center gap-2">
        <div className="h-6 w-6 rounded-md bg-gradient-to-br from-white/95 to-white/55 text-[oklch(0.16_0_0)] flex items-center justify-center">
          <Sparkles className="h-3 w-3" />
        </div>
        <div className="text-[13px] font-display font-semibold tracking-tight">yawB Chat</div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span className="h-1 w-1 rounded-full bg-success animate-pulse" /> Online
        </span>
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
          "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed max-w-[82%] whitespace-pre-wrap text-pretty",
          isUser ? "bg-white/[0.06]" : "bg-white/[0.03] border border-white/5",
        )}
      >
        {msg.content}
        {msg.proof && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-success">
            <CheckCircle2 className="h-3 w-3" /> Build ✓ · Tests ✓ · No console errors
          </div>
        )}
      </div>
    </div>
  );
}
