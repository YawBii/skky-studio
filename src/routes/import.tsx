import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Github, GitBranch, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { NoProjectSelected } from "@/components/project-empty";
import { parseRepoInput, type ParsedRepo } from "@/services/github-import";
import { createConnection } from "@/services/project-connections";
import { createProject } from "@/services/projects";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import GitHub repo — yawB" },
      { name: "description", content: "Import a GitHub repository as a new project." },
    ],
  }),
  component: ImportPage,
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "imported-repo";
}

function ImportPage() {
  const { workspace, workspaceIsReal, refreshProjects, selectProject } = useSelectedProject();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (!workspaceIsReal || !workspace) {
    return (
      <NoProjectSelected hint="Select or create a workspace first, then import a GitHub repo into it." />
    );
  }

  const parsed: ParsedRepo | null = parseRepoInput(url);

  async function link() {
    if (!parsed || !workspace) return;
    setBusy(true);
    try {
      // Always create a fresh project from the repo so we never overwrite an
      // existing project's local files (this is what produced the "Goodhand
      // preview" surprise on previous imports).
      const created = await createProject({
        workspaceId: workspace.id,
        name: parsed.repo,
        slug: slugify(`${parsed.owner}-${parsed.repo}`),
        description: `Imported from ${parsed.fullName}`,
      });
      if (!created.ok) {
        toast.error(`Couldn't create project: ${created.error}`);
        return;
      }
      const projectId = created.project.id;

      const res = await createConnection({
        projectId,
        provider: "github",
        status: "pending",
        repoFullName: parsed.fullName,
        repoUrl: parsed.url,
      });
      if (!res.ok) {
        if (res.tableMissing) {
          toast.error(`project_connections table missing. Run ${res.sqlFile} in the SQL editor.`);
        } else {
          toast.error(res.error);
        }
        return;
      }
      await refreshProjects();
      selectProject(projectId);
      toast.success(`Imported ${parsed.fullName}`);
      void navigate({ to: "/builder/$projectId", params: { projectId } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-[800px] mx-auto">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
          {workspace.name}
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
          Import a GitHub repository
        </h1>
        <p className="mt-2 text-muted-foreground">
          Paste an owner/repo or full GitHub URL. We'll create a fresh project for it so the import
          never collides with an existing project's preview.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-gradient-card shadow-elevated p-6">
        <label className="block text-sm font-medium mb-2">Repository</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-white/10 bg-background/50 px-4 h-12">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none text-sm"
              placeholder="github.com/your-org/your-repo"
            />
          </div>
          <Button variant="hero" size="lg" onClick={link} disabled={!parsed || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}{" "}
            Import repo <ArrowRight />
          </Button>
        </div>
        {parsed && (
          <div className="mt-3 text-[12px] text-muted-foreground">
            Parsed as <span className="font-mono text-foreground/80">{parsed.fullName}</span>
          </div>
        )}
        <div className="mt-5 text-[11.5px] text-muted-foreground inline-flex items-start gap-2">
          <Sparkles className="h-3 w-3 mt-0.5" />
          A new project is created for each import — your existing projects stay untouched.
        </div>
      </div>
    </div>
  );
}
