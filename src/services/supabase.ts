// TODO(codex): wire to Supabase Management API + project SDK.
export interface SupabaseTable {
  name: string;
  rows: number;
  rls: boolean;
  status: "ok" | "warn" | "missing";
  columns: { name: string; type: string; nullable: boolean }[];
}
export interface SupabasePolicy {
  table: string;
  name: string;
  command: string;
  using: string;
}
export interface SupabaseFunction {
  name: string;
  language: "sql" | "plpgsql";
  security: "definer" | "invoker";
}
export interface StorageBucket {
  name: string;
  public: boolean;
  size: string;
  objects: number;
}

export async function listTables(_projectId: string): Promise<SupabaseTable[]> {
  return [
    {
      name: "users",
      rows: 1284,
      rls: true,
      status: "ok",
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "email", type: "text", nullable: false },
      ],
    },
    {
      name: "organizations",
      rows: 42,
      rls: true,
      status: "ok",
      columns: [{ name: "id", type: "uuid", nullable: false }],
    },
    {
      name: "subscriptions",
      rows: 38,
      rls: true,
      status: "ok",
      columns: [{ name: "id", type: "uuid", nullable: false }],
    },
    {
      name: "audit_logs",
      rows: 9214,
      rls: false,
      status: "warn",
      columns: [{ name: "id", type: "bigint", nullable: false }],
    },
    { name: "feature_flags", rows: 0, rls: false, status: "missing", columns: [] },
  ];
}

export async function listPolicies(_projectId: string): Promise<SupabasePolicy[]> {
  return [
    { table: "users", name: "users_select_self", command: "SELECT", using: "auth.uid() = id" },
    {
      table: "subscriptions",
      name: "subs_select_org",
      command: "SELECT",
      using: "org_id = current_org()",
    },
  ];
}

export async function listFunctions(_projectId: string): Promise<SupabaseFunction[]> {
  return [
    { name: "has_role", language: "sql", security: "definer" },
    { name: "current_org", language: "sql", security: "definer" },
  ];
}

export async function listBuckets(_projectId: string): Promise<StorageBucket[]> {
  return [
    { name: "avatars", public: true, size: "248 MB", objects: 1284 },
    { name: "invoices", public: false, size: "1.2 GB", objects: 532 },
  ];
}

export async function repairMissingTables(_projectId: string): Promise<{ created: string[] }> {
  return { created: ["feature_flags"] };
}
