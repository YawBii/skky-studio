// Demo state for the guided build lifecycle. Structured so it can later be
// wired to real jobs (planning, build, preview, test, deploy).

export type StepStatus = "waiting" | "running" | "done" | "attention";

export interface LifecycleStep {
  id: "prompt" | "plan" | "build" | "preview" | "test" | "deploy";
  label: string;
  hint: string;
  status: StepStatus;
}

export const lifecycle: LifecycleStep[] = [
  { id: "prompt", label: "Prompt", hint: "Describe the app", status: "done" },
  { id: "plan", label: "Plan", hint: "AI scopes pages & data", status: "done" },
  { id: "build", label: "Build", hint: "Generate code & schema", status: "running" },
  { id: "preview", label: "Preview", hint: "Sandboxed live preview", status: "waiting" },
  { id: "test", label: "Test", hint: "Health & readiness checks", status: "waiting" },
  { id: "deploy", label: "Deploy", hint: "Promote to production", status: "waiting" },
];

export interface PlanRoute {
  path: string;
  purpose: string;
}
export interface PlanModel {
  name: string;
  fields: string;
}
export interface PlanRisk {
  level: "low" | "med" | "high";
  text: string;
}

export interface BuildPlan {
  appType: string;
  summary: string;
  routes: PlanRoute[];
  models: PlanModel[];
  integrations: string[];
  risks: PlanRisk[];
  estimatedSteps: number;
  estimatedMinutes: number;
}

export const samplePlan: BuildPlan = {
  appType: "Multi-tenant SaaS dashboard",
  summary:
    "A subscription management dashboard with team workspaces, Stripe billing, role-based access and an admin console.",
  routes: [
    { path: "/", purpose: "Marketing landing + sign-in CTA" },
    { path: "/dashboard", purpose: "Tenant home with usage & MRR" },
    { path: "/billing", purpose: "Plans, invoices, payment methods" },
    { path: "/team", purpose: "Members, roles, invitations" },
    { path: "/settings", purpose: "Profile, workspace, integrations" },
    { path: "/admin", purpose: "Internal admin console" },
  ],
  models: [
    { name: "workspaces", fields: "id, name, plan, owner_id, created_at" },
    { name: "memberships", fields: "user_id, workspace_id, role" },
    { name: "subscriptions", fields: "workspace_id, stripe_id, status, period_end" },
    { name: "audit_logs", fields: "actor_id, workspace_id, action, meta" },
  ],
  integrations: ["Supabase Auth", "Supabase Postgres", "Stripe Billing", "Resend (email)"],
  risks: [
    { level: "med", text: "Stripe webhook secret must be set before billing tests." },
    { level: "low", text: "RLS on `subscriptions` requires workspace policy review." },
  ],
  estimatedSteps: 14,
  estimatedMinutes: 6,
};

export interface ReadinessItem {
  id: string;
  label: string;
  ok: boolean;
  fixHint?: string;
  fixAction?: string; // copy for the inline fix CTA
}

export const readiness: ReadinessItem[] = [
  { id: "auth", label: "Auth configured", ok: true },
  { id: "supabase", label: "Supabase connected", ok: true },
  { id: "github", label: "GitHub connected", ok: true },
  { id: "build", label: "Build passing", ok: true },
  { id: "secrets", label: "Secrets configured", ok: true },
  {
    id: "vercel",
    label: "Vercel connected",
    ok: false,
    fixHint: "Required to ship to production.",
    fixAction: "Connect Vercel",
  },
  {
    id: "domain",
    label: "Custom domain",
    ok: false,
    fixHint: "Optional — your .lovable.app URL still works.",
    fixAction: "Add domain",
  },
];
