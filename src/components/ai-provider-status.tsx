import { useEffect, useState } from "react";
import { Bot } from "lucide-react";

interface Info {
  provider: string;
  model: string;
  source: string;
  configured: boolean;
  requiredEnvForActive?: string;
  available?: { name: string; configured: boolean }[];
}

export function AiProviderStatus() {
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/ai-chat")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setInfo(j as Info);
      })
      .catch((e) => !cancelled && setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  if (err)
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-[12px] text-destructive">
        AI status check failed: {err}
      </div>
    );
  if (!info) return null;

  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-4 text-[12px]">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <span className="font-display font-semibold">AI provider</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
            info.configured
              ? "bg-success/15 text-success"
              : "bg-destructive/15 text-destructive"
          }`}
        >
          {info.configured ? "configured" : "missing key"}
        </span>
      </div>
      <div className="grid grid-cols-[120px_1fr] gap-y-1 text-muted-foreground">
        <span>Provider</span>
        <span className="text-foreground">{info.provider}</span>
        <span>Model</span>
        <span className="text-foreground">{info.model}</span>
        <span>Source</span>
        <span className="text-foreground">{info.source}</span>
      </div>
      {!info.configured && info.requiredEnvForActive && (
        <p className="mt-2 text-[11px] text-destructive">
          Set <code className="font-mono">{info.requiredEnvForActive}</code> on the server, or set{" "}
          <code className="font-mono">YAWB_AI_PROVIDER</code> to a configured provider.
        </p>
      )}
    </div>
  );
}
