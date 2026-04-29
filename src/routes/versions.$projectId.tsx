import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { History, RotateCcw, GitCommit, Rocket, Wrench, Pencil, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { versions } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/versions/$projectId")({
  head: ({ params }) => ({ meta: [{ title: `Version history — ${params.projectId} | yawB` }] }),
  component: VersionsPage,
});

const kindIcon = { deploy: Rocket, edit: Pencil, repair: Wrench, import: Download } as const;

function VersionsPage() {
  const { projectId } = Route.useParams();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { versions.listVersions(projectId).then(setItems); }, [projectId]);

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1000px] mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <History className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Version history</span>
      </div>
      <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-1">{projectId}</h1>
      <p className="text-muted-foreground mb-8">Restore any previous version with one click. Like Google Docs, for production apps.</p>

      <div className="rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
        {items.map((v) => {
          const Icon = (kindIcon as any)[v.kind] ?? GitCommit;
          return (
            <div key={v.id} className={cn("flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02]",
              v.current && "bg-white/[0.04]")}>
              <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/10 grid place-items-center"><Icon className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{v.message}</div>
                <div className="text-xs text-muted-foreground">{v.author} · {v.at} · {v.id}</div>
              </div>
              {v.current
                ? <span className="text-[11px] px-2 py-1 rounded-full border border-success/30 text-success">Current</span>
                : <Button variant="soft" size="sm"><RotateCcw className="h-3.5 w-3.5" /> Restore</Button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
