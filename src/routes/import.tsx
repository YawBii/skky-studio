import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Github, GitBranch, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { NoProjectSelected } from "@/components/project-empty";
import { parseRepoInput, type ParsedRepo } from "@/services/github-import";
import { createConnection } from "@/services/project-connections";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import GitHub repo — yawB" },
      { name: "description", content: "Link a GitHub repository to the selected project." },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const { project, projectIsReal, workspaceIsReal } = useSelectedProject();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (!workspaceIsReal || !projectIsReal || !project) {
    return (
      <NoProjectSelected hint="Select or create a project first, then import a GitHub repo to link to it." />
    );
  }

  const parsed: ParsedRepo | null = parseRepoInput(url);

  async function link() {
    if (!parsed || !project) return;
    setBusy(true);
    const res = await createConnection({
      projectId: project.id,
      provider: "github",
      status: "pending",
      repoFullName: parsed.fullName,
      repoUrl: parsed.url,
    });
    setBusy(false);
    if (!res.ok) {
      if (res.tableMissing) {
        toast.error(`project_connections table missing. Run ${res.sqlFile} in the SQL editor.`);
      } else {
        toast.error(res.error);
      }
      return;
    }
    toast.success(`Linked ${parsed.fullName} to ${project.name}`);
    navigate({ to: "/connectors" });
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-[800px] mx-auto">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
          {project.name}
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
          Link a GitHub repository
        </h1>
        <p className="mt-2 text-muted-foreground">
          Paste an owner/repo or full GitHub URL. The link is stored in{" "}
          <code className="font-mono">project_connections</code>; OAuth & sync wire in the next
          pass.
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
            Link repo <ArrowRight />
          </Button>
        </div>
        {parsed && (
          <div className="mt-3 text-[12px] text-muted-foreground">
            Parsed as <span className="font-mono text-foreground/80">{parsed.fullName}</span>
          </div>
        )}
        <div className="mt-5 text-[11.5px] text-muted-foreground inline-flex items-start gap-2">
          <Sparkles className="h-3 w-3 mt-0.5" />
          We never claim a repo is connected until status flips to{" "}
          <code className="font-mono">connected</code>. Real OAuth & branch sync arrive next.
        </div>
      </div>
    </div>
  );
}
