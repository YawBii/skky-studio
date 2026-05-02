import type { Project } from "@/services/projects";
import type { DesignMode } from "./monster-brain-generator";
import type {
  MonsterBlueprint,
  MonsterBlueprintRoute,
  MonsterBlueprintTable,
} from "./monster-blueprint";

interface DirectorInput {
  project: Pick<Project, "id" | "name"> & { description?: string | null };
  chatRequest?: string | null;
  connectedProviders?: string[] | null;
  requestedDesignMode?: DesignMode | null;
  production?: boolean;
}

const DESIGN_MODES: DesignMode[] = [
  "editorial-luxury",
  "glass-dashboard",
  "civic-map",
  "neon-command",
  "magazine-cards",
  "minimal-light",
  "brutalist-data",
];

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function appName(project: DirectorInput["project"]): string {
  return (project.name ?? "Untitled app").trim() || "Untitled app";
}

function commandText(input: DirectorInput): string {
  return [input.project.name ?? "", input.project.description ?? "", input.chatRequest ?? ""]
    .join(" ")
    .toLowerCase();
}

export function inferMonsterAppType(input: DirectorInput): string {
  const text = commandText(input);
  if (has(text, /\b(law|legal|attorney|solicitor|contract|firm)\b/)) return "professional-services";
  if (has(text, /\b(crm|pipeline|lead|sales|customer)\b/)) return "crm";
  if (has(text, /\b(marketplace|auction|listing|seller|buyer|commerce|shop|store)\b/))
    return "marketplace";
  if (has(text, /\b(booking|appointment|reservation|calendar|schedule)\b/))
    return "booking-platform";
  if (has(text, /\b(job|jobs|hiring|candidate|recruit|talent)\b/)) return "jobs-platform";
  if (has(text, /\b(finance|payment|invoice|billing|wallet|ledger|stripe|checkout)\b/))
    return "fintech-app";
  if (has(text, /\b(admin|dashboard|analytics|metrics|ops|internal tool|backoffice)\b/))
    return "saas-dashboard";
  if (has(text, /\b(portfolio|agency|studio|showcase|gallery)\b/)) return "portfolio-site";
  if (has(text, /\b(community|nonprofit|charity|volunteer|impact|civic)\b/))
    return "community-platform";
  return "custom-web-app";
}

export function inferMonsterDesignMode(
  input: DirectorInput,
  appType = inferMonsterAppType(input),
): DesignMode {
  if (input.requestedDesignMode && DESIGN_MODES.includes(input.requestedDesignMode))
    return input.requestedDesignMode;
  const text = commandText(input);
  if (
    has(text, /\b(luxury|premium|law|legal|hotel|real estate|estate|fashion|private|exclusive)\b/)
  )
    return "editorial-luxury";
  if (has(text, /\b(neon|terminal|developer|devtool|ai|command|cyber|console)\b/))
    return "neon-command";
  if (has(text, /\b(data|analytics|admin|metrics|dashboard|ops|monitoring)\b/))
    return "glass-dashboard";
  if (has(text, /\b(civic|government|community|impact|nonprofit|charity|map)\b/))
    return "civic-map";
  if (has(text, /\b(magazine|media|blog|content|creator|editorial)\b/)) return "magazine-cards";
  if (has(text, /\b(minimal|clean|simple|light|white)\b/)) return "minimal-light";
  if (has(text, /\b(brutalist|raw|data-heavy|terminal|industrial)\b/)) return "brutalist-data";
  switch (appType) {
    case "saas-dashboard":
      return "glass-dashboard";
    case "professional-services":
      return "editorial-luxury";
    case "community-platform":
      return "civic-map";
    case "marketplace":
      return "magazine-cards";
    case "fintech-app":
      return "neon-command";
    default:
      return "editorial-luxury";
  }
}

function defaultRoutes(appType: string): MonsterBlueprintRoute[] {
  const common: MonsterBlueprintRoute[] = [
    {
      path: "/",
      label: "Landing",
      purpose: "Convert visitors with a polished product story",
      auth: "public",
    },
    { path: "/login", label: "Login", purpose: "Sign in and account access", auth: "public" },
    {
      path: "/dashboard",
      label: "Dashboard",
      purpose: "Primary signed-in command center",
      auth: "signed-in",
    },
    {
      path: "/settings",
      label: "Settings",
      purpose: "Account, workspace, billing, and preferences",
      auth: "signed-in",
    },
  ];
  if (appType === "marketplace") {
    return [
      ...common,
      { path: "/listings", label: "Listings", purpose: "Browse/search inventory", auth: "public" },
      {
        path: "/seller",
        label: "Seller Studio",
        purpose: "Manage listings, offers, and fulfillment",
        auth: "role",
        role: "seller",
      },
      {
        path: "/admin",
        label: "Admin",
        purpose: "Moderation, users, transactions, and platform controls",
        auth: "role",
        role: "admin",
      },
    ];
  }
  if (appType === "booking-platform") {
    return [
      ...common,
      {
        path: "/book",
        label: "Book",
        purpose: "Find availability and create reservations",
        auth: "public",
      },
      {
        path: "/calendar",
        label: "Calendar",
        purpose: "Manage availability, appointments, and reminders",
        auth: "signed-in",
      },
      {
        path: "/admin",
        label: "Admin",
        purpose: "Services, staff, locations, and bookings",
        auth: "role",
        role: "admin",
      },
    ];
  }
  if (appType === "crm") {
    return [
      ...common,
      {
        path: "/contacts",
        label: "Contacts",
        purpose: "Manage people and organizations",
        auth: "signed-in",
      },
      {
        path: "/pipeline",
        label: "Pipeline",
        purpose: "Track stages, opportunities, and next actions",
        auth: "signed-in",
      },
      {
        path: "/admin",
        label: "Admin",
        purpose: "Team roles, fields, imports, and audit",
        auth: "role",
        role: "admin",
      },
    ];
  }
  return [
    ...common,
    {
      path: "/projects",
      label: "Projects",
      purpose: "Manage core user objects and workflows",
      auth: "signed-in",
    },
    {
      path: "/admin",
      label: "Admin",
      purpose: "User, role, data, and operational controls",
      auth: "role",
      role: "admin",
    },
  ];
}

function defaultTables(appType: string): MonsterBlueprintTable[] {
  const core: MonsterBlueprintTable[] = [
    {
      table: "profiles",
      purpose: "Public/private user profile metadata",
      columns: [
        "id uuid primary key references auth.users",
        "full_name text",
        "avatar_url text",
        "role text",
        "created_at timestamptz",
      ],
      rlsPolicies: [
        "Users can read their own profile",
        "Users can update their own profile",
        "Admins can read all profiles",
      ],
    },
    {
      table: "workspaces",
      purpose: "Tenant/workspace ownership boundary",
      columns: ["id uuid primary key", "name text", "owner_id uuid", "created_at timestamptz"],
      rlsPolicies: ["Members can read their workspace", "Owners can update their workspace"],
    },
    {
      table: "audit_logs",
      purpose: "Production proof and operational audit trail",
      columns: [
        "id uuid primary key",
        "workspace_id uuid",
        "actor_id uuid",
        "action text",
        "metadata jsonb",
        "created_at timestamptz",
      ],
      rlsPolicies: ["Admins can read audit logs", "Service role can insert audit logs"],
    },
  ];
  if (appType === "marketplace") {
    return [
      ...core,
      {
        table: "listings",
        purpose: "Marketplace items",
        columns: [
          "id uuid primary key",
          "workspace_id uuid",
          "seller_id uuid",
          "title text",
          "price numeric",
          "status text",
          "metadata jsonb",
        ],
        rlsPolicies: [
          "Published listings are public",
          "Sellers manage their own listings",
          "Admins manage all listings",
        ],
      },
      {
        table: "orders",
        purpose: "Purchases and fulfillment",
        columns: [
          "id uuid primary key",
          "listing_id uuid",
          "buyer_id uuid",
          "seller_id uuid",
          "amount numeric",
          "status text",
        ],
        rlsPolicies: [
          "Buyers read their orders",
          "Sellers read orders for their listings",
          "Admins read all orders",
        ],
      },
    ];
  }
  if (appType === "booking-platform") {
    return [
      ...core,
      {
        table: "services",
        purpose: "Bookable service catalog",
        columns: [
          "id uuid primary key",
          "workspace_id uuid",
          "name text",
          "duration_minutes int",
          "price numeric",
        ],
        rlsPolicies: ["Public can read active services", "Admins manage services"],
      },
      {
        table: "bookings",
        purpose: "Reservations and appointments",
        columns: [
          "id uuid primary key",
          "workspace_id uuid",
          "customer_id uuid",
          "service_id uuid",
          "starts_at timestamptz",
          "status text",
        ],
        rlsPolicies: ["Customers read own bookings", "Admins manage all bookings"],
      },
    ];
  }
  return [
    ...core,
    {
      table: "projects",
      purpose: "Primary app records",
      columns: [
        "id uuid primary key",
        "workspace_id uuid",
        "name text",
        "status text",
        "metadata jsonb",
        "created_at timestamptz",
      ],
      rlsPolicies: [
        "Workspace members read projects",
        "Members can create projects",
        "Admins can delete projects",
      ],
    },
  ];
}

export function createMonsterBlueprint(input: DirectorInput): MonsterBlueprint {
  const prompt = (
    input.chatRequest ??
    input.project.description ??
    input.project.name ??
    ""
  ).trim();
  const type = inferMonsterAppType(input);
  const designMode = inferMonsterDesignMode(input, type);
  const connected = new Set((input.connectedProviders ?? []).map((p) => p.toLowerCase()));
  const production = input.production ?? true;
  return {
    version: "monster-blueprint-v1",
    source: "monster-director",
    prompt,
    appName: appName(input.project),
    appType: type,
    summary: `Command-first ${type} for ${appName(input.project)} with ${designMode} visuals and production wiring expectations.`,
    qualityBar: production ? "production" : "prototype",
    design: {
      mode: designMode,
      reason: input.requestedDesignMode
        ? "User override selected this design mode."
        : "Monster Director inferred this visual direction from the command and app type.",
      visualDensity: type === "saas-dashboard" || type === "crm" ? "rich" : "balanced",
      heroIntent:
        type === "saas-dashboard"
          ? "Show operational command and proof immediately"
          : "Make the product feel custom and premium on first view",
    },
    routes: defaultRoutes(type),
    backend: {
      mode:
        connected.has("supabase") ||
        /auth|login|dashboard|admin|database|backend|user|role/i.test(prompt)
          ? "supabase"
          : "supabase",
      auth: /auth|login|dashboard|admin|account|user|role/i.test(prompt) ? "required" : "optional",
      roles: ["owner", "admin", "member"],
      tables: defaultTables(type),
    },
    integrations: [
      {
        provider: "github",
        purpose: "Commit generated app code and open reviewable PRs",
        required: true,
      },
      {
        provider: "supabase",
        purpose: "Auth, database, migrations, RLS, and seed data",
        required: true,
      },
      { provider: "vercel", purpose: "Preview and production deployments", required: true },
      {
        provider: "stripe",
        purpose: "Payments and subscriptions when the prompt requires billing",
        required: /stripe|payment|billing|subscription|checkout/i.test(prompt),
      },
    ],
    workflows: [
      "Generate beautiful first version from command with no template picker",
      "Create Supabase schema and RLS policies for the inferred data model",
      "Commit generated code to GitHub",
      "Run typecheck, lint, build, and tests before declaring done",
      "Repair failures from logs and rerun checks",
    ],
    acceptanceTests: [
      "First run does not require choosing a template or design angle",
      "Generated preview exposes yawb design proof meta tags",
      "Signed-in routes are separated from public routes",
      "Supabase tables include RLS policy plan",
      "Build/typecheck/lint/test status is shown in Monster Proof",
    ],
    proof: {
      inferredFrom: [
        "project.name",
        input.project.description ? "project.description" : "",
        input.chatRequest ? "chatRequest" : "",
      ].filter(Boolean),
      confidence: prompt.length > 20 ? "high" : "medium",
    },
  };
}
