// Provider links proof / consistency panel + Refresh links button.
// Mounted in the Deploy and Projects surfaces so users have a durable
// way to verify project_connections are intact after refresh / nav.
import { useState } from "react";
import { RefreshCw, Check, AlertCircle, Triangle, Github, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjectProviderLinks } from "@/hooks/use-project-provider-links";
import type { ConsistencyProofEntry } from "@/lib/connection-consistency";

interface Props {
  projectId: string | null | undefined;
  workspaceId: string | null | undefined;
  compact?: boolean;
}

export function ProviderLinksPanel({ projectId, workspaceId, compact }: Props) {
  const links = useProjectProviderLinks(projectId, workspaceId);
  const c = links.consistency;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">Provider links</span>
          {c?.ok && c.warnings.length === 0 && (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" /> healthy
            </Badge>
          )}
          {c && c.warnings.length > 0 && c.errors.length === 0 && (
            <Badge variant="outline" className="gap-1 text-warning">
              <Triangle className="h-3 w-3" /> {c.warnings.length} warning
              {c.warnings.length === 1 ? "" : "s"}
            </Badge>
          )}
          {c && c.errors.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" /> {c.errors.length} error
              {c.errors.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void links.refresh({ toastOnComplete: true })}
          disabled={links.loading}
          aria-label="Refresh links"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${links.loading ? "animate-spin" : ""}`} />
          Refresh links
        </Button>
      </div>

      {links.error && (
        <div className="text-[12px] text-destructive mb-2">project_connections: {links.error}</div>
      )}

      {(c?.warnings.length ?? 0) > 0 && (
        <ul className="text-[12px] text-warning mb-2 space-y-0.5">
          {c!.warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}
      {(c?.errors.length ?? 0) > 0 && (
        <ul className="text-[12px] text-destructive mb-2 space-y-0.5">
          {c!.errors.map((e, i) => (
            <li key={i}>✕ {e}</li>
          ))}
        </ul>
      )}

      {!compact && (
        <div className="space-y-2">
          {c?.proof.length === 0 && (
            <div className="text-[12px] text-muted-foreground">No provider connections linked yet.</div>
          )}
          {c?.proof.map((p) => (
            <div
              key={p.connectionId}
              className="rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-[12px] font-mono"
            >
              <div className="flex items-center gap-2 mb-1">
                {p.provider === "github" ? (
                  <Github className="h-3 w-3" />
                ) : (
                  <Triangle className="h-3 w-3" />
                )}
                <span className="font-medium">{p.provider}</span>
                <Badge variant="outline" className="text-[10px]">
                  {p.status}
                </Badge>
              </div>
              <div className="text-muted-foreground">id: {p.connectionId}</div>
              <div className="text-muted-foreground">external_id: {p.externalId ?? "—"}</div>
              <div className="text-muted-foreground">
                workspace_id: {p.workspaceId ?? "—"} · project_id: {p.projectId}
              </div>
              {p.repoFullName && <div className="text-muted-foreground">repo: {p.repoFullName}</div>}
              {p.url && (
                <div className="text-muted-foreground truncate">
                  url:{" "}
                  <a className="text-primary underline" href={p.url} target="_blank" rel="noreferrer">
                    {p.url}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-[10.5px] text-muted-foreground mt-2">
        Last refresh: {links.lastRefreshAt ?? "never"}
      </div>
    </div>
  );
}
