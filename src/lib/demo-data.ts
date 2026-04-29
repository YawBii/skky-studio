export type ProjectStatus = "healthy" | "warning" | "critical" | "building";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  health: number;
  lastDeploy: string;
  framework: string;
  url: string;
  github: string;
  stars: number;
  issues: number;
  source: "yawB" | "Imported";
}

export const projects: Project[] = [
  {
    id: "skky-portal",
    name: "Skky Customer Portal",
    description: "Premium client dashboard with billing, support and analytics.",
    status: "healthy",
    health: 96,
    lastDeploy: "2h ago",
    framework: "TanStack Start",
    url: "portal.skky.group",
    github: "skky-group/portal",
    stars: 42,
    issues: 0,
    source: "yawB",
  },
  {
    id: "aurora-saas",
    name: "Aurora SaaS",
    description: "Multi-tenant SaaS starter with Stripe billing and team auth.",
    status: "warning",
    health: 78,
    lastDeploy: "1d ago",
    framework: "Next.js",
    url: "aurora.skky.group",
    github: "skky-group/aurora",
    stars: 128,
    issues: 3,
    source: "Imported",
  },
  {
    id: "lumen-marketing",
    name: "Lumen Marketing Site",
    description: "Marketing landing page with CMS-backed blog.",
    status: "healthy",
    health: 92,
    lastDeploy: "5h ago",
    framework: "Astro",
    url: "lumen.skky.group",
    github: "skky-group/lumen",
    stars: 17,
    issues: 1,
    source: "Imported",
  },
  {
    id: "atlas-ops",
    name: "Atlas Ops Dashboard",
    description: "Internal ops dashboard - missing Supabase tables detected.",
    status: "critical",
    health: 41,
    lastDeploy: "3d ago",
    framework: "React + Vite",
    url: "atlas.skky.group",
    github: "skky-group/atlas",
    stars: 8,
    issues: 12,
    source: "Imported",
  },
  {
    id: "nova-commerce",
    name: "Nova Commerce",
    description: "Headless commerce storefront with subscriptions.",
    status: "building",
    health: 88,
    lastDeploy: "deploying...",
    framework: "TanStack Start",
    url: "nova.skky.group",
    github: "skky-group/nova",
    stars: 64,
    issues: 0,
    source: "yawB",
  },
];

export const promptSuggestions = [
  { icon: "Rocket", title: "SaaS dashboard", prompt: "A multi-tenant SaaS dashboard with auth, billing and team workspaces." },
  { icon: "ShoppingBag", title: "E-commerce store", prompt: "A modern e-commerce storefront with cart, checkout and Stripe payments." },
  { icon: "BarChart3", title: "Analytics tool", prompt: "A real-time analytics dashboard with charts, filters and CSV export." },
  { icon: "Users", title: "Community app", prompt: "A community forum with profiles, threads, reactions and moderation." },
  { icon: "Briefcase", title: "Internal portal", prompt: "An internal employee portal with directory, time-off and announcements." },
  { icon: "Sparkles", title: "AI product", prompt: "An AI writing assistant with prompt library and team sharing." },
];

export const healthChecks = [
  { id: "build", label: "Build pipeline", status: "pass", detail: "Last build succeeded in 42s" },
  { id: "deps", label: "Dependencies", status: "warn", detail: "3 outdated packages, 0 critical CVEs" },
  { id: "db", label: "Supabase database", status: "fail", detail: "2 tables referenced in code are missing" },
  { id: "rls", label: "Row level security", status: "warn", detail: "1 table has RLS disabled" },
  { id: "env", label: "Environment variables", status: "pass", detail: "All required secrets present" },
  { id: "deploy", label: "Vercel deployment", status: "pass", detail: "Production reachable, p95 230ms" },
  { id: "seo", label: "SEO & meta", status: "warn", detail: "2 pages missing og:image" },
  { id: "a11y", label: "Accessibility", status: "pass", detail: "No critical issues detected" },
] as const;

export const chatHistory = [
  { role: "user", content: "Add a settings page with profile and billing tabs." },
  { role: "assistant", content: "I'll create `/settings` with two tabs. Profile will use the existing `users` table and Billing will read from Stripe.\n\n**Plan**\n1. Create `src/routes/settings.tsx` with tab nav\n2. Add `ProfileForm` and `BillingPanel` components\n3. Wire to existing auth context\n\nProceeding now." },
  { role: "user", content: "Looks great, ship it." },
  { role: "assistant", content: "Deployed to preview. ✅ Build passed in 38s. ✅ Lighthouse 98. Ready to promote to production?" },
];
