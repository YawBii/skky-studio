import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { History, RotateCcw, GitCommit, Github, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useProjectConnections } from "@/hooks/use-project-connections";
import { ProjectScopedEmpty } from "@/components/project-empty";
import { supabase } from "@/integrations/supabase/client";
import { listJobs, enqueueJob, type Job } from "@/services/jobs";
import { DESIGN_ANGLES, type DesignAngle } from "@/components/preview-pane";

export const Route = createFileRoute("/versions/$projectId")({
  head: ({ params }) => ({ meta: [{ title: `Version history — ${params.projectId} | yawB` }] }),
  component: VersionsPage,
});

interface ProjectMeta {
  id: string;
  name: string;
  workspaceId: string;
}

function VersionsPage() {
  const { projectId } = Route.useParams();
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { connections, loading: loadingConn } = useProjectConnections(projectId);

  useEffect(() => {
    void supabase
      .from("projects")
      .select("id, name, workspace_id")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProject({ id: data.id, name: data.name, workspaceId: data.workspace_id });
      });
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingJobs(true);
    void listJobs(projectId).then((r) => {
      if (cancelled) return;
      setJobs(r.jobs);
      setLoadingJobs(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const githubConn = useMemo(() => connections.find((c) => c.provider === "github"), [connections]);

  // Generation versions = succeeded ai.generate_changes jobs, newest first.
  const versions = useMemo(
    () =>
      jobs
        .filter((j) => j.type === "ai.generate_changes" && j.status === "succeeded")
        .sort((a, b) => (b.finishedAt ?? b.createdAt).localeCompare(a.finishedAt ?? a.createdAt)),
    [jobs],
  );

  async function handleRestore(version: Job) {
    if (!project) return;
    const designMode = (version.input?.designMode as DesignAngle | undefined) ?? "minimal-light";
    const angleLabel = DESIGN_ANGLES.find((a) => a.id === designMode)?.label ?? designMode;
    setRestoringId(version.id);
    try {
      const r = await enqueueJob({
        projectId: project.id,
        workspaceId: project.workspaceId,
        type: "ai.generate_changes",
        title: `Restore version — ${angleLabel}`,
        input: { designMode, regenerationSeed: version.id, restoredFromJobId: version.id },
      });
      if (r.ok) {
        toast.success(`Restoring ${angleLabel}…`);
        // Refresh local jobs list so the new one shows up at the top.
        const next = await listJobs(projectId);
        setJobs(next.jobs);
      } else {
        toast.error(`Restore failed: ${r.error}`);
      }
    } finally {
      setRestoringId(null);
    }
  }

  if (loadingJobs || loadingConn) {
    return <div className="p-10 text-sm text-muted-foreground">Loading version history…</div>;
  }

  if (versions.length === 0 && !githubConn) {
    return (
      <ProjectScopedEmpty
        icon={History}
        eyebrow={project?.name ?? projectId}
        title="No versions yet"
        hint="Each generated design becomes a restorable version. Generate the first design to start a version history, or connect GitHub for full commit history."
        cta={{ label: "Open builder", to: "/builder/$projectId", params: { projectId } }}
      />
    );
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1000px] mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <History className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Version history
        </span>
      </div>
      <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-1">
        {project?.name ?? projectId}
      </h1>
      <p className="text-muted-foreground mb-6">
        {versions.length} generated {versions.length === 1 ? "version" : "versions"} — restore any
        one to overwrite the current preview.
      </p>

      {githubConn && (
        <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center gap-3">
          <Github className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Linked repository
            </div>
            <div className="text-sm font-mono truncate">
              {githubConn.repoFullName ?? githubConn.repoUrl ?? "GitHub"}
            </div>
          </div>
          {githubConn.repoUrl && (
            <Button asChild variant="ghost" size="sm">
              <a href={githubConn.repoUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </a>
            </Button>
          )}
        </div>
      )}

      {versions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          <GitCommit className="h-6 w-6 mx-auto text-muted-foreground/60" />
          <div className="mt-2">No generated versions yet.</div>
          <Button asChild variant="ghost" size="sm" className="mt-4">
            <Link to="/builder/$projectId" params={{ projectId }}>
              Open builder
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {versions.map((v, idx) => {
            const designMode = (v.input?.designMode as string | undefined) ?? "—";
            const angleLabel = DESIGN_ANGLES.find((a) => a.id === designMode)?.label ?? designMode;
            const when = v.finishedAt ?? v.createdAt;
            return (
              <li
                key={v.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition p-4 flex items-center gap-4"
                data-testid="version-row"
              >
                <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{v.title || "Generate design"}</span>
                    {idx === 0 && (
                      <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-400 border border-emerald-400/40 rounded-full px-1.5 py-0.5">
                        Current
                      </span>
                    )}
                    <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground border border-white/10 rounded-full px-1.5 py-0.5">
                      {angleLabel}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-1">
                    {new Date(when).toLocaleString()} · job {v.id.slice(0, 8)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={restoringId !== null || idx === 0}
                  onClick={() => void handleRestore(v)}
                  data-testid={`version-restore-${v.id}`}
                  title={
                    idx === 0
                      ? "This is the current version"
                      : "Re-run this design as a new version"
                  }
                >
                  {restoringId === v.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  {idx === 0 ? "Current" : "Restore"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
