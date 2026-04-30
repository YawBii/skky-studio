// Provider adapter interfaces. Phase 1 ships placeholder implementations that
// fail cleanly when the relevant project_connections row (or, for Supabase
// admin, server-side credentials) is missing. Real provider calls land in
// Phase 2 via server-side workers — the browser must never receive provider
// tokens or service-role keys.
import { supabase } from "@/integrations/supabase/client";

export type AdapterResult<T = unknown> =
  | { ok: true; data: T; log?: string }
  | { ok: false; error: string; needsConnection?: "github" | "vercel" | "supabase" };

async function requireConnection(projectId: string, provider: "github" | "vercel" | "supabase"): Promise<AdapterResult<{ status: string }>> {
  const { data, error } = await supabase
    .from("project_connections")
    .select("status")
    .eq("project_id", projectId)
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) {
    const labels = { github: "GitHub", vercel: "Vercel", supabase: "Supabase" } as const;
    return { ok: false, error: `${labels[provider]} is not connected for this project.`, needsConnection: provider };
  }
  if (data.status !== "connected") {
    const labels = { github: "GitHub", vercel: "Vercel", supabase: "Supabase" } as const;
    return { ok: false, error: `${labels[provider]} connection is "${data.status}", expected "connected".`, needsConnection: provider };
  }
  return { ok: true, data: { status: data.status } };
}

// ---------- GitHub ----------
export interface GitHubProvider {
  verify(projectId: string): Promise<AdapterResult<{ status: string }>>;
  createRepo(projectId: string, input: { name: string; private?: boolean }): Promise<AdapterResult<{ repoFullName: string }>>;
  createBranch(projectId: string, input: { branch: string; from?: string }): Promise<AdapterResult<{ branch: string }>>;
  commitChanges(projectId: string, input: { branch: string; message: string }): Promise<AdapterResult<{ sha: string }>>;
  openPR(projectId: string, input: { branch: string; base?: string; title: string; body?: string }): Promise<AdapterResult<{ url: string }>>;
}

function notWired(provider: "github" | "vercel", op: string): AdapterResult<never> {
  return {
    ok: false,
    error: `${provider}.${op}: connection verified, but the server-side worker is not wired in this build (Phase 2).`,
  };
}

async function gateThen<T>(projectId: string, provider: "github" | "vercel", op: string): Promise<AdapterResult<T>> {
  const gate = await requireConnection(projectId, provider);
  if (!gate.ok) return gate as AdapterResult<T>;
  return notWired(provider, op) as AdapterResult<T>;
}

export const placeholderGitHub: GitHubProvider = {
  verify: (projectId) => requireConnection(projectId, "github"),
  createRepo: (projectId) => gateThen(projectId, "github", "createRepo"),
  createBranch: (projectId) => gateThen(projectId, "github", "createBranch"),
  commitChanges: (projectId) => gateThen(projectId, "github", "commitChanges"),
  openPR: (projectId) => gateThen(projectId, "github", "openPR"),
};

// ---------- Vercel ----------
export interface VercelProvider {
  verify(projectId: string): Promise<AdapterResult<{ status: string }>>;
  linkProject(projectId: string, input: { vercelProjectId: string }): Promise<AdapterResult<{ vercelProjectId: string }>>;
  setEnv(projectId: string, input: { vars: Record<string, string> }): Promise<AdapterResult<{ count: number }>>;
  createPreviewDeploy(projectId: string, input: { ref?: string }): Promise<AdapterResult<{ url: string }>>;
  promoteProduction(projectId: string, input: { deploymentId: string }): Promise<AdapterResult<{ url: string }>>;
}

const notWiredVercel = (op: string): AdapterResult => ({
  ok: false,
  error: `vercel.${op}: connection verified, but the server-side worker is not wired in this build (Phase 2).`,
});

export const placeholderVercel: VercelProvider = {
  verify: (projectId) => requireConnection(projectId, "vercel"),
  linkProject: async (projectId) => (await requireConnection(projectId, "vercel")).ok ? notWiredVercel("linkProject") as AdapterResult<never> : await requireConnection(projectId, "vercel") as AdapterResult<never>,
  setEnv: async (projectId) => (await requireConnection(projectId, "vercel")).ok ? notWiredVercel("setEnv") as AdapterResult<never> : await requireConnection(projectId, "vercel") as AdapterResult<never>,
  createPreviewDeploy: async (projectId) => (await requireConnection(projectId, "vercel")).ok ? notWiredVercel("createPreviewDeploy") as AdapterResult<never> : await requireConnection(projectId, "vercel") as AdapterResult<never>,
  promoteProduction: async (projectId) => (await requireConnection(projectId, "vercel")).ok ? notWiredVercel("promoteProduction") as AdapterResult<never> : await requireConnection(projectId, "vercel") as AdapterResult<never>,
};

// ---------- Supabase admin ----------
// "supabase" connection here is the user-side project link, but admin mutations
// (apply_migration, verify_rls) need a service-role key that browsers must NEVER hold.
export interface SupabaseProvider {
  verify(projectId: string): Promise<AdapterResult<{ status: string }>>;
  applyMigration(projectId: string, input: { sql: string; name?: string }): Promise<AdapterResult<{ applied: boolean }>>;
  verifyRLS(projectId: string, input: { table: string }): Promise<AdapterResult<{ ok: boolean }>>;
}

export const placeholderSupabase: SupabaseProvider = {
  verify: (projectId) => requireConnection(projectId, "supabase"),
  applyMigration: async () => ({
    ok: false,
    error: "Supabase admin access is not configured. service_role key must live on the server; the browser will never hold it.",
    needsConnection: "supabase",
  }),
  verifyRLS: async () => ({
    ok: false,
    error: "Supabase admin access is not configured. service_role key must live on the server; the browser will never hold it.",
    needsConnection: "supabase",
  }),
};

// ---------- Build ----------
export interface BuildProvider {
  typecheck(projectId: string): Promise<AdapterResult<{ output: string }>>;
  productionBuild(projectId: string): Promise<AdapterResult<{ output: string }>>;
}

export const placeholderBuild: BuildProvider = {
  typecheck: async () => ({ ok: false, error: "build.typecheck requires a server-side build runner. Not wired in this build." }),
  productionBuild: async () => ({ ok: false, error: "build.production requires a server-side build runner. Not wired in this build." }),
};

// ---------- AI ----------
export interface AIProvider {
  plan(projectId: string, input: { goal: string }): Promise<AdapterResult<{ plan: string }>>;
  generateChanges(projectId: string, input: { goal: string }): Promise<AdapterResult<{ changes: unknown }>>;
  repairFailure(projectId: string, input: { jobId: string; error: string }): Promise<AdapterResult<{ suggestion: string }>>;
}

export const placeholderAI: AIProvider = {
  plan: async () => ({ ok: false, error: "ai.plan requires the AI gateway worker. Not wired in this build." }),
  generateChanges: async () => ({ ok: false, error: "ai.generate_changes requires the AI gateway worker. Not wired in this build." }),
  repairFailure: async () => ({ ok: false, error: "ai.repair_failure requires the AI gateway worker. Not wired in this build." }),
};

// Single registry the runner consumes. Swap to real implementations once
// Phase 2 server workers exist.
export const providers = {
  github: placeholderGitHub,
  vercel: placeholderVercel,
  supabase: placeholderSupabase,
  build: placeholderBuild,
  ai: placeholderAI,
};
export type Providers = typeof providers;
