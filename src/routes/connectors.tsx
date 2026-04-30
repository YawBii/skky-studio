import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Github, Triangle, Database, Plus, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { useProjectConnections } from "@/hooks/use-project-connections";
import { ProjectScopedEmpty, NoProjectSelected } from "@/components/project-empty";
import { createConnection, deleteConnection, PROJECT_CONNECTIONS_SQL_FILE, type ConnectionProvider, type ProjectConnection } from "@/services/project-connections";

export const Route = createFileRoute("/connectors")({
  head: () => ({ meta: [{ title: "Integrations — yawB" }, { name: "description", content: "GitHub, Vercel and Supabase connections for this project." }] }),
  component: ConnectorsPage,
});

const PROVIDERS: { id: ConnectionProvider; label: string; icon: React.ComponentType<{ className?: string }>; needsRepo: boolean }[] = [
  { id: "github",  label: "GitHub",  icon: Github,   needsRepo: true  },
  { id: "vercel",  label: "Vercel",  icon: Triangle, needsRepo: false },
];

function ConnectorsPage() {
  const { project, projectIsReal, workspaceIsReal } = useSelectedProject();
  const { connections, isTableMissing, isError, error, sqlFile, loading, refresh } = useProjectConnections(project?.id ?? null);
  const [provider, setProvider] = useState<ConnectionProvider>("github");
  const [repo, setRepo] = useState("");
  const [busy, setBusy] = useState(false);

  if (!workspaceIsReal || !projectIsReal || !project) {
    return <NoProjectSelected hint="Integrations are scoped to the selected project." />;
  }

  if (isTableMissing) {
    return (
      <ProjectScopedEmpty
        icon={Database}
        eyebrow={project.name}
        title="Run the project_connections migration"
        hint={`The table public.project_connections doesn't exist yet. Run ${sqlFile ?? PROJECT_CONNECTIONS_SQL_FILE} in the Cloud SQL editor and reload.`}
      />
    );
  }

  if (isError) {
    return (
      <div className="p-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <div><div className="font-medium">Couldn't read connections</div><div className="text-muted-foreground mt-1">{error}</div></div>
        </div>
      </div>
    );
  }

  async function add() {
    if (!project) return;
    const repoFullName = provider === "github" ? repo.trim() : null;
    setBusy(true);
    const res = await createConnection({
      projectId: project.id,
      provider,
      status: "pending",
      repoFullName,
      repoUrl: repoFullName ? `https://github.com/${repoFullName}` : null,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setRepo("");
    toast.success(`${provider} connection created`);
    void refresh();
  }

  async function remove(c: ProjectConnection) {
    const res = await deleteConnection(c.id);
    if (!res.ok) { toast.error(res.error ?? "Delete failed"); return; }
    toast.success(`Removed ${c.provider} connection`);
    void refresh();
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-[1100px] mx-auto">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">{project.name}</div>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-1">Connect GitHub, Vercel and other providers to enable real deploys, health and history.</p>
      </div>

      {/* Add new */}
      <div className="rounded-2xl border border-white/5 bg-gradient-card p-5 mb-8">
        <div className="text-[13px] font-medium mb-3">Add a connection</div>
        <div className="grid sm:grid-cols-[160px_1fr_auto] gap-3 items-start">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as ConnectionProvider)}
            className="h-10 rounded-lg border border-white/10 bg-background/50 px-3 text-sm focus:outline-none"
          >
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {provider === "github" ? (
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="owner/repo or https://github.com/owner/repo"
              className="h-10 rounded-lg border border-white/10 bg-background/50 px-3 text-sm focus:outline-none"
            />
          ) : (
            <div className="text-[12px] text-muted-foreground self-center">Real Vercel OAuth wires in the next pass — this records a placeholder row.</div>
          )}
          <Button variant="hero" onClick={add} disabled={busy || (provider === "github" && !repo.trim())}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
          </Button>
        </div>
      </div>

      {/* Existing */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : connections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          No connections yet for this project. Add one above to enable Deploys, Health and History.
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
          {connections.map((c, i) => (
            <ConnectionRow key={c.id} c={c} last={i === connections.length - 1} onDelete={() => remove(c)} />
          ))}
        </div>
      )}

      <div className="mt-6 text-[12px] text-muted-foreground">
        Project ID: <code className="font-mono">{project.id}</code> · <Link to="/" className="text-primary">Back to workspace</Link>
      </div>
    </div>
  );
}

function ConnectionRow({ c, last, onDelete }: { c: ProjectConnection; last: boolean; onDelete: () => void }) {
  const Icon = c.provider === "github" ? Github : c.provider === "vercel" ? Triangle : Database;
  const statusCls =
    c.status === "connected" ? "border-success/30 text-success bg-success/5" :
    c.status === "pending" ? "border-warning/30 text-warning bg-warning/5" :
    c.status === "error" ? "border-destructive/30 text-destructive bg-destructive/5" :
    "border-white/10 text-muted-foreground";
  return (
    <div className={cn("flex items-center gap-3 px-5 py-4", !last && "border-b border-white/5")}>
      <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 grid place-items-center">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold capitalize">{c.provider}</div>
        <div className="text-xs text-muted-foreground truncate">{c.repoFullName ?? c.repoUrl ?? "—"}</div>
      </div>
      <span className={cn("text-[10.5px] px-2 py-1 rounded-full border capitalize", statusCls)}>{c.status}</span>
      <Button variant="ghost" size="icon" onClick={onDelete} title="Remove">
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}
