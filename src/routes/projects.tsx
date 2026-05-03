import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import {
  Plus,
  FolderKanban,
  AlertCircle,
  Check,
  Github,
  Triangle,
  RefreshCw,
  ExternalLink,
  Download,
  Loader2,
  Link as LinkIcon,
  X,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useProjects } from "@/hooks/use-projects";
import { ProjectScopedEmpty, ProjectSurfaceError } from "@/components/project-empty";
import { CreateProjectEmpty } from "@/components/empty-states";
import { listGithubReposFn, listVercelProjectsFn } from "@/services/providers.functions";
import { createProject } from "@/services/projects";
import {
  upsertConnection,
  findConnectionByExternalId,
  listConnections,
  setConnectionStatus,
  findActiveVercelConnection,
  type ProjectConnection,
} from "@/services/project-connections";
import { ProviderLinksPanel } from "@/components/provider-links-panel";
import { cn } from "@/lib/utils";
import { MobileBootstrapPanel } from "@/components/mobile-bootstrap-panel";

const TabSchema = z
  .object({
    tab: z.enum(["projects", "github", "vercel", "import"]).optional(),
  })
  .optional();

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — yawB" },
      {
        name: "description",
        content: "All projects in your workspace, with browse and import from GitHub and Vercel.",
      },
    ],
  }),
  validateSearch: TabSchema,
  component: ProjectsPage,
});

type TabKey = "projects" | "github" | "vercel" | "import";

/* -------------------- Page shell -------------------- */

function ProjectsPage() {
  const { current: workspace, isReal: workspaceIsReal } = useWorkspaces();
  const { projects, current, loading, isError, error, select, refresh } = useProjects(
    workspace?.id,
  );
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
  if (isError)
    return <ProjectSurfaceError message={error} sqlFile="docs/sql/2026-04-30-collaboration.sql" />;

  return (
    <div className="px-6 md:px-10 py-10 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            {projects.length} project{projects.length === 1 ? "" : "s"} in {workspace?.name}.{" "}
            <Link to="/integrations" className="text-primary">
              Integrations
            </Link>{" "}
            for provider setup.
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <TabsList className="bg-white/[0.03] border border-white/5">
          <TabsTrigger value="projects">My Projects</TabsTrigger>
          <TabsTrigger value="github">
            <Github className="h-3.5 w-3.5 mr-1.5" /> GitHub Repos
          </TabsTrigger>
          <TabsTrigger value="vercel">
            <Triangle className="h-3.5 w-3.5 mr-1.5" /> Vercel Projects
          </TabsTrigger>
          <TabsTrigger value="import">Import Existing</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-5">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading projects…</div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-gradient-card p-10 text-center">
              <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground" />
              <h2 className="mt-3 font-display text-xl font-semibold">No projects yet</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first project, or import from GitHub.
              </p>
              <div className="flex justify-center gap-2 mt-5">
                <Button type="button" variant="hero" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> New project
                </Button>
                <Button type="button" variant="soft" onClick={() => setTab("github")}>
                  <Github className="h-3.5 w-3.5" /> Browse GitHub
                </Button>
              </div>
              <div className="mt-6 max-w-md mx-auto text-left">
                <MobileBootstrapPanel
                  selectedWorkspaceId={workspace?.id ?? null}
                  projectsCount={projects.length}
                  lastError={error ?? null}
                />
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
                    <div
                      className={cn(
                        "h-9 w-9 rounded-xl border grid place-items-center",
                        isCurrent
                          ? "bg-primary/20 border-primary/40"
                          : "bg-white/5 border-white/10",
                      )}
                    >
                      <FolderKanban
                        className={cn(
                          "h-4 w-4",
                          isCurrent ? "text-primary" : "text-muted-foreground",
                        )}
                      />
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
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-[0.18em]",
                        isCurrent ? "text-primary" : "text-muted-foreground",
                      )}
                    >
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
              Connect GitHub/Vercel/Supabase from{" "}
              <Link to="/integrations" className="text-primary">
                Integrations
              </Link>{" "}
              to enable health, deploys, and history per project.
            </span>
          </div>
        </TabsContent>

        <TabsContent value="github" className="mt-5">
          <GithubReposTab
            workspaceId={workspace?.id ?? ""}
            onImported={async (id, name) => {
              await refresh();
              openProject(id, name);
            }}
          />
        </TabsContent>

        <TabsContent value="vercel" className="mt-5">
          <VercelProjectsTab
            workspaceId={workspace?.id ?? ""}
            currentProjectId={current?.id ?? null}
            currentProjectName={current?.name ?? null}
          />
        </TabsContent>

        <TabsContent value="import" className="mt-5">
          <ImportExistingTab
            workspaceId={workspace?.id ?? ""}
            onImported={async (id, name) => {
              await refresh();
              openProject(id, name);
            }}
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

type GhRepo = Awaited<ReturnType<typeof listGithubReposFn>>["repos"][number];

function GithubReposTab({
  workspaceId,
  onImported,
}: {
  workspaceId: string;
  onImported: (id: string, name: string) => void;
}) {
  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    missing?: string[];
    repos: GhRepo[];
  }>({
    loading: true,
    repos: [],
  });
  const [importing, setImporting] = useState<string | null>(null);
  const [proofs, setProofs] = useState<Record<string, ImportProof>>({});

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

  useEffect(() => {
    void load();
  }, [load]);

  async function importRepo(r: GhRepo) {
    if (!workspaceId) {
      toast.error("Select a workspace first");
      return;
    }
    setImporting(r.fullName);
    const startedAt = new Date().toISOString();
    try {
      // Idempotency: if a connection for this repo already exists, reuse it.
      const existing = await findConnectionByExternalId("github", String(r.id), workspaceId);
      if (existing.ok && existing.connection) {
        const conn = existing.connection;
        setProofs((p) => ({
          ...p,
          [r.fullName]: {
            kind: "ok",
            createdProject: false,
            projectId: conn.projectId,
            connectionId: conn.id,
            provider: "github",
            externalId: String(r.id),
            url: conn.url ?? r.htmlUrl,
            startedAt,
            finishedAt: new Date().toISOString(),
          },
        }));
        toast.success(`Already imported — opening ${r.name}`);
        onImported(conn.projectId, r.name);
        return;
      }
      const created = await createProject({
        workspaceId,
        name: r.name,
        slug: slugify(r.fullName),
        description: r.description ?? `Imported from ${r.fullName}`,
      });
      if (!created.ok) {
        setProofs((p) => ({
          ...p,
          [r.fullName]: {
            kind: "err",
            error: created.error,
            startedAt,
            finishedAt: new Date().toISOString(),
          },
        }));
        toast.error(created.error);
        return;
      }
      const conn = await upsertConnection({
        projectId: created.project.id,
        provider: "github",
        externalId: String(r.id),
        status: "connected",
        url: r.htmlUrl,
        repoFullName: r.fullName,
        repoUrl: r.htmlUrl,
        defaultBranch: r.defaultBranch,
        workspaceId,
        tokenOwnerType: "workspace",
        metadata: { imported_from: "integrations", repo_id: r.id, private: r.private },
      });
      if (!conn.ok) {
        setProofs((p) => ({
          ...p,
          [r.fullName]: {
            kind: "warn",
            createdProject: true,
            projectId: created.project.id,
            error: conn.error,
            provider: "github",
            externalId: String(r.id),
            url: r.htmlUrl,
            startedAt,
            finishedAt: new Date().toISOString(),
          },
        }));
        toast.warning(`Project created, connection failed: ${conn.error}`);
      } else {
        setProofs((p) => ({
          ...p,
          [r.fullName]: {
            kind: "ok",
            createdProject: true,
            projectId: created.project.id,
            connectionId: conn.connection.id,
            provider: "github",
            externalId: String(r.id),
            url: r.htmlUrl,
            startedAt,
            finishedAt: new Date().toISOString(),
          },
        }));
        toast.success(`Imported ${r.fullName}`);
      }
      onImported(created.project.id, created.project.name);
    } catch (e) {
      setProofs((p) => ({
        ...p,
        [r.fullName]: {
          kind: "err",
          error: e instanceof Error ? e.message : String(e),
          startedAt,
          finishedAt: new Date().toISOString(),
        },
      }));
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
      {state.repos.map((r) => {
        const proof = proofs[r.fullName];
        return (
          <div key={r.id} className="border-b border-white/5 last:border-b-0">
            <div className="flex items-center gap-3 px-5 py-3">
              <Github className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{r.fullName}</div>
                <div className="text-[11.5px] text-muted-foreground truncate">
                  {r.private ? "Private · " : "Public · "}
                  {r.defaultBranch}
                  {r.description ? ` · ${r.description}` : ""}
                </div>
              </div>
              <a
                href={r.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground text-[11px] inline-flex items-center gap-1"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
              <Button
                variant="soft"
                size="sm"
                onClick={() => importRepo(r)}
                disabled={importing === r.fullName}
              >
                {importing === r.fullName ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Import
              </Button>
            </div>
            {proof && <ProofBlock proof={proof} />}
          </div>
        );
      })}
    </ProviderListCard>
  );
}

/* ---------- Vercel Projects tab ---------- */

type VercelP = Awaited<ReturnType<typeof listVercelProjectsFn>>["projects"][number];

function VercelProjectsTab({
  workspaceId,
  currentProjectId,
  currentProjectName,
}: {
  workspaceId: string;
  currentProjectId: string | null;
  currentProjectName: string | null;
}) {
  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    missing?: string[];
    projects: VercelP[];
  }>({
    loading: true,
    projects: [],
  });
  const [linking, setLinking] = useState<string | null>(null);
  // Sync health per Vercel project id.
  const [health, setHealth] = useState<
    Record<string, { connection?: ProjectConnection; error?: string; checkedAt: string }>
  >({});
  // The single active Vercel connection bound to the *current* yawB project.
  const [activeForCurrent, setActiveForCurrent] = useState<ProjectConnection | null>(null);
  const [duplicates, setDuplicates] = useState<ProjectConnection[]>([]);
  // Pending replacement confirmation: incoming vercel project id.
  const [confirmReplace, setConfirmReplace] = useState<VercelP | null>(null);
  // GitHub repo bound to the current yawB project (used to warn about repo mismatches).
  const [currentGithubRepo, setCurrentGithubRepo] = useState<string | null>(null);

  const refreshActive = useCallback(async () => {
    if (!currentProjectId) {
      setActiveForCurrent(null);
      setDuplicates([]);
      setCurrentGithubRepo(null);
      return;
    }
    const r = await findActiveVercelConnection(currentProjectId);
    setActiveForCurrent(r.active);
    setDuplicates(r.duplicates);
    const all = await listConnections(currentProjectId);
    const gh = all.connections.find((c) => c.provider === "github" && c.status === "connected");
    setCurrentGithubRepo(gh?.repoFullName ?? null);
  }, [currentProjectId]);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const res = await listVercelProjectsFn({ data: { limit: 50 } });
      if (!res.ok) {
        setState({ loading: false, error: res.error, missing: res.missing, projects: [] });
        return;
      }
      setState({ loading: false, projects: res.projects });
      const next: typeof health = {};
      await Promise.all(
        res.projects.map(async (p) => {
          const r = await findConnectionByExternalId("vercel", p.id, workspaceId);
          if (r.ok && r.connection)
            next[p.id] = { connection: r.connection, checkedAt: new Date().toISOString() };
        }),
      );
      setHealth(next);
      await refreshActive();
    } catch (e) {
      setState({ loading: false, error: e instanceof Error ? e.message : String(e), projects: [] });
    }
  }, [workspaceId, refreshActive]);

  useEffect(() => {
    void load();
  }, [load]);

  async function performLink(p: VercelP) {
    if (!workspaceId || !currentProjectId) return;
    setLinking(p.id);
    try {
      // 1) Demote any existing active Vercel rows on the current project that
      //    are NOT this external id. Enforces one-active-link invariant.
      const before = await findActiveVercelConnection(currentProjectId);
      const stale = [
        ...(before.active && before.active.externalId !== p.id ? [before.active] : []),
        ...before.duplicates.filter((c) => c.externalId !== p.id),
      ];
      for (const old of stale) {
        const r = await setConnectionStatus(old.id, "disconnected");
        if (!r.ok) toast.warning(`Couldn't disconnect old link: ${r.error}`);
      }
      const sameExtraDup = before.duplicates.filter((c) => c.externalId === p.id);
      for (const dup of sameExtraDup) {
        await setConnectionStatus(dup.id, "disconnected");
      }

      const url = p.productionUrl ?? null;

      const res = await upsertConnection({
        projectId: currentProjectId,
        provider: "vercel",
        externalId: p.id,
        status: "connected",
        url,
        repoFullName: p.link?.repo ?? null,
        repoUrl: p.link?.repo ? `https://github.com/${p.link.repo}` : null,
        workspaceId,
        tokenOwnerType: "workspace",
        metadata: {
          name: p.name,
          framework: p.framework,
          link: p.link,
          updatedAt: p.updatedAt,
        },
      });
      if (!res.ok) {
        setHealth((h) => ({
          ...h,
          [p.id]: { error: res.error, checkedAt: new Date().toISOString() },
        }));
        toast.error(res.error);
        return;
      }
      const verify = await listConnections(currentProjectId);
      const persisted = verify.connections.find(
        (c) =>
          c.provider === "vercel" &&
          c.externalId === p.id &&
          c.projectId === currentProjectId &&
          c.status === "connected",
      );
      if (!persisted) {
        setHealth((h) => ({
          ...h,
          [p.id]: {
            error: "Link saved but not visible on project — try Refresh links",
            checkedAt: new Date().toISOString(),
          },
        }));
        toast.warning(
          `Linked ${p.name}, but verification couldn't find the row. Use Refresh links.`,
        );
        return;
      }
      setHealth((h) => ({
        ...h,
        [p.id]: { connection: persisted, checkedAt: new Date().toISOString() },
      }));
      if (!url) {
        toast.warning(`Linked ${p.name} — no deployment URL yet, Preview will be unavailable.`);
      } else {
        toast.success(`Linked ${p.name} to ${currentProjectName ?? "current project"}`);
      }
      await refreshActive();
      void load();
    } finally {
      setLinking(null);
    }
  }

  async function linkToCurrent(p: VercelP) {
    if (!workspaceId) {
      toast.error("Select a workspace first");
      return;
    }
    if (!currentProjectId) {
      toast.error("Open a yawB project first (My Projects → click a project)");
      return;
    }
    if (currentGithubRepo && p.link?.repo) {
      const a = currentGithubRepo.toLowerCase();
      const b = p.link.repo.toLowerCase();
      if (a !== b) {
        const ok = window.confirm(
          `This Vercel project is linked to ${p.link.repo}, but the current yawB project's GitHub repo is ${currentGithubRepo}. Link anyway?`,
        );
        if (!ok) return;
      }
    }
    if (activeForCurrent && activeForCurrent.externalId !== p.id) {
      setConfirmReplace(p);
      return;
    }
    await performLink(p);
  }

  return (
    <div className="space-y-4">
      {currentProjectId && (
        <ProviderLinksPanel
          projectId={currentProjectId}
          workspaceId={workspaceId || null}
          compact
        />
      )}
      {duplicates.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-[12px] text-destructive flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
          <div className="flex-1">
            {duplicates.length} extra active Vercel connection(s) found on this project. Repair to
            keep only one active link.
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              for (const d of duplicates) await setConnectionStatus(d.id, "disconnected");
              toast.success("Disconnected duplicate Vercel links");
              await refreshActive();
              void load();
            }}
          >
            Repair
          </Button>
        </div>
      )}
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
        {!currentProjectId && (
          <div className="px-5 py-3 border-b border-white/5 text-[12px] text-warning bg-warning/5 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
            <span>
              Open a yawB project first to enable linking. Use{" "}
              <Link to="/projects" search={{ tab: "projects" } as never} className="text-primary">
                My Projects
              </Link>
              .
            </span>
          </div>
        )}
        {state.projects.map((p) => {
          const h = health[p.id];
          // Strict definition of "linked to current project":
          //   connection exists AND projectId matches AND status="connected"
          //   AND externalId matches this row's Vercel project id.
          const linkedToCurrent =
            !!h?.connection &&
            h.connection.projectId === currentProjectId &&
            h.connection.status === "connected" &&
            h.connection.externalId === p.id;
          const linkedElsewhere =
            !!h?.connection &&
            h.connection.status === "connected" &&
            h.connection.projectId !== currentProjectId;
          return (
            <div key={p.id} className="border-b border-white/5 last:border-b-0">
              <div className="flex items-center gap-3 px-5 py-3">
                <Triangle className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-[11.5px] text-muted-foreground truncate">
                    {p.framework ?? "—"}
                    {p.link?.repo ? ` · ${p.link.repo}` : ""}
                    {p.updatedAt ? ` · updated ${formatDate(p.updatedAt)}` : ""}
                  </div>
                </div>
                {p.productionUrl && (
                  <a
                    href={p.productionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground text-[11px] inline-flex items-center gap-1"
                  >
                    Live <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => linkToCurrent(p)}
                  disabled={linking === p.id || !currentProjectId}
                  title={
                    currentProjectId ? `Link to ${currentProjectName}` : "Open a yawB project first"
                  }
                >
                  {linking === p.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LinkIcon className="h-3.5 w-3.5" />
                  )}
                  {linkedToCurrent ? "Re-link" : "Link to current"}
                </Button>
              </div>
              {h && (
                <div
                  className={cn(
                    "px-5 pb-3 text-[11.5px] flex items-center gap-2",
                    h.error
                      ? "text-destructive"
                      : linkedToCurrent
                        ? "text-success"
                        : "text-muted-foreground",
                  )}
                >
                  {h.error ? (
                    <X className="h-3 w-3" />
                  ) : linkedToCurrent ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  {h.error
                    ? `Failed: ${h.error}`
                    : linkedToCurrent
                      ? `Linked to current project · ${h.connection?.url ? "deployed" : "no deployment URL"} · last synced ${new Date(h.checkedAt).toLocaleTimeString()}`
                      : linkedElsewhere
                        ? `Linked to another yawB project (${h.connection?.projectId.slice(0, 8)}…)`
                        : "Not linked"}
                </div>
              )}
            </div>
          );
        })}
      </ProviderListCard>

      <Dialog open={!!confirmReplace} onOpenChange={(o) => !o && setConfirmReplace(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Replace Vercel link?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <span className="font-medium text-foreground">
                {currentProjectName ?? "Current project"}
              </span>{" "}
              is already linked to Vercel project{" "}
              <span className="font-mono text-foreground">
                {activeForCurrent?.externalId ?? ""}
              </span>
              .
            </p>
            <p>
              Linking <span className="font-medium text-foreground">{confirmReplace?.name}</span>{" "}
              will disconnect the existing link so only one remains.
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setConfirmReplace(null)}>
              Cancel
            </Button>
            <Button
              variant="hero"
              onClick={async () => {
                const p = confirmReplace;
                setConfirmReplace(null);
                if (p) await performLink(p);
              }}
            >
              Replace link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Import Existing tab ---------- */

function ImportExistingTab({
  workspaceId,
  onImported,
}: {
  workspaceId: string;
  onImported: (id: string, name: string) => void;
}) {
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<ImportProof | null>(null);

  async function submit() {
    if (!workspaceId) {
      toast.error("Select a workspace first");
      return;
    }
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
    const url = `https://github.com/${normalized}`;
    const startedAt = new Date().toISOString();
    setBusy(true);
    setProof(null);
    try {
      // Idempotency: external_id for "import existing" defaults to the
      // owner/repo string when we don't have a numeric repo id.
      const existing = await findConnectionByExternalId("github", normalized, workspaceId);
      if (existing.ok && existing.connection) {
        setProof({
          kind: "ok",
          createdProject: false,
          projectId: existing.connection.projectId,
          connectionId: existing.connection.id,
          provider: "github",
          externalId: normalized,
          url: existing.connection.url ?? url,
          startedAt,
          finishedAt: new Date().toISOString(),
        });
        toast.success(`Already imported — opening ${name}`);
        onImported(existing.connection.projectId, name);
        return;
      }
      const created = await createProject({
        workspaceId,
        name,
        slug: slugify(normalized),
        description: `Imported from ${normalized}`,
      });
      if (!created.ok) {
        setProof({
          kind: "err",
          error: created.error,
          startedAt,
          finishedAt: new Date().toISOString(),
        });
        toast.error(created.error);
        return;
      }
      const conn = await upsertConnection({
        projectId: created.project.id,
        provider: "github",
        externalId: normalized,
        status: "connected",
        url,
        repoFullName: normalized,
        repoUrl: url,
        workspaceId,
        tokenOwnerType: "workspace",
        metadata: { imported_from: "import-existing" },
      });
      if (!conn.ok) {
        setProof({
          kind: "warn",
          createdProject: true,
          projectId: created.project.id,
          error: conn.error,
          provider: "github",
          externalId: normalized,
          url,
          startedAt,
          finishedAt: new Date().toISOString(),
        });
        toast.warning(`Project created, connection failed: ${conn.error}`);
      } else {
        setProof({
          kind: "ok",
          createdProject: true,
          projectId: created.project.id,
          connectionId: conn.connection.id,
          provider: "github",
          externalId: normalized,
          url,
          startedAt,
          finishedAt: new Date().toISOString(),
        });
        toast.success(`Imported ${normalized}`);
      }
      setRepoUrl("");
      onImported(created.project.id, created.project.name);
    } catch (e) {
      setProof({
        kind: "err",
        error: e instanceof Error ? e.message : String(e),
        startedAt,
        finishedAt: new Date().toISOString(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-6 max-w-2xl">
      <h2 className="font-display font-semibold text-lg">Import an existing repository</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Paste a GitHub URL or <code>owner/repo</code>. Creates a yawB project and links the repo
        (idempotent).
      </p>
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 mt-4">
        <input
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="github.com/owner/repo"
          className="h-10 rounded-lg border border-white/10 bg-background/50 px-3 text-sm focus:outline-none"
        />
        <Button variant="hero" onClick={submit} disabled={busy || !repoUrl.trim()}>
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}{" "}
          Import
        </Button>
      </div>
      {proof && (
        <div className="mt-4">
          <ProofBlock proof={proof} />
        </div>
      )}
      <div className="mt-4 text-[11.5px] text-muted-foreground">
        Want to browse all visible repos? See the{" "}
        <Link to="/projects" search={{ tab: "github" } as never} className="text-primary underline">
          GitHub Repos
        </Link>{" "}
        tab.
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
              <Link to="/integrations" className="text-primary">
                Open Integrations
              </Link>
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

/* ---------- Proof block ---------- */

type ImportProof =
  | {
      kind: "ok";
      createdProject: boolean;
      projectId: string;
      connectionId: string;
      provider: "github" | "vercel";
      externalId: string;
      url: string | null;
      startedAt: string;
      finishedAt: string;
    }
  | {
      kind: "warn";
      createdProject: boolean;
      projectId: string;
      error: string;
      provider: "github" | "vercel";
      externalId: string;
      url: string | null;
      startedAt: string;
      finishedAt: string;
    }
  | {
      kind: "err";
      error: string;
      startedAt: string;
      finishedAt: string;
    };

function ProofBlock({ proof }: { proof: ImportProof }) {
  const tone =
    proof.kind === "ok"
      ? "border-success/30 bg-success/5 text-success"
      : proof.kind === "warn"
        ? "border-warning/30 bg-warning/5 text-warning"
        : "border-destructive/30 bg-destructive/5 text-destructive";
  const Icon = proof.kind === "ok" ? Check : proof.kind === "warn" ? AlertCircle : X;
  const summary =
    proof.kind === "ok"
      ? `Done in ${ms(proof.startedAt, proof.finishedAt)}`
      : proof.kind === "warn"
        ? `Partial in ${ms(proof.startedAt, proof.finishedAt)}`
        : `Failed in ${ms(proof.startedAt, proof.finishedAt)}`;

  const text =
    proof.kind === "err"
      ? `ERROR: ${proof.error}`
      : [
          `provider: ${proof.provider}`,
          `external_id: ${proof.externalId}`,
          `url: ${proof.url ?? "—"}`,
          `project_id: ${proof.projectId} (${proof.createdProject ? "created" : "existing"})`,
          proof.kind === "ok"
            ? `connection_id: ${proof.connectionId}`
            : `connection_error: ${proof.error}`,
          `sync: ${proof.kind === "ok" ? "linked" : "failed"}`,
        ].join("\n");

  return (
    <div className={cn("mx-5 mb-3 rounded-lg border px-3 py-2 text-[11.5px]", tone)}>
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 font-medium">
          <Icon className="h-3.5 w-3.5" /> {summary}
        </div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(text);
            toast("Copied proof to clipboard");
          }}
          className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground"
        >
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>
      <pre className="mt-1.5 font-mono text-[10.5px] text-muted-foreground whitespace-pre-wrap break-all">
        {text}
      </pre>
    </div>
  );
}

/* ---------- helpers ---------- */

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || `proj-${Date.now()}`
  );
}

function ms(a: string, b: string): string {
  try {
    return `${new Date(b).getTime() - new Date(a).getTime()}ms`;
  } catch {
    return "?";
  }
}
