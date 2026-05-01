import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import { Plus, FolderKanban, AlertCircle, Check, Github, Triangle, RefreshCw, ExternalLink, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useProjects } from "@/hooks/use-projects";
import { ProjectScopedEmpty, ProjectSurfaceError } from "@/components/project-empty";
import { CreateProjectEmpty } from "@/components/empty-states";
import {
  listGithubReposFn,
  listVercelProjectsFn,
} from "@/services/providers.functions";
import { createProject } from "@/services/projects";
import { createConnection } from "@/services/project-connections";
import { cn } from "@/lib/utils";

const TabSchema = z.object({
  tab: z.enum(["projects", "github", "vercel", "import"]).optional(),
}).optional();

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — yawB" },
      { name: "description", content: "All projects in your workspace, with browse and import from GitHub and Vercel." },
    ],
  }),
  validateSearch: TabSchema,
  component: ProjectsPage,
});

type TabKey = "projects" | "github" | "vercel" | "import";

function ProjectsPage() {
  const { current: workspace, isReal: workspaceIsReal } = useWorkspaces();
  const { projects, current, loading, isError, error, select, refresh } = useProjects(workspace?.id);
  const navigate = useNavigate();
  const search = useSearch({ from: "/projects" }) as { tab?: TabKey } | undefined;
  const tab: TabKey = search?.tab ?? "projects";
  const [createOpen, setCreateOpen] = useState(false);

  function setTab(t: TabKey) {
    navigate({ to: "/projects", search: { tab: t } as never }).catch(() => {});
  }

  function openProject(id: string, name: string) {
    select(id);
    toast(`Opening ${name}…`);
    navigate({ to: "/builder/$projectId", params: { projectId: id } }).catch((err) => {
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

  return (
    <div className="px-6 md:px-10 py-10 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            {projects.length} project{projects.length === 1 ? "" : "s"} in {workspace?.name}.{" "}
            <Link to="/integrations" className="text-primary">Integrations</Link> for provider setup.
          </p>
        </div>
        <Button type="button" variant="hero" onClick={() => setCreateOpen(true)} className="touch-manipulation">
          <Plus className="h-3.5 w-3.5" /> New project
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <TabsList className="bg-white/[0.03] border border-white/5">
          <TabsTrigger value="projects">My Projects</TabsTrigger>
          <TabsTrigger value="github"><Github className="h-3.5 w-3.5 mr-1.5" /> GitHub Repos</TabsTrigger>
          <TabsTrigger value="vercel"><Triangle className="h-3.5 w-3.5 mr-1.5" /> Vercel Projects</TabsTrigger>
          <TabsTrigger value="import">Import Existing</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-5">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading projects…</div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-gradient-card p-10 text-center">
              <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground" />
              <h2 className="mt-3 font-display text-xl font-semibold">No projects yet</h2>
              <p className="text-sm text-muted-foreground mt-1">Create your first project, or import from GitHub.</p>
              <div className="flex justify-center gap-2 mt-5">
                <Button type="button" variant="hero" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" /> New project</Button>
                <Button type="button" variant="soft" onClick={() => setTab("github")}><Github className="h-3.5 w-3.5" /> Browse GitHub</Button>
              </div>
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
                    className={cn(
                      "w-full text-left flex items-center gap-3 px-5 py-4 transition cursor-pointer",
                      isCurrent ? "bg-primary/10" : "hover:bg-white/[0.03] active:bg-white/[0.05]",
                      i < projects.length - 1 && "border-b border-white/5",
                    )}
                  >
                    <div className={cn("h-9 w-9 rounded-xl border grid place-items-center",
                      isCurrent ? "bg-primary/20 border-primary/40" : "bg-white/5 border-white/10")}>
                      <FolderKanban className={cn("h-4 w-4", isCurrent ? "text-primary" : "text-muted-foreground")} />
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
                    <span className={cn("text-[10px] uppercase tracking-[0.18em]",
                      isCurrent ? "text-primary" : "text-muted-foreground")}>
                      {isCurrent ? "Open" : "Select"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11.5px] text-muted-foreground flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Connect GitHub/Vercel/Supabase from <Link to="/integrations" className="text-primary">Integrations</Link>{" "}
              to enable health, deploys, and history per project.
            </span>
          </div>
        </TabsContent>

        <TabsContent value="github" className="mt-5">
          <GithubReposTab
            workspaceId={workspace?.id ?? ""}
            onImported={async (id, name) => { await refresh(); openProject(id, name); }}
          />
        </TabsContent>

        <TabsContent value="vercel" className="mt-5">
          <VercelProjectsTab />
        </TabsContent>

        <TabsContent value="import" className="mt-5">
          <ImportExistingTab
            workspaceId={workspace?.id ?? ""}
            onImported={async (id, name) => { await refresh(); openProject(id, name); }}
          />
        </TabsContent>
      </Tabs>

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

/* ---------- GitHub Repos tab ---------- */

function GithubReposTab({ workspaceId, onImported }: { workspaceId: string; onImported: (id: string, name: string) => void }) {
  const [state, setState] = useState<{ loading: boolean; error?: string; missing?: string[]; repos: Awaited<ReturnType<typeof listGithubReposFn>>["repos"] }>({
    loading: true, repos: [],
  });
  const [importing, setImporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const res = await listGithubReposFn({ data: { perPage: 50 } });
      if (!res.ok) {
        setState({ loading: false, error: res.error, missing: res.missing, repos: [] });
        return;
      }
      setState({ loading: false, repos: res.repos });
    } catch (e) {
      setState({ loading: false, error: e instanceof Error ? e.message : String(e), repos: [] });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function importRepo(r: { fullName: string; name: string; htmlUrl: string; defaultBranch: string; description: string | null }) {
    if (!workspaceId) { toast.error("Select a workspace first"); return; }
    setImporting(r.fullName);
    try {
      const created = await createProject({
        workspaceId,
        name: r.name,
        description: r.description ?? `Imported from ${r.fullName}`,
      });
      if (!created.ok) { toast.error(created.error); return; }
      const conn = await createConnection({
        projectId: created.project.id,
        provider: "github",
        status: "connected",
        repoFullName: r.fullName,
        repoUrl: r.htmlUrl,
        defaultBranch: r.defaultBranch,
        metadata: { imported_from: "integrations" },
      });
      if (!conn.ok) toast.warning(`Project created, connection failed: ${conn.error}`);
      else toast.success(`Imported ${r.fullName}`);
      onImported(created.project.id, created.project.name);
    } finally {
      setImporting(null);
    }
  }

  return (
    <ProviderListCard
      title="GitHub Repositories"
      onRefresh={load}
      loading={state.loading}
      error={state.error}
      missing={state.missing}
      providerSetupHint="GITHUB_TOKEN missing — add it from Lovable Cloud secrets."
      empty={state.repos.length === 0 && !state.loading && !state.error}
      emptyMessage="No repositories visible to this token."
    >
      {state.repos.map((r) => (
        <div key={r.id} className="flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-b-0">
          <Github className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{r.fullName}</div>
            <div className="text-[11.5px] text-muted-foreground truncate">
              {r.private ? "Private · " : "Public · "}{r.defaultBranch}
              {r.description ? ` · ${r.description}` : ""}
            </div>
          </div>
          <a href={r.htmlUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground text-[11px] inline-flex items-center gap-1">
            View <ExternalLink className="h-3 w-3" />
          </a>
          <Button
            variant="soft"
            size="sm"
            onClick={() => importRepo(r)}
            disabled={importing === r.fullName}
          >
            {importing === r.fullName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Import
          </Button>
        </div>
      ))}
    </ProviderListCard>
  );
}

/* ---------- Vercel Projects tab ---------- */

function VercelProjectsTab() {
  const [state, setState] = useState<{ loading: boolean; error?: string; missing?: string[]; projects: Awaited<ReturnType<typeof listVercelProjectsFn>>["projects"] }>({
    loading: true, projects: [],
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const res = await listVercelProjectsFn({ data: { limit: 50 } });
      if (!res.ok) {
        setState({ loading: false, error: res.error, missing: res.missing, projects: [] });
        return;
      }
      setState({ loading: false, projects: res.projects });
    } catch (e) {
      setState({ loading: false, error: e instanceof Error ? e.message : String(e), projects: [] });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <ProviderListCard
      title="Vercel Projects"
      onRefresh={load}
      loading={state.loading}
      error={state.error}
      missing={state.missing}
      providerSetupHint="VERCEL_TOKEN missing — add it from Lovable Cloud secrets."
      empty={state.projects.length === 0 && !state.loading && !state.error}
      emptyMessage="No Vercel projects visible to this token."
    >
      {state.projects.map((p) => (
        <div key={p.id} className="flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-b-0">
          <Triangle className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{p.name}</div>
            <div className="text-[11.5px] text-muted-foreground truncate">
              {p.framework ?? "—"}{p.link?.repo ? ` · ${p.link.repo}` : ""}{p.updatedAt ? ` · updated ${formatDate(p.updatedAt)}` : ""}
            </div>
          </div>
          {p.productionUrl && (
            <a href={p.productionUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground text-[11px] inline-flex items-center gap-1">
              Live <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ))}
    </ProviderListCard>
  );
}

/* ---------- Import Existing tab ---------- */

function ImportExistingTab({ workspaceId, onImported }: { workspaceId: string; onImported: (id: string, name: string) => void }) {
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!workspaceId) { toast.error("Select a workspace first"); return; }
    const normalized = repoUrl
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/^github\.com\//, "")
      .replace(/\.git$/, "")
      .replace(/^\/+|\/+$/g, "");
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized)) {
      toast.error("Enter owner/repo or a github.com URL");
      return;
    }
    const name = normalized.split("/").pop()!;
    setBusy(true);
    try {
      const created = await createProject({ workspaceId, name, description: `Imported from ${normalized}` });
      if (!created.ok) { toast.error(created.error); return; }
      const conn = await createConnection({
        projectId: created.project.id,
        provider: "github",
        status: "connected",
        repoFullName: normalized,
        repoUrl: `https://github.com/${normalized}`,
      });
      if (!conn.ok) toast.warning(`Project created, connection failed: ${conn.error}`);
      else toast.success(`Imported ${normalized}`);
      setRepoUrl("");
      onImported(created.project.id, created.project.name);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-6 max-w-2xl">
      <h2 className="font-display font-semibold text-lg">Import an existing repository</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Paste a GitHub URL or <code>owner/repo</code>. Creates a yawB project and links the repo.
      </p>
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 mt-4">
        <input
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="github.com/owner/repo"
          className="h-10 rounded-lg border border-white/10 bg-background/50 px-3 text-sm focus:outline-none"
        />
        <Button variant="hero" onClick={submit} disabled={busy || !repoUrl.trim()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Import
        </Button>
      </div>
      <div className="mt-4 text-[11.5px] text-muted-foreground">
        Want to browse all visible repos instead? See the <button className="text-primary underline" onClick={() => {
          const url = new URL(window.location.href); url.searchParams.set("tab", "github"); window.history.pushState({}, "", url); window.location.reload();
        }}>GitHub Repos</button> tab.
      </div>
    </div>
  );
}

/* ---------- Shared list card ---------- */

function ProviderListCard(props: {
  title: string;
  onRefresh: () => void;
  loading: boolean;
  error?: string;
  missing?: string[];
  providerSetupHint?: string;
  empty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="font-display font-semibold text-sm">{props.title}</div>
        <Button variant="ghost" size="sm" onClick={props.onRefresh} disabled={props.loading}>
          <RefreshCw className={cn("h-3.5 w-3.5", props.loading && "animate-spin")} />
        </Button>
      </div>

      {props.error && (
        <div className="m-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[12.5px] text-destructive">
          <div className="font-medium">{props.error}</div>
          {props.missing && props.missing.length > 0 && (
            <div className="mt-1 text-muted-foreground">
              Missing env: <span className="font-mono">{props.missing.join(", ")}</span>.{" "}
              {props.providerSetupHint}{" "}
              <Link to="/integrations" className="text-primary">Open Integrations</Link>
            </div>
          )}
        </div>
      )}

      {!props.error && props.loading && (
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      )}

      {!props.error && !props.loading && props.empty && (
        <div className="p-10 text-center text-sm text-muted-foreground">{props.emptyMessage}</div>
      )}

      {!props.error && !props.loading && !props.empty && <div>{props.children}</div>}
    </div>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}
