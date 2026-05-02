// TODO(codex): wire to Lovable connectors API (list_connections / connect / disconnect).
export type ConnectorId =
  | "github"
  | "vercel"
  | "supabase"
  | "stripe"
  | "resend"
  | "slack"
  | "google"
  | "apple";
export interface Connector {
  id: ConnectorId;
  name: string;
  description: string;
  category: "git" | "deploy" | "db" | "payments" | "email" | "auth" | "comms";
  status: "connected" | "disconnected";
  account?: string;
  scopes?: string[];
}

export async function listConnectors(): Promise<Connector[]> {
  return [
    {
      id: "github",
      name: "GitHub",
      description: "Push code, open PRs, sync repos.",
      category: "git",
      status: "connected",
      account: "skky-group",
      scopes: ["repo", "workflow"],
    },
    {
      id: "vercel",
      name: "Vercel",
      description: "Build & deploy apps to the edge.",
      category: "deploy",
      status: "connected",
      account: "skky-group",
    },
    {
      id: "supabase",
      name: "Supabase",
      description: "Database, auth, storage and functions.",
      category: "db",
      status: "connected",
      account: "skky-prod",
    },
    {
      id: "stripe",
      name: "Stripe",
      description: "Subscriptions and one-time payments.",
      category: "payments",
      status: "disconnected",
    },
    {
      id: "resend",
      name: "Resend",
      description: "Transactional email delivery.",
      category: "email",
      status: "connected",
      account: "noreply@skky.group",
    },
    {
      id: "google",
      name: "Google",
      description: "Google sign-in for end users.",
      category: "auth",
      status: "disconnected",
    },
    {
      id: "apple",
      name: "Apple",
      description: "Sign in with Apple for end users.",
      category: "auth",
      status: "disconnected",
    },
    {
      id: "slack",
      name: "Slack",
      description: "Deploy & error notifications to Slack.",
      category: "comms",
      status: "disconnected",
    },
  ];
}

export async function connect(_id: ConnectorId): Promise<void> {}
export async function disconnect(_id: ConnectorId): Promise<void> {}
