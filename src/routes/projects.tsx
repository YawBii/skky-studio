import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, FolderKanban, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useProjects } from "@/hooks/use-projects";
import { ProjectScopedEmpty, ProjectSurfaceError } from "@/components/project-empty";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — yawB" },
      { name: "description", content: "All projects in your workspace." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { current: workspace, isReal: workspaceIsReal } = useWorkspaces();
  const { projects, loading, isError, error, select } = useProjects(workspace?.id);

  if (!workspaceIsReal) {
    return (
      <ProjectScopedEmpty
        icon={FolderKanban}
        eyebrow="Workspace"
        title="Create a workspace to see projects"
        hint="Projects live inside a workspace. Create one from the home screen."
        cta={{ label: "Go home", to: "/" }}
      />
    );
  }

  if (isError) return <ProjectSurfaceError message={error} sqlFile="docs/sql/2026-04-30-collaboration.sql" />;

  if (loading) {
    return <div className="px-6 md:px-10 py-10 max-w-[1400px] mx-auto text-sm text-muted-foreground">Loading projects…</div>;
  }

  if (projects.length === 0) {
    return (
      <ProjectScopedEmpty
        icon={FolderKanban}
        eyebrow={workspace?.name}
        title="No projects yet"
        hint="Create your first project to start building."
        cta={{ label: "Go home", to: "/" }}
      />
    );
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">{projects.length} project{projects.length === 1 ? "" : "s"} in {workspace?.name}</p>
        </div>
        <Button variant="hero" asChild>
          <Link to="/"><Plus className="h-3.5 w-3.5" /> New project</Link>
        </Button>
      </div>

      <div className="rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
        {projects.map((p, i) => (
          <button
            key={p.id}
            onClick={() => select(p.id)}
            className={`w-full text-left flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition ${i < projects.length - 1 ? "border-b border-white/5" : ""}`}
          >
            <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 grid place-items-center">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold truncate">{p.name}</div>
              <div className="text-xs text-muted-foreground truncate">{p.description ?? `${p.slug} · created ${formatDate(p.createdAt)}`}</div>
            </div>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Select</span>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11.5px] text-muted-foreground flex items-start gap-2">
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>Connect GitHub/Vercel/Supabase from Integrations to enable health, deploys and history per project.</span>
      </div>
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}
