import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, Plus, Star, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { domains } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/publish/$projectId")({
  head: ({ params }) => ({ meta: [{ title: `Publish — ${params.projectId} | yawB` }] }),
  component: PublishPage,
});

const statusColor: Record<string, string> = {
  active: "border-success/30 text-success",
  verifying: "border-warning/30 text-warning",
  "action-required": "border-warning/30 text-warning",
  offline: "border-destructive/30 text-destructive",
  failed: "border-destructive/30 text-destructive",
};

function PublishPage() {
  const { projectId } = Route.useParams();
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");
  useEffect(() => { domains.listDomains(projectId).then(setList); }, [projectId]);

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1100px] mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Publish</h1>
          <p className="text-muted-foreground mt-1">Manage the public URLs for {projectId}.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="soft"><ExternalLink className="h-4 w-4" /> Visit live site</Button>
          <Button variant="hero">Update production</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-gradient-card p-5 mb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Production URL</div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-mono">{projectId}.lovable.app</div>
          <span className="text-[11px] px-2 py-1 rounded-full border border-success/30 text-success">Live</span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Custom domains</h2>
        <Button variant="soft" size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Add domain</Button>
      </div>
      <div className="rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
        {list.map((d) => (
          <div key={d.name} className="grid grid-cols-12 px-5 py-3 items-center border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
            <div className="col-span-5 flex items-center gap-2 min-w-0">
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-mono text-sm truncate">{d.name}</span>
              {d.primary && <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1"><Star className="h-3 w-3" /> Primary</span>}
            </div>
            <div className="col-span-3"><span className={cn("text-[11px] px-2 py-1 rounded-full border capitalize", statusColor[d.status])}>{d.status.replace("-", " ")}</span></div>
            <div className="col-span-2 text-xs text-muted-foreground">SSL: {d.ssl}</div>
            <div className="col-span-2 flex justify-end gap-1">
              {!d.primary && <Button variant="ghost" size="sm">Make primary</Button>}
              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-lg">Add custom domain</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Point your DNS records to Lovable, or buy a domain through us.</p>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourdomain.com"
              className="w-full rounded-lg border border-white/10 bg-background/50 px-3 h-11 text-sm focus:outline-none mb-4" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="hero" onClick={() => { setOpen(false); setDomain(""); }}>Connect</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
