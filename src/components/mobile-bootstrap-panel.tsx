// Inline, always-visible bootstrap diagnostics for mobile. Shown directly in
// empty states ("Create a workspace", "No projects yet", "Project not found")
// so the user can immediately see *why* nothing loaded — without digging into
// the floating Diagnostics panel.
import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSupabaseDiagnostics } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDiagnostics } from "@/lib/diagnostics";

export interface MobileBootstrapPanelProps {
  membershipsCount?: number | null;
  selectedWorkspaceId?: string | null;
  workspaceSource?: string | null;
  workspacesCount?: number | null;
  projectsCount?: number | null;
  projectsSource?: string | null;
  activeProjectId?: string | null;
  urlProjectId?: string | null;
  workspaceMembersError?: string | null;
  projectsQueryError?: string | null;
  lastError?: string | null;
}

export function MobileBootstrapPanel(props: MobileBootstrapPanelProps) {
  const { session, loading: authLoading } = useAuth();
  const { state } = useDiagnostics();
  const env = getSupabaseDiagnostics();
  const [email, setEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Resolve user email lazily (auth provider only stores userId).
  useEffect(() => {
    let cancelled = false;
    if (!session?.userId) {
      setEmail(null);
      return;
    }
    void supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error) return;
      setEmail(data.user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.userId]);

  const workspacesCount =
    props.workspacesCount ?? props.membershipsCount ?? state.workspacesCount ?? null;
  const workspaceId = props.selectedWorkspaceId ?? state.workspaceId ?? null;
  const projects = props.projectsCount ?? state.projectsCount ?? null;
  const projectId = props.activeProjectId ?? state.projectId ?? null;
  const workspaceSource = props.workspaceSource ?? state.workspaceSource ?? "—";
  const projectsSource = props.projectsSource ?? state.projectsSource ?? "—";
  const workspaceMembersError =
    props.workspaceMembersError ?? extractMessage(state.workspaceMembersError) ?? null;
  const projectsQueryError =
    props.projectsQueryError ?? extractMessage(state.projectsQueryError) ?? null;
  const supabaseProjectRef = env.urlHost ? env.urlHost.split(".")[0] : "—";

  // Pick the most relevant Supabase error (workspace + project paths).
  const lastError =
    props.lastError ??
    workspaceMembersError ??
    projectsQueryError ??
    extractMessage(state.workspaceSelectError) ??
    extractMessage(state.workspaceInsertError) ??
    extractMessage(state.projectSelectError) ??
    extractMessage(state.projectInsertError) ??
    state.lastError ??
    null;

  const rows: Array<[string, string]> = [
    ["authLoading", String(authLoading)],
    ["hasSession", String(!!session)],
    ["userId", session?.userId ?? "—"],
    ["userEmail", session?.email ?? email ?? "—"],
    ["selectedWorkspaceId", workspaceId ?? "—"],
    ["workspaceSource", workspaceSource],
    ["workspacesCount", workspacesCount == null ? "—" : String(workspacesCount)],
    ["projectsCount", projects == null ? "—" : String(projects)],
    ["projectsSource", projectsSource],
    ["activeProjectId", projectId ?? "—"],
    ["routeProjectId", props.urlProjectId ?? "—"],
    ["supabaseUrlProjectRef", env.urlHost ? `${env.urlHost} / ${supabaseProjectRef}` : "—"],
    ["latestWorkspaceMembersError", workspaceMembersError ?? "—"],
    ["latestProjectsQueryError", projectsQueryError ?? "—"],
    ["lastSupabaseError", lastError ?? "—"],
  ];

  const stateMessage = getBootstrapStateMessage({
    authLoading,
    hasSession: !!session,
    workspacesCount,
    workspaceId,
    projects,
  });

  async function copyAll() {
    const text =
      "yawB mobile bootstrap diagnostics\n" + rows.map(([k, v]) => `${k}: ${v}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div
      data-testid="mobile-bootstrap-panel"
      className="mt-4 rounded-xl border border-white/10 bg-background/60 backdrop-blur p-3 text-[11.5px] font-mono"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-sans">
          Bootstrap diagnostics
        </div>
        <button
          type="button"
          onClick={copyAll}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10.5px] hover:bg-white/5 font-sans"
          aria-label="Copy bootstrap diagnostics"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {stateMessage && (
        <div className="mb-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 font-sans">
          <div
            className="text-[12px] font-medium text-foreground"
            data-testid="mobile-bootstrap-state-title"
          >
            {stateMessage.title}
          </div>
          <div
            className="mt-0.5 text-[11px] text-muted-foreground break-words"
            data-testid="mobile-bootstrap-state-detail"
          >
            {stateMessage.detail}
          </div>
          {stateMessage.signIn && (
            <a
              href="/login"
              className="mt-2 inline-flex min-h-9 items-center rounded-md border border-white/10 px-3 text-[12px] text-foreground hover:bg-white/[0.05]"
              data-testid="mobile-bootstrap-sign-in"
            >
              Sign in
            </a>
          )}
        </div>
      )}
      <div className="grid grid-cols-[140px_1fr] gap-x-2 gap-y-0.5 leading-relaxed">
        {rows.map(([k, v]) => {
          const isError =
            (k === "lastSupabaseError" ||
              k === "latestWorkspaceMembersError" ||
              k === "latestProjectsQueryError") &&
            v !== "—";
          const isFalseSession = k === "hasSession" && v === "false";
          return (
            <Row
              key={k}
              k={k}
              v={v}
              tone={isError || isFalseSession ? "error" : "default"}
              testId={`mbp-${k}`}
            />
          );
        })}
      </div>
      <p className="mt-2 text-[10.5px] text-muted-foreground font-sans">
        Visible inline so you can see what mobile resolved without opening Diagnostics.
      </p>
    </div>
  );
}

function Row({
  k,
  v,
  tone,
  testId,
}: {
  k: string;
  v: string;
  tone: "default" | "error";
  testId: string;
}) {
  return (
    <>
      <div className="text-muted-foreground" data-testid={`${testId}-key`}>
        {k}
      </div>
      <div
        data-testid={`${testId}-value`}
        className={tone === "error" ? "text-destructive break-all" : "text-foreground break-all"}
      >
        {v}
      </div>
    </>
  );
}

function getBootstrapStateMessage({
  authLoading,
  hasSession,
  workspacesCount,
  workspaceId,
  projects,
}: {
  authLoading: boolean;
  hasSession: boolean;
  workspacesCount: number | null;
  workspaceId: string | null;
  projects: number | null;
}): { title: string; detail: string; signIn?: boolean } | null {
  if (authLoading)
    return { title: "Checking session…", detail: "Waiting for mobile auth storage to restore." };
  if (!hasSession)
    return {
      title: "Not signed in on this device",
      detail: "Mobile has no restored auth session, so workspace/project queries are blocked.",
      signIn: true,
    };
  if (workspacesCount === 0)
    return {
      title: "No workspace membership found for this account",
      detail: "workspace_members returned 0 rows for the shown userEmail/userId.",
    };
  if (workspaceId && projects === 0)
    return {
      title: "Workspace found but no projects returned",
      detail: `projects returned 0 rows for workspaceId ${workspaceId}.`,
    };
  return null;
}

function extractMessage(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "message" in v) {
    const m = (v as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return null;
}
