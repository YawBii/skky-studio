import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, FolderKanban, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useProjects } from "@/hooks/use-projects";
import { ProjectScopedEmpty, ProjectSurfaceError } from "@/components/project-empty";
import { CreateProjectEmpty } from "@/components/empty-states";

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
  const { projects, current, loading, isError, error, select, refresh } = useProjects(workspace?.id);
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  function openProject(id: string, name: string) {
    // eslint-disable-next-line no-console
    console.info("[yawb] project select clicked", { id, name });
    select(id);
    // eslint-disable-next-line no-console
    console.info("[yawb] selectedProjectId", id);
    toast(`Opening ${name}…`);
    // eslint-disable-next-line no-console
    console.info("[yawb] navigating to builder", `/builder/${id}`);
    navigate({ to: "/builder/$projectId", params: { projectId: id } }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[yawb] navigation failed", err);
      toast.error(`Couldn't open project: ${err?.message ?? String(err)}`);
    });
  }

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

  const showEmpty = projects.length === 0;

  return (
    <div className="px-6 md:px-10 py-10 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            {projects.length} project{projects.length === 1 ? "" : "s"} in {workspace?.name}
          </p>
        </div>
        <Button
          type="button"
          variant="hero"
          onClick={() => setCreateOpen(true)}
          className="touch-manipulation"
        >
          <Plus className="h-3.5 w-3.5" /> New project
        </Button>
      </div>

      {showEmpty ? (
        <div className="rounded-2xl border border-white/5 bg-gradient-card p-10 text-center">
          <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground" />
          <h2 className="mt-3 font-display text-xl font-semibold">No projects yet</h2>
          <p className="text-sm text-muted-foreground mt-1">Create your first project to start building.</p>
          <Button type="button" variant="hero" className="mt-5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New project
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
          {projects.map((p, i) => {
            const isCurrent = current?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => openProject(p.id, p.name)}
                aria-current={isCurrent ? "true" : undefined}
                className={`w-full text-left flex items-center gap-3 px-5 py-4 transition touch-manipulation cursor-pointer ${
                  isCurrent ? "bg-primary/10" : "hover:bg-white/[0.03] active:bg-white/[0.05]"
                } ${i < projects.length - 1 ? "border-b border-white/5" : ""}`}
              >
                <div className={`h-9 w-9 rounded-xl border grid place-items-center ${
                  isCurrent ? "bg-primary/20 border-primary/40" : "bg-white/5 border-white/10"
                }`}>
                  <FolderKanban className={`h-4 w-4 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold truncate flex items-center gap-2">
                    {p.name}
                    {isCurrent && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.description ?? `${p.slug} · created ${formatDate(p.createdAt)}`}
                  </div>
                </div>
                <span className={`text-[10px] uppercase tracking-[0.18em] ${
                  isCurrent ? "text-primary" : "text-muted-foreground"
                }`}>
                  {isCurrent ? "Open" : "Select"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11.5px] text-muted-foreground flex items-start gap-2">
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>Connect GitHub/Vercel/Supabase from Integrations to enable health, deploys and history per project.</span>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl p-0 bg-transparent border-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Create a new project</DialogTitle>
          </DialogHeader>
          {workspace && workspaceIsReal ? (
            <CreateProjectEmpty
              workspaceId={workspace.id}
              workspaceName={workspace.name}
              onCreated={async (p) => {
                setCreateOpen(false);
                await refresh();
                openProject(p.id, p.name);
              }}
            />
          ) : (
            <div className="p-6 rounded-2xl border border-white/10 bg-background text-sm text-muted-foreground">
              Select a workspace first.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}
