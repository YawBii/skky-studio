// TODO(codex): wire to Lovable Cloud (Supabase admin client behind server fns).
export interface AuthUser {
  id: string;
  email: string;
  provider: "email" | "google" | "apple";
  lastSignIn: string;
  created: string;
}
export interface SecretRef {
  name: string;
  updated: string;
  managed: boolean;
}
export interface FunctionRef {
  name: string;
  runtime: "edge" | "node";
  lastInvocation: string;
  status: "deployed" | "draft";
}
export interface LogLine {
  ts: string;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
}

export async function listAuthUsers(): Promise<AuthUser[]> {
  return [
    {
      id: "u_1",
      email: "ana@skky.group",
      provider: "google",
      lastSignIn: "2h ago",
      created: "2025-11-12",
    },
    {
      id: "u_2",
      email: "ben@skky.group",
      provider: "email",
      lastSignIn: "1d ago",
      created: "2025-10-30",
    },
    {
      id: "u_3",
      email: "client@acme.com",
      provider: "email",
      lastSignIn: "3d ago",
      created: "2025-09-21",
    },
  ];
}

export async function listSecrets(): Promise<SecretRef[]> {
  return [
    { name: "STRIPE_SECRET_KEY", updated: "1w ago", managed: false },
    { name: "RESEND_API_KEY", updated: "3d ago", managed: false },
    { name: "LOVABLE_API_KEY", updated: "—", managed: true },
    { name: "SUPABASE_SERVICE_ROLE_KEY", updated: "—", managed: true },
  ];
}

export async function listFunctions(): Promise<FunctionRef[]> {
  return [
    { name: "send-invoice", runtime: "edge", lastInvocation: "12m ago", status: "deployed" },
    { name: "stripe-webhook", runtime: "edge", lastInvocation: "1h ago", status: "deployed" },
    { name: "nightly-cleanup", runtime: "edge", lastInvocation: "10h ago", status: "deployed" },
  ];
}

export async function streamLogs(): Promise<LogLine[]> {
  return [
    {
      ts: "12:42:18",
      level: "info",
      source: "send-invoice",
      message: "Invoice INV-1284 sent to client@acme.com",
    },
    {
      ts: "12:41:02",
      level: "info",
      source: "auth",
      message: "User ana@skky.group signed in via google",
    },
    {
      ts: "12:39:55",
      level: "warn",
      source: "stripe-webhook",
      message: "Retrying webhook delivery (attempt 2/3)",
    },
    {
      ts: "12:38:14",
      level: "info",
      source: "db",
      message: "Migration 20260428_add_features applied",
    },
    {
      ts: "12:32:01",
      level: "error",
      source: "nightly-cleanup",
      message: "Failed to delete object avatars/old.png — not found",
    },
  ];
}
