import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GITHUB_TOKEN = Deno.env.get("YAWB_GITHUB_TOKEN") || Deno.env.get("GITHUB_TOKEN");
const GITHUB_API = "https://api.github.com";

function ghHeaders() {
  if (!GITHUB_TOKEN) throw new Error("Missing YAWB_GITHUB_TOKEN or GITHUB_TOKEN secret");
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "yawB-repository-sync",
  };
}

async function githubJson(url: string) {
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status} for ${url}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

async function listAllRepos() {
  const repos: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${GITHUB_API}/user/repos?per_page=100&page=${page}&affiliation=owner,collaborator,organization_member&sort=updated&direction=desc`;
    const chunk = await githubJson(url);
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    repos.push(...chunk);
    if (chunk.length < 100) break;
  }
  return repos;
}

function toRepoRow(repo: any) {
  return {
    github_id: repo.id,
    owner_login: repo.owner?.login,
    full_name: repo.full_name,
    name: repo.name,
    description: repo.description,
    html_url: repo.html_url,
    clone_url: repo.clone_url,
    ssh_url: repo.ssh_url,
    default_branch: repo.default_branch,
    visibility: repo.visibility || (repo.private ? "private" : "public"),
    private: Boolean(repo.private),
    fork: Boolean(repo.fork),
    archived: Boolean(repo.archived),
    disabled: Boolean(repo.disabled),
    language: repo.language,
    homepage: repo.homepage,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    size_kb: repo.size,
    stargazers_count: repo.stargazers_count || 0,
    forks_count: repo.forks_count || 0,
    open_issues_count: repo.open_issues_count || 0,
    license_key: repo.license?.key || null,
    license_name: repo.license?.name || null,
    pushed_at: repo.pushed_at,
    github_created_at: repo.created_at,
    github_updated_at: repo.updated_at,
    permissions: repo.permissions || {},
    raw: repo,
    synced_at: new Date().toISOString(),
  };
}

function toAccountRow(owner: any) {
  return {
    github_id: owner?.id,
    login: owner?.login,
    account_type: owner?.type || "User",
    avatar_url: owner?.avatar_url,
    html_url: owner?.html_url || (owner?.login ? `https://github.com/${owner.login}` : null),
    synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let syncRunId: string | null = null;

  try {
    const { data: run, error: runError } = await supabase
      .from("github_repository_sync_runs")
      .insert({ status: "running", metadata: { source: "sync-github-repositories" } })
      .select("id")
      .single();
    if (runError) throw runError;
    syncRunId = run.id;

    const repos = await listAllRepos();
    const accountMap = new Map<string, any>();
    for (const repo of repos) {
      if (repo.owner?.login) accountMap.set(repo.owner.login, toAccountRow(repo.owner));
    }

    const accounts = Array.from(accountMap.values()).filter((a) => a.login && a.github_id);
    if (accounts.length) {
      const { error } = await supabase
        .from("github_accounts")
        .upsert(accounts, { onConflict: "github_id" });
      if (error) throw error;
    }

    const rows = repos.map(toRepoRow).filter((row) => row.github_id && row.full_name);
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase
        .from("github_repositories")
        .upsert(batch, { onConflict: "github_id" });
      if (error) throw error;
      upserted += batch.length;
    }

    await supabase
      .from("github_repository_sync_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        fetched_count: repos.length,
        upserted_count: upserted,
        metadata: {
          accounts: accounts.length,
          private: rows.filter((r) => r.private).length,
          public: rows.filter((r) => !r.private).length,
        },
      })
      .eq("id", syncRunId);

    return new Response(JSON.stringify({
      ok: true,
      fetched: repos.length,
      upserted,
      accounts: accounts.length,
      private: rows.filter((r) => r.private).length,
      public: rows.filter((r) => !r.private).length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    if (syncRunId) {
      await supabase
        .from("github_repository_sync_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), error: String(error?.message || error) })
        .eq("id", syncRunId);
    }

    return new Response(JSON.stringify({ ok: false, error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
