// project_connections service — reads from public.project_connections.
// If the table is missing we surface that to the caller so the UI can show
// a clear "run the SQL" notice instead of pretending connections exist.
import { supabase } from "@/integrations/supabase/client";

export type ConnectionProvider = "github" | "gitlab" | "bitbucket" | "vercel" | "netlify";
export type ConnectionStatus = "pending" | "connected" | "error" | "disconnected";

export interface ProjectConnection {
  id: string;
  projectId: string;
  provider: ConnectionProvider;
  status: ConnectionStatus;
  repoFullName: string | null;
  repoUrl: string | null;
  defaultBranch: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // additive (2026-05-01)
  workspaceId: string | null;
  externalId: string | null;
  url: string | null;
  tokenOwnerType: "workspace" | "user" | null;
  providerAccountId: string | null;
}

export type ConnectionsSource = "supabase" | "empty" | "table-missing" | "error" | "no-project";

export interface ConnectionsResult {
  connections: ProjectConnection[];
  source: ConnectionsSource;
  error?: string;
  sqlFile?: string;
}

const SQL_FILE = "docs/sql/2026-04-30-project-connections.sql";

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

function rowToConnection(r: Record<string, unknown>): ProjectConnection {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    provider: r.provider as ConnectionProvider,
    status: r.status as ConnectionStatus,
    repoFullName: (r.repo_full_name as string | null) ?? null,
    repoUrl: (r.repo_url as string | null) ?? null,
    defaultBranch: (r.default_branch as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdBy: String(r.created_by),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    workspaceId: (r.workspace_id as string | null) ?? null,
    externalId: (r.external_id as string | null) ?? null,
    url: (r.url as string | null) ?? null,
    tokenOwnerType: (r.token_owner_type as "workspace" | "user" | null) ?? null,
    providerAccountId: (r.provider_account_id as string | null) ?? null,
  };
}

export async function listConnections(projectId: string | null | undefined): Promise<ConnectionsResult> {
  if (!projectId) return { connections: [], source: "no-project" };
  try {
    const { data, error } = await supabase
      .from("project_connections")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingTable(error)) {
        return { connections: [], source: "table-missing", error: error.message, sqlFile: SQL_FILE };
      }
      return { connections: [], source: "error", error: error.message };
    }
    if (!data || data.length === 0) return { connections: [], source: "empty" };
    return { connections: data.map(rowToConnection), source: "supabase" };
  } catch (e) {
    return { connections: [], source: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

export type CreateConnectionResult =
  | { ok: true; connection: ProjectConnection }
  | { ok: false; error: string; code?: string; tableMissing?: boolean; sqlFile?: string };

export async function createConnection(input: {
  projectId: string;
  provider: ConnectionProvider;
  status?: ConnectionStatus;
  repoFullName?: string | null;
  repoUrl?: string | null;
  defaultBranch?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<CreateConnectionResult> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { ok: false, error: "Not signed in", code: "NO_SESSION" };

    const payload = {
      project_id: input.projectId,
      provider: input.provider,
      status: input.status ?? "pending",
      repo_full_name: input.repoFullName ?? null,
      repo_url: input.repoUrl ?? null,
      default_branch: input.defaultBranch ?? null,
      metadata: input.metadata ?? {},
      created_by: u.user.id,
    };

    const { data, error } = await supabase
      .from("project_connections")
      .insert(payload)
      .select("*")
      .maybeSingle();

    if (error) {
      if (isMissingTable(error)) {
        return { ok: false, error: error.message, code: error.code, tableMissing: true, sqlFile: SQL_FILE };
      }
      return { ok: false, error: error.message, code: error.code };
    }
    if (!data) return { ok: false, error: "Insert returned no row", code: "NO_ROW" };
    return { ok: true, connection: rowToConnection(data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteConnection(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("project_connections").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export const PROJECT_CONNECTIONS_SQL_FILE = SQL_FILE;
