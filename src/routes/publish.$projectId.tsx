import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectConnections } from "@/hooks/use-project-connections";
import { ProjectScopedEmpty } from "@/components/project-empty";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/publish/$projectId")({
  head: ({ params }) => ({ meta: [{ title: `Publish — ${params.projectId} | yawB` }] }),
  component: PublishPage,
});

function PublishPage() {
  const { projectId } = Route.useParams();
  const [name, setName] = useState<string>("");
  useEffect(() => {
    supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => setName(data?.name ?? projectId));
  }, [projectId]);
  const { connections, loading } = useProjectConnections(projectId);
  const vercel = connections.find((c) => c.provider === "vercel" && c.status === "connected");

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  if (!vercel) {
    return (
      <ProjectScopedEmpty
        icon={Globe}
        eyebrow={name}
        title="No deploy target yet"
        hint="Connect Vercel from Integrations to publish this project to a real URL and manage custom domains."
        cta={{ label: "Open Integrations", to: "/connectors" }}
      />
    );
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1000px] mx-auto">
      <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Publish</h1>
      <p className="text-muted-foreground mt-1 mb-6">{name} · connected to Vercel</p>
      <div className="rounded-2xl border border-white/5 bg-gradient-card p-6 text-[13px] text-muted-foreground">
        Domain management connects in the next pass.
        <div className="mt-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/connectors">Manage Vercel connection →</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
