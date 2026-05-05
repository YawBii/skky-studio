// Inline picker shown when auto-link returns "ambiguous" candidates.
// User selects which repo / Vercel project to link, or dismisses.
import { useState } from "react";
import { Github, Triangle, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAutoLinkPick } from "@/services/provider-auto-link";
import type { AutoLinkProviderResult } from "@/services/provider-auto-link";
import type { GithubRepoSummary, VercelProjectSummary } from "@/server/providers.server";
import type { Project } from "@/services/projects";
import { toast } from "sonner";

interface Props {
  project: Project;
  workspaceId: string | null;
  github: AutoLinkProviderResult<GithubRepoSummary>;
  vercel: AutoLinkProviderResult<VercelProjectSummary>;
  onConfirmed: () => void;
}

export function AutoLinkPicker({ project, workspaceId, github, vercel, onConfirmed }: Props) {
  const showGithub = github.outcome === "ambiguous" && github.candidates.length > 0;
  const showVercel = vercel.outcome === "ambiguous" && vercel.candidates.length > 0;
  if (!showGithub && !showVercel) return null;

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 space-y-4">
      <div className="text-[12px] uppercase tracking-[0.2em] text-warning">
        Confirm provider match
      </div>

      {showGithub && (
        <PickerSection
          icon={<Github className="h-3.5 w-3.5" />}
          label="GitHub repo"
          candidates={github.candidates}
          renderName={(r) => r.fullName}
          onPick={async (c) => {
            const r = await confirmAutoLinkPick({
              project,
              workspaceId,
              provider: "github",
              pick: { provider: "github", resource: c.resource, reason: c.reason },
            });
            if (r.ok) {
              toast.success(`Linked to ${c.resource.fullName}`);
              onConfirmed();
            } else toast.error(r.error);
          }}
        />
      )}

      {showVercel && (
        <PickerSection
          icon={<Triangle className="h-3.5 w-3.5" />}
          label="Vercel project"
          candidates={vercel.candidates}
          renderName={(r) => r.name}
          onPick={async (c) => {
            const r = await confirmAutoLinkPick({
              project,
              workspaceId,
              provider: "vercel",
              pick: { provider: "vercel", resource: c.resource, reason: c.reason },
            });
            if (r.ok) {
              toast.success(`Linked to ${c.resource.name}`);
              onConfirmed();
            } else toast.error(r.error);
          }}
        />
      )}
    </div>
  );
}

function PickerSection<T>({
  icon,
  label,
  candidates,
  renderName,
  onPick,
}: {
  icon: React.ReactNode;
  label: string;
  candidates: { resource: T; score: number; reason: string }[];
  renderName: (r: T) => string;
  onPick: (c: { resource: T; score: number; reason: string }) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div>
      <div className="flex items-center gap-2 text-[13px] font-medium mb-2">
        {icon}
        <span>{label} — pick the right one</span>
      </div>
      <div className="space-y-1.5">
        {candidates.slice(0, 5).map((c) => {
          const name = renderName(c.resource);
          const isBusy = busy === name;
          return (
            <button
              key={name}
              type="button"
              disabled={isBusy}
              onClick={async () => {
                setBusy(name);
                try {
                  await onPick(c);
                } finally {
                  setBusy(null);
                }
              }}
              className="w-full flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-left text-[12px] hover:bg-white/[0.05]"
            >
              <div className="min-w-0">
                <div className="font-mono truncate">{name}</div>
                <div className="text-muted-foreground text-[11px] truncate">
                  {c.reason} · score {c.score.toFixed(2)}
                </div>
              </div>
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
