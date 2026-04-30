import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { History, RotateCcw, GitCommit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectConnections } from "@/hooks/use-project-connections";
import { ProjectScopedEmpty } from "@/components/project-empty";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/versions/$projectId")({
  head: ({ params }) => ({ meta: [{ title: `Version history — ${params.projectId} | yawB` }] }),
  component: VersionsPage,
});

function VersionsPage() {
  const { projectId } = Route.useParams();
  const [name, setName] = useState<string>("");
  useEffect(() => {
    supabase.from("projects").select("name").eq("id", projectId).maybeSingle().then(({ data }) => setName(data?.name ?? projectId));
  }, [projectId]);
  const { connections, loading } = useProjectConnections(projectId);
  const hasGit = connections.some((c) => c.provider === "github" && c.status === "connected");

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  if (!hasGit) {
    return (
      <ProjectScopedEmpty
        icon={History}
        eyebrow={name}
        title="No version history yet"
        hint="Connect a Git provider for this project to see commits, deploys and rollbacks."
        cta={{ label: "Open Integrations", to: "/connectors" }}
      />
    );
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1000px] mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <History className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Version history</span>
      </div>
      <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-1">{name}</h1>
      <p className="text-muted-foreground mb-8">Commit history streams in once GitHub sync is wired in the next pass.</p>

      <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
        <GitCommit className="h-6 w-6 mx-auto text-muted-foreground/60" />
        <div className="mt-2">No commits yet.</div>
        <Button variant="ghost" size="sm" className="mt-4" disabled>
          <RotateCcw className="h-3.5 w-3.5" /> Restore (unavailable)
        </Button>
      </div>
    </div>
  );
}
