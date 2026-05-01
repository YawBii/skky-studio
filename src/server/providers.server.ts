// Server-only provider clients. Reads workspace tokens from process.env.
// Never imported by client code. Returns plain JSON shapes — never tokens.

export type ProviderId = "github" | "vercel" | "supabase" | "build-runner";

export interface ProviderStatus {
  provider: ProviderId;
  configured: boolean;     // token / env present
  reachable: boolean | null; // result of a real API ping (null when not configured)
  account: string | null;
  error: string | null;
  missing: string[];       // env var names missing for this provider
  checkedAt: string;
}

// Rich diagnostic snapshot for the "Test" button on /integrations.
// Captures HTTP status, raw response body (truncated), normalized error,
// and timing. Tokens are NEVER included.
export interface ProviderDiagnostic {
  provider: ProviderId;
  status: "ok" | "warn" | "err" | "off";
  configured: boolean;
  reachable: boolean | null;
  account: string | null;
  checkedAt: string;
  durationMs: number;
  target: string | null;        // request URL (no secrets)
  httpStatus: number | null;    // HTTP response code if a request was made
  responseBody: string | null;  // truncated body for failures
  normalizedError: string | null;
  missing: string[];
}

const MAX_BODY = 2000;

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

function classify(s: ProviderStatus): ProviderDiagnostic["status"] {
  if (!s.configured) return "off";
  if (s.reachable === false) return "err";
  if (s.reachable === true) return "ok";
  return "warn";
}

async function readBodySafe(res: Response): Promise<string | null> {
  try {
    const txt = await res.text();
    return txt.length > MAX_BODY ? txt.slice(0, MAX_BODY) + `…(+${txt.length - MAX_BODY} bytes)` : txt;
  } catch { return null; }
}

export interface GithubRepoSummary {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  description: string | null;
  pushedAt: string | null;
  stars: number;
}

export interface VercelProjectSummary {
  id: string;
  name: string;
  framework: string | null;
  productionUrl: string | null;
  updatedAt: string | null;
  link: { type?: string; repo?: string | null } | null;
}

const HEADERS_GITHUB = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "yawb-integrations",
});

const HEADERS_VERCEL = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "User-Agent": "yawb-integrations",
});

export async function getGithubStatus(): Promise<ProviderStatus> {
  const token = process.env.GITHUB_TOKEN;
  const out: ProviderStatus = {
    provider: "github",
    configured: !!token,
    reachable: null,
    account: null,
    error: null,
    missing: token ? [] : ["GITHUB_TOKEN"],
    checkedAt: new Date().toISOString(),
  };
  if (!token) return out;
  try {
    const res = await fetch("https://api.github.com/user", { headers: HEADERS_GITHUB(token) });
    if (!res.ok) {
      out.reachable = false;
      out.error = `GitHub API ${res.status} ${res.statusText}`;
      return out;
    }
    const json = (await res.json()) as { login?: string };
    out.reachable = true;
    out.account = json.login ?? null;
  } catch (e) {
    out.reachable = false;
    out.error = e instanceof Error ? e.message : String(e);
  }
  return out;
}

export async function listGithubRepos(opts: { perPage?: number } = {}): Promise<{
  ok: boolean; repos: GithubRepoSummary[]; error?: string; missing?: string[];
}> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, repos: [], error: "GITHUB_TOKEN missing", missing: ["GITHUB_TOKEN"] };
  const per = Math.min(Math.max(opts.perPage ?? 50, 1), 100);
  try {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=${per}&sort=updated&affiliation=owner,collaborator,organization_member`,
      { headers: HEADERS_GITHUB(token) },
    );
    if (!res.ok) return { ok: false, repos: [], error: `GitHub API ${res.status} ${res.statusText}` };
    const arr = (await res.json()) as Array<Record<string, unknown>>;
    const repos: GithubRepoSummary[] = arr.map((r) => ({
      id: Number(r.id),
      fullName: String(r.full_name),
      name: String(r.name),
      owner: String((r.owner as Record<string, unknown> | undefined)?.login ?? ""),
      private: Boolean(r.private),
      defaultBranch: String(r.default_branch ?? "main"),
      htmlUrl: String(r.html_url ?? ""),
      description: (r.description as string | null) ?? null,
      pushedAt: (r.pushed_at as string | null) ?? null,
      stars: Number(r.stargazers_count ?? 0),
    }));
    return { ok: true, repos };
  } catch (e) {
    return { ok: false, repos: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getVercelStatus(): Promise<ProviderStatus> {
  const token = process.env.VERCEL_TOKEN;
  const out: ProviderStatus = {
    provider: "vercel",
    configured: !!token,
    reachable: null,
    account: null,
    error: null,
    missing: token ? [] : ["VERCEL_TOKEN"],
    checkedAt: new Date().toISOString(),
  };
  if (!token) return out;
  try {
    const res = await fetch("https://api.vercel.com/v2/user", { headers: HEADERS_VERCEL(token) });
    if (!res.ok) {
      out.reachable = false;
      out.error = `Vercel API ${res.status} ${res.statusText}`;
      return out;
    }
    const json = (await res.json()) as { user?: { username?: string; email?: string } };
    out.reachable = true;
    out.account = json.user?.username ?? json.user?.email ?? null;
  } catch (e) {
    out.reachable = false;
    out.error = e instanceof Error ? e.message : String(e);
  }
  return out;
}

export async function listVercelProjects(opts: { teamId?: string; limit?: number } = {}): Promise<{
  ok: boolean; projects: VercelProjectSummary[]; error?: string; missing?: string[];
}> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return { ok: false, projects: [], error: "VERCEL_TOKEN missing", missing: ["VERCEL_TOKEN"] };
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(Math.max(opts.limit ?? 50, 1), 100)));
  if (opts.teamId) params.set("teamId", opts.teamId);
  try {
    const res = await fetch(`https://api.vercel.com/v9/projects?${params.toString()}`, {
      headers: HEADERS_VERCEL(token),
    });
    if (!res.ok) return { ok: false, projects: [], error: `Vercel API ${res.status} ${res.statusText}` };
    const json = (await res.json()) as { projects?: Array<Record<string, unknown>> };
    const projects: VercelProjectSummary[] = (json.projects ?? []).map((p) => {
      const targets = p.targets as Record<string, { url?: string }> | undefined;
      const prodUrl = targets?.production?.url ? `https://${targets.production.url}` : null;
      const link = (p.link as { type?: string; repo?: string | null } | null) ?? null;
      return {
        id: String(p.id),
        name: String(p.name),
        framework: (p.framework as string | null) ?? null,
        productionUrl: prodUrl,
        updatedAt: p.updatedAt ? new Date(Number(p.updatedAt)).toISOString() : null,
        link,
      };
    });
    return { ok: true, projects };
  } catch (e) {
    return { ok: false, projects: [], error: e instanceof Error ? e.message : String(e) };
  }
}

function readSupabaseEnv(): { url: string | undefined; anon: string | undefined; service: string | undefined } {
  const env = process.env;
  const url =
    env.SUPABASE_URL ||
    env.EXTERNAL_SUPABASE_URL ||
    env.VITE_SUPABASE_URL;
  const anon =
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.EXTERNAL_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, anon, service };
}

export function getSupabaseStatus(): ProviderStatus {
  const { url, anon, service } = readSupabaseEnv();
  const missing: string[] = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!anon) missing.push("SUPABASE_PUBLISHABLE_KEY");
  // service is recommended but not required for "configured"
  return {
    provider: "supabase",
    configured: !!url && !!anon,
    reachable: null,
    account: url ? safeHost(url) : null,
    error: service ? null : "SUPABASE_SERVICE_ROLE_KEY not set (admin jobs disabled)",
    missing,
    checkedAt: new Date().toISOString(),
  };
}

export async function pingSupabase(): Promise<ProviderStatus> {
  const base = getSupabaseStatus();
  const { url, anon } = readSupabaseEnv();
  if (!url || !anon) return base;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    return { ...base, reachable: res.ok, error: res.ok ? base.error : `Supabase auth/health ${res.status}` };
  } catch (e) {
    return { ...base, reachable: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getBuildRunnerStatus(): Promise<ProviderStatus> {
  const url = process.env.YAWB_BUILD_RUNNER_URL || process.env.BUILD_RUNNER_URL;
  const token = process.env.YAWB_BUILD_RUNNER_TOKEN || process.env.BUILD_RUNNER_TOKEN;
  const missing: string[] = [];
  if (!url) missing.push("YAWB_BUILD_RUNNER_URL");
  const out: ProviderStatus = {
    provider: "build-runner",
    configured: !!url,
    reachable: null,
    account: url ? safeHost(url) : null,
    error: null,
    missing,
    checkedAt: new Date().toISOString(),
  };
  if (!url) return out;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/health`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    out.reachable = res.ok;
    if (!res.ok) out.error = `Build runner ${res.status} ${res.statusText}`;
  } catch (e) {
    out.reachable = false;
    out.error = e instanceof Error ? e.message : String(e);
  }
  return out;
}

function safeHost(u: string): string {
  try { return new URL(u).host; } catch { return "(invalid URL)"; }
}

// =============================================================================
// Per-provider diagnostic test (powers the "Test" button on /integrations).
// Captures: target URL, HTTP status, raw response body (truncated), timing,
// normalized error, and missing env. Never returns the token.
// =============================================================================

export async function runDiagnostic(provider: ProviderId): Promise<ProviderDiagnostic> {
  const checkedAt = new Date().toISOString();
  switch (provider) {
    case "github":   return runGithubDiagnostic(checkedAt);
    case "vercel":   return runVercelDiagnostic(checkedAt);
    case "supabase": return runSupabaseDiagnostic(checkedAt);
    case "build-runner": return runBuildRunnerDiagnostic(checkedAt);
  }
}

async function runGithubDiagnostic(checkedAt: string): Promise<ProviderDiagnostic> {
  const token = process.env.GITHUB_TOKEN;
  const target = "https://api.github.com/user";
  if (!token) {
    return {
      provider: "github", status: "off", configured: false, reachable: null,
      account: null, checkedAt, durationMs: 0, target, httpStatus: null,
      responseBody: null, normalizedError: "GITHUB_TOKEN not set",
      missing: ["GITHUB_TOKEN"],
    };
  }
  try {
    const { value: res, ms } = await timed(() => fetch(target, { headers: HEADERS_GITHUB(token) }));
    if (!res.ok) {
      const body = await readBodySafe(res);
      return {
        provider: "github", status: "err", configured: true, reachable: false,
        account: null, checkedAt, durationMs: ms, target, httpStatus: res.status,
        responseBody: body, normalizedError: `GitHub API ${res.status} ${res.statusText}`,
        missing: [],
      };
    }
    const json = (await res.json()) as { login?: string };
    return {
      provider: "github", status: "ok", configured: true, reachable: true,
      account: json.login ?? null, checkedAt, durationMs: ms, target,
      httpStatus: res.status, responseBody: null, normalizedError: null, missing: [],
    };
  } catch (e) {
    return {
      provider: "github", status: "err", configured: true, reachable: false,
      account: null, checkedAt, durationMs: 0, target, httpStatus: null,
      responseBody: null, normalizedError: e instanceof Error ? e.message : String(e),
      missing: [],
    };
  }
}

async function runVercelDiagnostic(checkedAt: string): Promise<ProviderDiagnostic> {
  const token = process.env.VERCEL_TOKEN;
  const target = "https://api.vercel.com/v2/user";
  if (!token) {
    return {
      provider: "vercel", status: "off", configured: false, reachable: null,
      account: null, checkedAt, durationMs: 0, target, httpStatus: null,
      responseBody: null, normalizedError: "VERCEL_TOKEN not set",
      missing: ["VERCEL_TOKEN"],
    };
  }
  try {
    const { value: res, ms } = await timed(() => fetch(target, { headers: HEADERS_VERCEL(token) }));
    if (!res.ok) {
      const body = await readBodySafe(res);
      return {
        provider: "vercel", status: "err", configured: true, reachable: false,
        account: null, checkedAt, durationMs: ms, target, httpStatus: res.status,
        responseBody: body, normalizedError: `Vercel API ${res.status} ${res.statusText}`,
        missing: [],
      };
    }
    const json = (await res.json()) as { user?: { username?: string; email?: string } };
    return {
      provider: "vercel", status: "ok", configured: true, reachable: true,
      account: json.user?.username ?? json.user?.email ?? null, checkedAt,
      durationMs: ms, target, httpStatus: res.status, responseBody: null,
      normalizedError: null, missing: [],
    };
  } catch (e) {
    return {
      provider: "vercel", status: "err", configured: true, reachable: false,
      account: null, checkedAt, durationMs: 0, target, httpStatus: null,
      responseBody: null, normalizedError: e instanceof Error ? e.message : String(e),
      missing: [],
    };
  }
}

async function runSupabaseDiagnostic(checkedAt: string): Promise<ProviderDiagnostic> {
  const env = process.env;
  const { url, anon, service } = readSupabaseEnv();
  const presentEnvVars = [
    env.SUPABASE_URL && "SUPABASE_URL",
    env.EXTERNAL_SUPABASE_URL && "EXTERNAL_SUPABASE_URL",
    env.VITE_SUPABASE_URL && "VITE_SUPABASE_URL",
    env.SUPABASE_PUBLISHABLE_KEY && "SUPABASE_PUBLISHABLE_KEY",
    env.EXTERNAL_SUPABASE_PUBLISHABLE_KEY && "EXTERNAL_SUPABASE_PUBLISHABLE_KEY",
    env.SUPABASE_ANON_KEY && "SUPABASE_ANON_KEY",
    env.VITE_SUPABASE_PUBLISHABLE_KEY && "VITE_SUPABASE_PUBLISHABLE_KEY",
    env.VITE_SUPABASE_ANON_KEY && "VITE_SUPABASE_ANON_KEY",
    env.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean) as string[];

  const missing: string[] = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!anon) missing.push("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anon) {
    return {
      provider: "supabase", status: "off", configured: false, reachable: null,
      account: null, checkedAt, durationMs: 0, target: url ?? null, httpStatus: null,
      responseBody: JSON.stringify({ presentEnvVars, missing }, null, 2),
      normalizedError: `Missing ${missing.join(", ")}`,
      missing,
    };
  }
  const target = `${url.replace(/\/$/, "")}/auth/v1/health`;
  try {
    const { value: res, ms } = await timed(() => fetch(target, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    }));
    if (!res.ok) {
      const body = await readBodySafe(res);
      return {
        provider: "supabase", status: "err", configured: true, reachable: false,
        account: safeHost(url), checkedAt, durationMs: ms, target,
        httpStatus: res.status, responseBody: body,
        normalizedError: `Supabase auth/health ${res.status}`, missing: [],
      };
    }
    const serviceWarn = service
      ? null
      : "SUPABASE_SERVICE_ROLE_KEY not set (admin jobs disabled)";

    // Non-secret proof summary: which endpoints were reachable + which env
    // vars are present. Never includes any secret values.
    const proofSummary = {
      host: safeHost(url),
      endpointsReachable: { "auth/v1/health": true },
      presentEnvVars,
      hasServiceRole: Boolean(service),
      checkedAt,
    };

    return {
      provider: "supabase", status: serviceWarn ? "warn" : "ok",
      configured: true, reachable: true, account: safeHost(url), checkedAt,
      durationMs: ms, target, httpStatus: res.status,
      responseBody: JSON.stringify(proofSummary, null, 2),
      normalizedError: serviceWarn, missing: [],
    };
  } catch (e) {
    return {
      provider: "supabase", status: "err", configured: true, reachable: false,
      account: safeHost(url), checkedAt, durationMs: 0, target, httpStatus: null,
      responseBody: JSON.stringify({ presentEnvVars }, null, 2),
      normalizedError: e instanceof Error ? e.message : String(e),
      missing: [],
    };
  }
}

async function runBuildRunnerDiagnostic(checkedAt: string): Promise<ProviderDiagnostic> {
  const url = process.env.YAWB_BUILD_RUNNER_URL || process.env.BUILD_RUNNER_URL;
  const token = process.env.YAWB_BUILD_RUNNER_TOKEN || process.env.BUILD_RUNNER_TOKEN;
  if (!url) {
    return {
      provider: "build-runner", status: "off", configured: false, reachable: null,
      account: null, checkedAt, durationMs: 0, target: null, httpStatus: null,
      responseBody: null, normalizedError: "YAWB_BUILD_RUNNER_URL (or BUILD_RUNNER_URL) not set",
      missing: ["YAWB_BUILD_RUNNER_URL"],
    };
  }
  const target = `${url.replace(/\/$/, "")}/health`;
  try {
    const { value: res, ms } = await timed(() => fetch(target, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }));
    if (!res.ok) {
      const body = await readBodySafe(res);
      return {
        provider: "build-runner", status: "err", configured: true, reachable: false,
        account: safeHost(url), checkedAt, durationMs: ms, target,
        httpStatus: res.status, responseBody: body,
        normalizedError: `Build runner ${res.status} ${res.statusText}`, missing: [],
      };
    }
    return {
      provider: "build-runner", status: "ok", configured: true, reachable: true,
      account: safeHost(url), checkedAt, durationMs: ms, target,
      httpStatus: res.status, responseBody: null, normalizedError: null,
      missing: [],
    };
  } catch (e) {
    return {
      provider: "build-runner", status: "err", configured: true, reachable: false,
      account: safeHost(url), checkedAt, durationMs: 0, target, httpStatus: null,
      responseBody: null, normalizedError: e instanceof Error ? e.message : String(e),
      missing: [],
    };
  }
}

export { classify };
