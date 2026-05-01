// Local builder preview route — renders a project's current generated state
// inside the iframe used by PreviewPane. Works without any Vercel deploy.
//
// For now this serves a minimal shell explaining that no generated files
// exist yet. When a project_files table is wired up, hydrate this with
// the project's generated index.html / React shell.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/preview/$projectId")({
  head: ({ params }) => ({
    meta: [
      { title: `Local preview — ${params.projectId}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LocalPreview,
});

interface ProjectLite {
  id: string;
  name: string;
  description: string | null;
}

function LocalPreview() {
  const { projectId } = Route.useParams();
  const [project, setProject] = useState<ProjectLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasFiles, setHasFiles] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("projects")
        .select("id, name, description")
        .eq("id", projectId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setProject({ id: data.id, name: data.name, description: data.description });
      }
      // Generated files are not wired yet — placeholder hook for future use.
      setHasFiles(false);
      setLoading(false);
      console.info("[yawb] preview.local.rendered", { projectId, hasFiles: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground text-sm">
        Loading local preview…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-center px-6">
        <div className="max-w-md">
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
            Local preview
          </div>
          <h1 className="mt-2 text-2xl font-display font-semibold">Project not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn't locate this project. It may have been deleted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-8 py-16">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          Local preview
        </div>
        <h1 className="mt-3 text-3xl md:text-4xl font-display font-bold tracking-tight">
          {project.name}
        </h1>
        {project.description && (
          <p className="mt-3 text-sm text-muted-foreground">{project.description}</p>
        )}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          {hasFiles ? (
            <p className="text-sm text-muted-foreground">
              Rendering generated files…
            </p>
          ) : (
            <>
              <h2 className="text-base font-semibold">No generated screens yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Ask yawB in the chat to build the first screen. Once a build runs,
                the local preview will render it here — no Vercel deploy required.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
