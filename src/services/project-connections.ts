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

export async function listConnections(
  projectId: string | null | undefined,
): Promise<ConnectionsResult> {
  if (!projectId) return { connections: [], source: "no-project" };
  try {
    const { data, error } = await supabase
      .from("project_connections")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingTable(error)) {
        return {
          connections: [],
          source: "table-missing",
          error: error.message,
          sqlFile: SQL_FILE,
        };
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
  workspaceId?: string | null;
  externalId?: string | null;
  url?: string | null;
  tokenOwnerType?: "workspace" | "user";
}): Promise<CreateConnectionResult> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { ok: false, error: "Not signed in", code: "NO_SESSION" };

    const payload: Record<string, unknown> = {
      project_id: input.projectId,
      provider: input.provider,
      status: input.status ?? "pending",
      repo_full_name: input.repoFullName ?? null,
      repo_url: input.repoUrl ?? null,
      default_branch: input.defaultBranch ?? null,
      metadata: input.metadata ?? {},
      created_by: u.user.id,
    };
    if (input.workspaceId !== undefined) payload.workspace_id = input.workspaceId;
    if (input.externalId !== undefined) payload.external_id = input.externalId;
    if (input.url !== undefined) payload.url = input.url;
    if (input.tokenOwnerType !== undefined) payload.token_owner_type = input.tokenOwnerType;

    const { data, error } = await supabase
      .from("project_connections")
      .insert(payload)
      .select("*")
      .maybeSingle();

    if (error) {
      if (isMissingTable(error)) {
        return {
          ok: false,
          error: error.message,
          code: error.code,
          tableMissing: true,
          sqlFile: SQL_FILE,
        };
      }
      return { ok: false, error: error.message, code: error.code };
    }
    if (!data) return { ok: false, error: "Insert returned no row", code: "NO_ROW" };
    return { ok: true, connection: rowToConnection(data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Find an existing connection by (provider, external_id).
// Optional workspace scoping is important for imports: without it, importing a
// repo in one workspace can unexpectedly open an older project from another
// workspace (the GoodHand-style stale-project bug).
export async function findConnectionByExternalId(
  provider: ConnectionProvider,
  externalId: string,
  workspaceId?: string | null,
): Promise<{ ok: true; connection: ProjectConnection | null } | { ok: false; error: string }> {
  try {
    let query = supabase
      .from("project_connections")
      .select("*")
      .eq("provider", provider)
      .eq("external_id", externalId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (workspaceId) query = query.eq("workspace_id", workspaceId);

    const { data, error } = await query.maybeSingle();
    if (error) {
      if (isMissingTable(error)) return { ok: false, error: error.message };
      return { ok: false, error: error.message };
    }
    return { ok: true, connection: data ? rowToConnection(data) : null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Upsert a connection for a (project_id, provider, external_id) tuple.
// Updates status / url / metadata if a row already exists for this project.
export async function upsertConnection(input: {
  projectId: string;
  provider: ConnectionProvider;
  externalId: string;
  status: ConnectionStatus;
  url?: string | null;
  repoFullName?: string | null;
  repoUrl?: string | null;
  defaultBranch?: string | null;
  workspaceId?: string | null;
  metadata?: Record<string, unknown>;
  tokenOwnerType?: "workspace" | "user";
}): Promise<CreateConnectionResult> {
  try {
    const { data: existing, error: selErr } = await supabase
      .from("project_connections")
      .select("*")
      .eq("project_id", input.projectId)
      .eq("provider", input.provider)
      .eq("external_id", input.externalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (selErr && !isMissingTable(selErr)) {
      return { ok: false, error: selErr.message, code: selErr.code };
    }
    if (existing) {
      const patch: Record<string, unknown> = {
        status: input.status,
        url: input.url ?? null,
        repo_full_name: input.repoFullName ?? existing.repo_full_name,
        repo_url: input.repoUrl ?? existing.repo_url,
        default_branch: input.defaultBranch ?? existing.default_branch,
        metadata: {
          ...((existing.metadata as Record<string, unknown>) ?? {}),
          ...(input.metadata ?? {}),
        },
        updated_at: new Date().toISOString(),
      };
      if (input.workspaceId !== undefined) patch.workspace_id = input.workspaceId;
      if (input.tokenOwnerType !== undefined) patch.token_owner_type = input.tokenOwnerType;
      const { data, error } = await supabase
        .from("project_connections")
        .update(patch)
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();
      if (error) return { ok: false, error: error.message, code: error.code };
      if (!data) return { ok: false, error: "Update returned no row", code: "NO_ROW" };
      return { ok: true, connection: rowToConnection(data) };
    }
    return createConnection({
      projectId: input.projectId,
      provider: input.provider,
      status: input.status,
      repoFullName: input.repoFullName,
      repoUrl: input.repoUrl,
      defaultBranch: input.defaultBranch,
      metadata: input.metadata,
      workspaceId: input.workspaceId,
      externalId: input.externalId,
      url: input.url,
      tokenOwnerType: input.tokenOwnerType,
    });
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
