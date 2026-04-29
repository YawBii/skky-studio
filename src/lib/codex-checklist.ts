// Codex wiring checklist — single source of truth for what is still demo data
// vs what has been wired to real APIs. Update the `status` field as services
// are wired. The /codex route renders this.

export type WiringStatus = "todo" | "in-progress" | "ready" | "wired";

export interface ServiceFn {
  name: string;
  signature: string;
  status: WiringStatus;
  notes?: string;
}

export interface ServiceWiring {
  id: string;
  service: string;
  file: string;
  provider: string;
  envVars: string[];
  docs: string;
  functions: ServiceFn[];
}

export const codexChecklist: ServiceWiring[] = [
  {
    id: "github",
    service: "GitHub",
    file: "src/services/github.ts",
    provider: "@octokit/rest",
    envVars: ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GITHUB_WEBHOOK_SECRET"],
    docs: "https://docs.github.com/en/rest",
    functions: [
      { name: "listRepos", signature: "(orgId: string) => Promise<Repo[]>", status: "todo" },
      { name: "getRepo", signature: "(owner: string, repo: string) => Promise<Repo>", status: "todo" },
      { name: "createBranch", signature: "(repo: string, from: string, name: string) => Promise<Branch>", status: "todo" },
      { name: "openPullRequest", signature: "(repo: string, head: string, base: string, body: PRBody) => Promise<PR>", status: "todo" },
    ],
  },
  {
    id: "vercel",
    service: "Vercel",
    file: "src/services/vercel.ts",
    provider: "Vercel REST API",
    envVars: ["VERCEL_TOKEN", "VERCEL_TEAM_ID"],
    docs: "https://vercel.com/docs/rest-api",
    functions: [
      { name: "listDeployments", signature: "(projectId: string) => Promise<Deployment[]>", status: "todo" },
      { name: "deploy", signature: "(projectId: string, opts?) => Promise<Deployment>", status: "todo" },
      { name: "streamLogs", signature: "(deploymentId: string) => Promise<string[]>", status: "todo",
        notes: "Use SSE endpoint /v2/deployments/:id/events for live tailing." },
    ],
  },
  {
    id: "supabase",
    service: "Supabase Management",
    file: "src/services/supabase.ts",
    provider: "Supabase Management API + admin SDK",
    envVars: ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF", "SUPABASE_SERVICE_ROLE_KEY"],
    docs: "https://supabase.com/docs/reference/api",
    functions: [
      { name: "listTables", signature: "(projectRef: string) => Promise<Table[]>", status: "todo" },
      { name: "getRlsStatus", signature: "(projectRef: string, table: string) => Promise<RlsReport>", status: "todo" },
      { name: "runMigration", signature: "(projectRef: string, sql: string) => Promise<MigrationResult>", status: "todo" },
    ],
  },
  {
    id: "cloud",
    service: "Lovable Cloud",
    file: "src/services/cloud.ts",
    provider: "Supabase admin client (server-only)",
    envVars: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    docs: "https://docs.lovable.dev/features/cloud",
    functions: [
      { name: "listSecrets", signature: "() => Promise<Secret[]>", status: "todo" },
      { name: "upsertSecret", signature: "(name: string, value: string) => Promise<void>", status: "todo" },
      { name: "listFunctions", signature: "() => Promise<EdgeFunction[]>", status: "todo" },
      { name: "tailLogs", signature: "(fn: string) => AsyncIterable<LogLine>", status: "todo" },
    ],
  },
  {
    id: "ai",
    service: "AI Gateway",
    file: "src/services/ai.ts",
    provider: "Lovable AI Gateway (OpenAI-compatible)",
    envVars: ["LOVABLE_AI_KEY"],
    docs: "https://docs.lovable.dev/features/ai",
    functions: [
      { name: "plan", signature: "(prompt: string, ctx: ProjectCtx) => Promise<Plan>", status: "todo" },
      { name: "implement", signature: "(plan: Plan) => AsyncIterable<FileEdit>", status: "todo" },
      { name: "verify", signature: "(projectId: string) => Promise<ProofReport>", status: "todo" },
    ],
  },
  {
    id: "auth",
    service: "Auth",
    file: "src/services/auth.ts",
    provider: "Supabase Auth (browser client)",
    envVars: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
    docs: "https://supabase.com/docs/guides/auth",
    functions: [
      { name: "signIn", signature: "(email: string, password: string) => Promise<Session>", status: "todo" },
      { name: "signUp", signature: "(email: string, password: string) => Promise<Session>", status: "todo" },
      { name: "signOut", signature: "() => Promise<void>", status: "todo" },
      { name: "getSession", signature: "() => Promise<Session | null>", status: "todo" },
    ],
  },
  {
    id: "billing",
    service: "Billing",
    file: "src/services/billing.ts",
    provider: "Stripe REST API",
    envVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    docs: "https://stripe.com/docs/api",
    functions: [
      { name: "getSubscription", signature: "(orgId: string) => Promise<Subscription>", status: "todo" },
      { name: "createCheckoutSession", signature: "(priceId: string) => Promise<{ url: string }>", status: "todo" },
      { name: "listInvoices", signature: "(orgId: string) => Promise<Invoice[]>", status: "todo" },
    ],
  },
  {
    id: "team",
    service: "Team",
    file: "src/services/team.ts",
    provider: "workspace_members table (Supabase)",
    envVars: [],
    docs: "internal",
    functions: [
      { name: "listMembers", signature: "(workspaceId: string) => Promise<Member[]>", status: "todo" },
      { name: "invite", signature: "(workspaceId: string, email: string, role: Role) => Promise<Invite>", status: "todo" },
      { name: "removeMember", signature: "(workspaceId: string, memberId: string) => Promise<void>", status: "todo" },
    ],
  },
  {
    id: "domains",
    service: "Domains",
    file: "src/services/domains.ts",
    provider: "Vercel Domains API",
    envVars: ["VERCEL_TOKEN"],
    docs: "https://vercel.com/docs/rest-api/endpoints/domains",
    functions: [
      { name: "listDomains", signature: "(projectId: string) => Promise<Domain[]>", status: "todo" },
      { name: "addDomain", signature: "(projectId: string, name: string) => Promise<Domain>", status: "todo" },
      { name: "verifyDomain", signature: "(projectId: string, name: string) => Promise<DnsReport>", status: "todo" },
    ],
  },
  {
    id: "versions",
    service: "Versions",
    file: "src/services/versions.ts",
    provider: "git history + yawB snapshots table",
    envVars: [],
    docs: "internal",
    functions: [
      { name: "listVersions", signature: "(projectId: string) => Promise<Version[]>", status: "todo" },
      { name: "rollback", signature: "(projectId: string, versionId: string) => Promise<void>", status: "todo" },
    ],
  },
  {
    id: "health",
    service: "Health",
    file: "src/services/health.ts",
    provider: "orchestrator over the services above",
    envVars: [],
    docs: "internal",
    functions: [
      { name: "scanProject", signature: "(projectId: string) => Promise<HealthReport>", status: "todo" },
      { name: "autoRepair", signature: "(projectId: string, issueIds: string[]) => Promise<RepairResult>", status: "todo" },
    ],
  },
  {
    id: "deploy",
    service: "Deploy orchestrator",
    file: "src/services/deploy.ts",
    provider: "github + vercel",
    envVars: [],
    docs: "internal",
    functions: [
      { name: "deployProject", signature: "(projectId: string, opts?) => Promise<Deployment>", status: "todo" },
      { name: "tailDeployLogs", signature: "(deploymentId: string) => Promise<string[]>", status: "todo" },
    ],
  },
  {
    id: "connectors",
    service: "Connectors",
    file: "src/services/connectors.ts",
    provider: "OAuth flows for GitHub/Vercel/Supabase/Stripe",
    envVars: ["GITHUB_OAUTH_CLIENT_ID", "VERCEL_OAUTH_CLIENT_ID", "STRIPE_OAUTH_CLIENT_ID"],
    docs: "internal",
    functions: [
      { name: "list", signature: "() => Promise<Connection[]>", status: "todo" },
      { name: "connect", signature: "(provider: Provider) => Promise<{ url: string }>", status: "todo" },
      { name: "disconnect", signature: "(connectionId: string) => Promise<void>", status: "todo" },
    ],
  },
];

export function summarize(checklist: ServiceWiring[]) {
  const all = checklist.flatMap((s) => s.functions);
  return {
    total: all.length,
    todo: all.filter((f) => f.status === "todo").length,
    inProgress: all.filter((f) => f.status === "in-progress").length,
    ready: all.filter((f) => f.status === "ready").length,
    wired: all.filter((f) => f.status === "wired").length,
  };
}
