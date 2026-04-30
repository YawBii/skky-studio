import { useEffect, useState } from "react";
import { Github, GitBranch, RefreshCw, Check, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { github } from "@/services";
import type { GithubStatus } from "@/services/github";
import { cn } from "@/lib/utils";

export function GithubStatusPanel() {
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    github.getStatus().then(setStatus);
  }, []);

  async function handleSync() {
    setSyncing(true);
    // TODO(codex): replace with real github.syncNow() call + toast on result.
    await github.syncNow();
    const fresh = await github.getStatus();
    setStatus({ ...fresh, lastSyncRelative: "just now" });
    setSyncing(false);
  }

  if (!status) {
    return (
      <div className="rounded-2xl border border-white/5 bg-gradient-card p-5 h-[180px] animate-pulse" />
    );
  }

  const connected = status.connected;

  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 grid place-items-center">
            <Github className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display font-semibold leading-tight">GitHub</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Bidirectional sync with your repository
            </div>
          </div>
        </div>
        <span
          className={cn(
            "text-[11px] px-2 py-1 rounded-full border inline-flex items-center gap-1",
            connected
              ? "border-success/30 text-success bg-success/5"
              : "border-white/10 text-muted-foreground",
          )}
        >
          {connected ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      <div className="mt-5 grid sm:grid-cols-3 gap-3">
        <StatTile
          label="Repository"
          value={status.repo ?? "—"}
          mono
          href={status.repo ? `https://github.com/${status.repo}` : undefined}
        />
        <StatTile
          label="Target branch"
          value={status.targetBranch ?? "—"}
          icon={<GitBranch className="h-3 w-3" />}
          mono
        />
        <StatTile
          label="Last sync"
          value={status.lastSyncRelative ?? "—"}
          sub={
            status.lastCommitSha
              ? `${status.lastCommitSha.slice(0, 7)} · ${status.lastCommitMessage ?? ""}`
              : undefined
          }
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="text-[11px] text-muted-foreground">
          {connected
            ? `${status.syncDirection === "two-way" ? "Two-way sync" : "One-way sync"} · ${status.pendingChanges ?? 0} pending change${status.pendingChanges === 1 ? "" : "s"}`
            : "Connect GitHub to enable automatic sync."}
        </div>
        <div className="flex gap-2">
          {connected ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <a
                  href={status.repo ? `https://github.com/${status.repo}` : "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open repo <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button variant="soft" size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
            </>
          ) : (
            <Button variant="hero" size="sm">Connect GitHub</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon,
  mono,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  mono?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-sm font-medium inline-flex items-center gap-1.5 truncate",
          mono && "font-mono text-[13px]",
        )}
      >
        {icon}
        <span className="truncate">{value}</span>
      </div>
      {sub && (
        <div className="mt-1 text-[11px] text-muted-foreground truncate font-mono">{sub}</div>
      )}
    </>
  );
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 min-w-0">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-80">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}
