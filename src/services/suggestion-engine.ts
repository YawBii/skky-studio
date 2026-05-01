// Product-aware suggestion engine for yawB.
//
// Generates contextual "Smart next" actions based on what the user is
// actually building — not generic setup chips. Uses deterministic
// heuristics over project name/description, current builder state, jobs,
// connections, diagnostics, and selected page/environment.
//
// Ranking: blocking > fix_failure > ask_clarifying > build_next >
// improve_quality > publish/deploy > inspect/proof > connect_provider.
// Setup/connect suggestions only appear when blocking the user's next
// intended action.

import type { Job } from "@/services/jobs";
import type { ProjectConnection } from "@/services/project-connections";
import type { Workspace } from "@/services/workspaces";
import type { Project } from "@/services/projects";
import type { DiagState } from "@/lib/diagnostics";
import { isFailedJobResolved, isPlaceholderFailure, isAiPlannerSetupFailure, latestFailedJob, latestSucceededJob, describeUnresolvedReason, getResolvingSuccess, partitionFailures } from "@/lib/job-resolution";

export type SuggestionCategory =
  | "blocking"
  | "fix_failure"
  | "ask_clarifying"
  | "build_next"
  | "improve_quality"
  | "publish_deploy"
  | "inspect_proof"
  | "connect_provider";

const CATEGORY_BASE: Record<SuggestionCategory, number> = {
  blocking: 100,
  fix_failure: 95,
  ask_clarifying: 90,
  build_next: 70,
  improve_quality: 55,
  publish_deploy: 50,
  inspect_proof: 40,
  connect_provider: 30,
};

export type SuggestionActionKind =
  | "enqueue_job"
  | "switch_tab"
  | "navigate"
  | "open_page_picker"
  | "open_command_center"
  | "ask_chat_prefill"
  | "open_diagnostics"
  | "open_server_setup"
  | "create_page"
  | "create_schema_plan"
  | "answer_question"
  | "retry_job"
  | "noop";

export type SmartSuggestionAction =
  | { kind: "enqueue_job"; jobType: string; title: string; input?: Record<string, unknown> }
  | { kind: "switch_tab"; tab: "preview" | "code" | "database" | "deploy" | "jobs" | "history"; focusJobId?: string }
  | { kind: "navigate"; to: string }
  | { kind: "open_page_picker" }
  | { kind: "open_command_center"; focusJobId?: string }
  | { kind: "ask_chat_prefill"; prompt: string }
  | { kind: "open_diagnostics" }
  | { kind: "open_server_setup" }
  | { kind: "create_page"; path: string }
  | { kind: "create_schema_plan"; tables: string[] }
  | { kind: "answer_question"; jobId: string }
  | { kind: "retry_job"; jobId: string }
  | { kind: "noop"; reason: string };

export interface SmartSuggestion {
  id: string;
  label: string;
  category: SuggestionCategory;
  priority: number; // higher = more urgent
  action: SmartSuggestionAction;
  reason: string; // diagnostic explanation
  disabledReason?: string;
  /** Short human-readable explanation shown as a pill on retry chips. */
  explanation?: string;
  /** When set, the failure was resolved by this succeeded job id. */
  resolvingJobId?: string;
  /** When set, why the failure is still considered active (no resolving success). */
  unresolvedReason?: string;
}

export interface SuggestionContext {
  workspace: Workspace | null | undefined;
  project: Project | null | undefined;
  selectedPage?: string;
  selectedEnvironment?: "preview" | "production";
  currentBuilderTab?: "preview" | "code" | "database" | "deploy" | "jobs" | "history";
  chatHistorySummary?: string;
  jobs: Job[];
  connections: ProjectConnection[];
  connectionsSource?: string;
  jobsSource?: string;
  diagnostics: DiagState;
  knownPages?: string[];
  hasDeployUrl?: boolean;
  buildRunnerConfigured?: boolean;
}

// ----- Product-type heuristics -----

interface ProductSignals {
  scanner: boolean;
  people: boolean;
  marketplace: boolean;
  saas: boolean;
  portal: boolean;
  ai: boolean;
  ecommerce: boolean;
  social: boolean;
  productNoun: string; // best guess for natural language
}

function extractSignals(project: Project | null | undefined, chatSummary?: string): ProductSignals {
  const text = `${project?.name ?? ""} ${project?.description ?? ""} ${chatSummary ?? ""}`.toLowerCase();
  return {
    scanner: /\b(scanner|scans?|crawl(er|ing)?|ingest|harvest|spider)\b/.test(text),
    people: /\b(people|person|profile|profiles|users?|members?|community)\b/.test(text),
    marketplace: /\b(marketplace|listings?|sellers?|buyers?|storefront)\b/.test(text),
    saas: /\b(saas|subscription|tenants?|workspace|teams?)\b/.test(text),
    portal: /\b(portal|admin panel|back ?office|operations?)\b/.test(text),
    ai: /\b(ai|llm|agent|prompt|model|chatbot|assistant)\b/.test(text),
    ecommerce: /\b(shop|store|cart|checkout|product catalog|ecommerce)\b/.test(text),
    social: /\b(feed|social|follow|likes?|posts?)\b/.test(text),
    productNoun: project?.name?.trim() || "your app",
  };
}

// ----- Dismissal memory (per-project, 24h) -----

const DISMISS_KEY = (projectId: string) => `yawb:suggestions:dismissed:${projectId}`;
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

interface DismissEntry { id: string; at: number }

export function loadDismissed(projectId: string | null | undefined): Set<string> {
  if (!projectId || typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY(projectId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as DismissEntry[];
    const now = Date.now();
    const fresh = arr.filter((e) => now - e.at < DISMISS_TTL_MS);
    return new Set(fresh.map((e) => e.id));
  } catch { return new Set(); }
}

export function dismissSuggestion(projectId: string | null | undefined, id: string) {
  if (!projectId || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY(projectId));
    const arr: DismissEntry[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const next = arr.filter((e) => e.id !== id && now - e.at < DISMISS_TTL_MS);
    next.push({ id, at: now });
    window.localStorage.setItem(DISMISS_KEY(projectId), JSON.stringify(next));
  } catch { /* ignore */ }
}

// ----- Engine -----

export function buildSmartSuggestions(ctx: SuggestionContext): SmartSuggestion[] {
  const out: SmartSuggestion[] = [];
  const { project, jobs, connections, selectedPage = "/", selectedEnvironment, currentBuilderTab,
          diagnostics, jobsSource, connectionsSource, hasDeployUrl, buildRunnerConfigured } = ctx;

  // Summarize for diagnostics
  const summary = {
    projectId: project?.id,
    projectName: project?.name,
    selectedPage,
    selectedEnvironment,
    currentBuilderTab,
    jobsCount: jobs.length,
    connectionsCount: connections.length,
    hasDeployUrl,
  };
  console.info("[yawb] suggestions.context", summary);

  // No project → fundamental blocker.
  if (!project) {
    out.push({
      id: "create-first-project",
      label: "Create your first project",
      category: "blocking",
      priority: CATEGORY_BASE.blocking,
      action: { kind: "navigate", to: "/projects" },
      reason: "No project selected; nothing else can be suggested.",
    });
    return finalize(out, null, jobs);
  }

  // SQL tables missing → blocking, must run migration before any job.
  if (jobsSource === "table-missing" || connectionsSource === "table-missing") {
    out.push({
      id: "run-sql-migrations",
      label: "Run SQL migration checklist",
      category: "blocking",
      priority: CATEGORY_BASE.blocking - 1,
      action: { kind: "navigate", to: "/server-setup" },
      reason: "Required Supabase tables are missing; jobs and connections cannot be persisted.",
    });
  }

  // Waiting for input → highest non-blocker.
  const waiting = jobs.find((j) => j.status === "waiting_for_input");
  if (waiting) {
    out.push({
      id: `answer-question-${waiting.id}`,
      label: "Answer pending build question",
      category: "ask_clarifying",
      priority: CATEGORY_BASE.ask_clarifying,
      action: { kind: "answer_question", jobId: waiting.id },
      reason: `Job ${waiting.id} is paused waiting for input.`,
    });
  }

  // Failed job → fix it. Skip "resolved" failures (newer same-type success,
  // or transient runner errors when a newer build.production has succeeded).
  // Also skip ai.plan setup failures — they need provider configuration, not
  // retry; we surface a dedicated "Configure AI provider" suggestion below.
  const failed = jobs.find(
    (j) =>
      j.status === "failed" &&
      !isFailedJobResolved(j, jobs) &&
      !isAiPlannerSetupFailure(j),
  );
  if (failed) {
    const errText = (failed.error ?? "").toLowerCase();
    const isRunnerErr = errText.includes("build runner") || errText.includes("runner is not configured");
    if (isRunnerErr) {
      out.push({
        id: "fix-build-runner",
        label: "Fix build runner setup",
        category: "blocking",
        priority: CATEGORY_BASE.blocking - 2,
        action: { kind: "open_server_setup" },
        reason: `Latest job failed: ${failed.error}`,
      });
    } else {
      const unresolvedReason = describeUnresolvedReason(failed, jobs);
      out.push({
        id: `retry-${failed.id}`,
        label: failed.error ? `Retry: ${truncate(failed.error, 40)}` : "Retry failed step",
        category: "fix_failure",
        priority: CATEGORY_BASE.fix_failure,
        action: { kind: "retry_job", jobId: failed.id },
        reason: `Last job ${failed.id} failed. ${unresolvedReason}`,
        explanation: unresolvedReason,
        unresolvedReason,
      });
    }
  }

  // ai.plan setup failure → "Configure AI provider", not Retry.
  const aiSetupFail = jobs.find((j) => isAiPlannerSetupFailure(j));
  if (aiSetupFail) {
    out.push({
      id: "configure-ai-provider",
      label: "Configure AI provider",
      category: "blocking",
      priority: CATEGORY_BASE.blocking - 4,
      action: { kind: "open_server_setup" },
      reason: "ai.plan failed because the AI planner provider key is not configured.",
      explanation: "Set LOVABLE_API_KEY (or AI_GATEWAY_KEY) in server env, then re-run ai.plan.",
    });
  }

  // Placeholder feature gaps — legacy "provider call is not wired yet" hint.
  // Suppress entirely once Monster Brain v1 has produced any successful
  // ai.plan job — the provider is wired and old placeholder failures are
  // stale history.
  const hasSuccessfulAiPlan = jobs.some(
    (j) => j.type === "ai.plan" && j.status === "succeeded",
  );
  const aiPlanPlaceholder = !hasSuccessfulAiPlan
    ? jobs.find(
        (j) => j.type === "ai.plan" && j.status === "failed" && isPlaceholderFailure(j),
      )
    : undefined;
  if (aiPlanPlaceholder) {
    out.push({
      id: "wire-ai-planner-provider",
      label: "Wire AI planner provider",
      category: "build_next",
      priority: CATEGORY_BASE.build_next - 5,
      action: { kind: "open_server_setup" },
      reason: "ai.plan job exists but provider execution is not implemented yet.",
      explanation: "ai.plan job exists but provider execution is not implemented yet.",
    });
  }

  // Prefer recommendations from the most recent successful ai.plan job. These
  // are model-generated, project-specific, and outrank the heuristic
  // build_next chips below. We filter out stale/impossible recs:
  //   - provider-setup actions for already-connected providers
  //   - AI provider setup actions when ai.plan has succeeded
  //   - Vercel link/connect actions when a connected Vercel row exists
  const connectedProviders = new Set(
    connections.filter((c) => c.status === "connected").map((c) => c.provider),
  );
  const vercelHealthConnected =
    diagnostics.providerConnectionStatus?.vercel === "connected" ||
    diagnostics.providerConnectionStatus?.vercel === "Connected";
  const latestAiPlan = latestSucceededJob(jobs, "ai.plan");
  if (latestAiPlan) {
    const planActions = extractPlanActions(latestAiPlan.output);
    const filtered = planActions.filter((a) => {
      const label = a.label.toLowerCase();
      const prompt = a.prompt.toLowerCase();
      const blob = `${label} ${prompt}`;
      // AI provider setup is irrelevant — ai.plan just succeeded.
      if (/\bai (provider|gateway|key|planner)\b|lovable_api_key|ai_gateway_key/.test(blob)) {
        console.info("[yawb] suggestions.filtered.stale", {
          id: `ai-plan-${latestAiPlan.id}-${slug(a.label)}`,
          reason: "ai-provider-setup-after-success",
        });
        return false;
      }
      // Vercel link/connect — already connected.
      if (/(connect|link)\s+vercel|vercel\s+(link|connect|setup|project)/.test(blob)) {
        if (connectedProviders.has("vercel") || vercelHealthConnected) {
          console.info("[yawb] suggestions.filtered.stale", {
            id: `ai-plan-${latestAiPlan.id}-${slug(a.label)}`,
            reason: "vercel-already-connected",
          });
          return false;
        }
      }
      // Generic "connect <provider>" filtering for already-connected.
      for (const p of connectedProviders) {
        const re = new RegExp(`(connect|link)\\s+${p}\\b|${p}\\s+(link|connect|setup)`);
        if (re.test(blob)) {
          console.info("[yawb] suggestions.filtered.stale", {
            id: `ai-plan-${latestAiPlan.id}-${slug(a.label)}`,
            reason: `provider-already-connected:${p}`,
          });
          return false;
        }
      }
      return true;
    });
    for (const a of filtered.slice(0, 4)) {
      out.push({
        id: `ai-plan-${latestAiPlan.id}-${slug(a.label)}`,
        label: a.label || "AI suggestion",
        category: a.category,
        // Boost above heuristic build_next so AI recs win when present.
        priority: CATEGORY_BASE[a.category] + 12 + Math.round((a.confidence ?? 0.5) * 5),
        action: a.prompt
          ? { kind: "ask_chat_prefill", prompt: a.prompt }
          : { kind: "open_command_center" },
        reason: a.reason || `From ai.plan ${latestAiPlan.id}`,
        explanation: `AI plan • ${Math.round((a.confidence ?? 0.5) * 100)}% confidence • risk ${a.risk ?? "low"}`,
      });
    }
  }

  // Build runner not configured but no failure yet → only suggest if user is
  // about to need it (e.g., started a build attempt or is on Deploy tab).
  if (buildRunnerConfigured === false && (jobs.some((j) => j.type.startsWith("build.")) || currentBuilderTab === "deploy")) {
    out.push({
      id: "configure-build-runner",
      label: "Configure build runner",
      category: "blocking",
      priority: CATEGORY_BASE.blocking - 3,
      action: { kind: "open_server_setup" },
      reason: "Build runner not configured but a build was attempted.",
    });
  }

  // ----- Product-aware build_next suggestions -----
  const sig = extractSignals(project, ctx.chatHistorySummary);
  const noun = sig.productNoun;

  // Scanner/crawler product
  if (sig.scanner) {
    out.push({
      id: "plan-crawler-pipeline",
      label: `Plan ${noun} crawler pipeline`,
      category: "build_next",
      priority: CATEGORY_BASE.build_next + 8,
      action: {
        kind: "ask_chat_prefill",
        prompt: `Plan and build the discovery/crawler pipeline for ${noun}. Include source list, fetch + parse strategy, dedup, rate-limit safety, and a status surface so I can see ingestion health.`,
      },
      reason: "Project description mentions scanning/crawling.",
    });
    out.push({
      id: "source-credibility",
      label: "Add source credibility scoring",
      category: "improve_quality",
      priority: CATEGORY_BASE.improve_quality + 5,
      action: {
        kind: "ask_chat_prefill",
        prompt: `Design a source credibility scoring system for ${noun}. Each source gets a trust score, and discovered items inherit a confidence level used downstream in moderation.`,
      },
      reason: "Scanner/ingestion products need trust scoring to avoid garbage data.",
    });
    out.push({
      id: "review-queue",
      label: "Add review queue before publishing",
      category: "improve_quality",
      priority: CATEGORY_BASE.improve_quality + 6,
      action: {
        kind: "ask_chat_prefill",
        prompt: `Build an approval/review queue for ${noun}. Discovered items must be human-reviewed before going public. Include UI, status states (pending/approved/rejected), Supabase schema, RLS, and empty states.`,
      },
      reason: "Auto-published scanner output is a safety risk; queue is standard.",
    });
  }

  // People / profiles
  if (sig.people) {
    out.push({
      id: "person-profile-page",
      label: "Add person profile page",
      category: "build_next",
      priority: CATEGORY_BASE.build_next + 6,
      action: {
        kind: "ask_chat_prefill",
        prompt: `Build a public person profile page for ${noun} at /people/$id. Include hero (name, photo, summary), source citations, timeline of recognized contributions, and report/abuse link.`,
      },
      reason: "Project centers on people/profiles.",
    });
    out.push({
      id: "people-schema",
      label: "Plan people / sources / praises schema",
      category: "build_next",
      priority: CATEGORY_BASE.build_next + 5,
      action: {
        kind: "create_schema_plan",
        tables: ["people", "sources", "praises", "source_links"],
      },
      reason: "Profiles imply a normalized data model; plan it before generating SQL.",
    });
    out.push({
      id: "privacy-review",
      label: "Add privacy/safety review for public profiles",
      category: "improve_quality",
      priority: CATEGORY_BASE.improve_quality + 4,
      action: {
        kind: "ask_chat_prefill",
        prompt: `Add a privacy and safety review flow for ${noun}: takedown requests, opt-out for subjects, PII redaction, and an audit log. Surface a "Report this profile" link on every public profile.`,
      },
      reason: "Public profiles built from web data need an opt-out and abuse path.",
    });
  }

  // Marketplace
  if (sig.marketplace) {
    out.push({
      id: "listings-page",
      label: "Add listings page",
      category: "build_next",
      priority: CATEGORY_BASE.build_next + 5,
      action: { kind: "ask_chat_prefill", prompt: `Build the listings page for ${noun} with filters, sort, and a card grid.` },
      reason: "Marketplace products need a browsable listings surface first.",
    });
    out.push({
      id: "seller-onboarding",
      label: "Add seller onboarding",
      category: "build_next",
      priority: CATEGORY_BASE.build_next + 3,
      action: { kind: "ask_chat_prefill", prompt: `Add seller onboarding for ${noun}: signup, verification, listing creation flow, payout setup.` },
      reason: "Marketplaces need supply-side onboarding.",
    });
  }

  // SaaS — only suggest dashboard/billing after some core surface exists
  if (sig.saas) {
    out.push({
      id: "saas-onboarding",
      label: "Add onboarding flow",
      category: "build_next",
      priority: CATEGORY_BASE.build_next + 2,
      action: { kind: "ask_chat_prefill", prompt: `Build a 3-step onboarding for ${noun} that captures workspace name, invites teammates, and sets a primary goal.` },
      reason: "SaaS conversion depends on guided first-run.",
    });
  }

  // Portal
  if (sig.portal) {
    out.push({
      id: "portal-roles",
      label: "Add role-based access",
      category: "build_next",
      priority: CATEGORY_BASE.build_next + 4,
      action: { kind: "ask_chat_prefill", prompt: `Add role-based access (admin/member/viewer) for ${noun}, with a separate user_roles table and RLS policies that use a SECURITY DEFINER has_role() function.` },
      reason: "Portals require RBAC before data is real.",
    });
  }

  // AI app
  if (sig.ai) {
    out.push({
      id: "prompt-workflow",
      label: "Add prompt workflow + history",
      category: "build_next",
      priority: CATEGORY_BASE.build_next + 4,
      action: { kind: "ask_chat_prefill", prompt: `Add a prompt workflow for ${noun} with run history, side-by-side comparison, and lightweight evaluation. Use Lovable AI Gateway.` },
      reason: "AI apps need history+eval to be production-ready.",
    });
    out.push({
      id: "ai-guardrails",
      label: "Add output guardrails",
      category: "improve_quality",
      priority: CATEGORY_BASE.improve_quality + 3,
      action: { kind: "ask_chat_prefill", prompt: `Add output guardrails for ${noun}: refusal handling, content filters, max length, and a fallback message when the model errors.` },
      reason: "Unguarded LLM apps are unsafe to ship.",
    });
  }

  // ----- Page-aware suggestions -----
  if (selectedPage === "/") {
    const hasHomeSuggestion = sig.scanner || sig.people || sig.marketplace || sig.ai || sig.saas;
    if (!hasHomeSuggestion) {
      out.push({
        id: "design-homepage",
        label: `Design ${noun} homepage`,
        category: "build_next",
        priority: CATEGORY_BASE.build_next + 1,
        action: { kind: "ask_chat_prefill", prompt: `Design the homepage for ${noun}. Include a hero with one-line value prop, three benefit cards, a primary product surface preview, and a clear primary CTA.` },
        reason: "On / with no specific product type detected — generic landing improvement is the safe next step.",
      });
    } else if (sig.scanner && sig.people) {
      out.push({
        id: "discovery-feed",
        label: `Design ${noun} discovery feed`,
        category: "build_next",
        priority: CATEGORY_BASE.build_next + 9,
        action: { kind: "ask_chat_prefill", prompt: `Design the public discovery feed for ${noun} on the homepage. Show recently approved profiles with name, photo, one-sentence praise, source link, and an empty state for the first deploy.` },
        reason: "Scanner+people app on homepage → main surface is a discovery feed.",
      });
    }
  } else if (selectedPage === "/dashboard") {
    out.push({
      id: "dashboard-cards",
      label: "Design dashboard cards",
      category: "build_next",
      priority: CATEGORY_BASE.build_next,
      action: { kind: "ask_chat_prefill", prompt: `Design the /dashboard for ${noun}. Pick the 4 most useful KPIs for this product and lay them out as cards with sparkline + recent activity.` },
      reason: "User is on /dashboard — suggest dashboard layout.",
    });
  } else if (selectedPage === "/billing") {
    if (sig.saas || sig.marketplace || sig.ecommerce) {
      out.push({
        id: "billing-plans",
        label: "Design billing plans",
        category: "build_next",
        priority: CATEGORY_BASE.build_next,
        action: { kind: "ask_chat_prefill", prompt: `Design the /billing page for ${noun} with three plan tiers, feature comparison, and Stripe checkout wiring.` },
        reason: "On /billing for a product type that uses billing.",
      });
    }
  }

  // ----- Diagnostics -----
  if (diagnostics.lastError) {
    out.push({
      id: "open-diagnostics",
      label: "Open diagnostics",
      category: "inspect_proof",
      priority: CATEGORY_BASE.inspect_proof,
      action: { kind: "open_diagnostics" },
      reason: `Diagnostics surfaced: ${truncate(diagnostics.lastError, 60)}`,
    });
  }

  // ----- Connect provider — only when blocking -----
  // Only suggest GitHub if user explicitly tried to deploy/publish.
  const triedDeploy = jobs.some((j) => j.type.includes("deploy") || j.type.includes("publish"));
  const github = connections.find((c) => c.provider === "github" && c.status === "connected");
  if (!github && triedDeploy) {
    out.push({
      id: "connect-github",
      label: "Connect GitHub repo",
      category: "connect_provider",
      priority: CATEGORY_BASE.connect_provider + 5,
      action: { kind: "navigate", to: "/connectors" },
      reason: "Deploy requires a connected repo.",
    });
  }
  const vercel = connections.find((c) => c.provider === "vercel" && c.status === "connected");
  if (!vercel && triedDeploy) {
    out.push({
      id: "connect-vercel",
      label: "Connect Vercel",
      category: "connect_provider",
      priority: CATEGORY_BASE.connect_provider + 4,
      action: { kind: "navigate", to: "/connectors" },
      reason: "Deploy requires Vercel.",
    });
  }

  // ----- Publish/deploy — only when build is passing -----
  const lastSucceeded = jobs.find((j) => j.status === "succeeded" && j.type.startsWith("build."));
  if (lastSucceeded && hasDeployUrl !== true && vercel) {
    out.push({
      id: "trigger-preview-deploy",
      label: "Trigger preview deploy",
      category: "publish_deploy",
      priority: CATEGORY_BASE.publish_deploy,
      action: { kind: "enqueue_job", jobType: "vercel.create_preview_deploy", title: "Create preview deploy" },
      reason: "Build passed and Vercel is connected.",
    });
  }

  return finalize(out, project.id, jobs);
}

function finalize(list: SmartSuggestion[], projectId: string | null, jobs: Job[] = []): SmartSuggestion[] {
  const dismissed = loadDismissed(projectId);
  const seen = new Set<string>();
  const sorted = [...list]
    .filter((s) => !dismissed.has(s.id))
    .sort((a, b) => b.priority - a.priority)
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .slice(0, 4);
  const lf = latestFailedJob(jobs);
  const ls = latestSucceededJob(jobs);
  const { resolvedFailed } = partitionFailures(jobs);
  const skippedResolvedFailures = resolvedFailed.map((f) => {
    const r = getResolvingSuccess(f, jobs);
    return { failedId: f.id, type: f.type, resolvedById: r?.id ?? null };
  });
  console.info("[yawb] suggestions.generated", {
    suggestions: sorted.map((s) => ({ id: s.id, category: s.category, priority: s.priority, reason: s.reason, explanation: s.explanation })),
    latestFailed: lf ? { id: lf.id, type: lf.type, createdAt: lf.createdAt, error: lf.error } : null,
    latestSucceeded: ls ? { id: ls.id, type: ls.type, createdAt: ls.createdAt } : null,
    skippedResolvedFailures,
  });
  return sorted;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function slug(s: string): string {
  return (s || "x").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "x";
}

interface AiPlanAction {
  label: string;
  reason: string;
  category: SuggestionCategory;
  prompt: string;
  confidence: number;
  risk: "low" | "medium" | "high";
}

const AI_PLAN_ALLOWED_CATEGORIES: SuggestionCategory[] = [
  "build_next", "improve_quality", "fix_failure", "publish_deploy", "inspect_proof",
];

/**
 * Extract recommendedActions from an ai.plan job's `output.plan`. Tolerant of
 * partial/missing fields — returns [] if nothing usable.
 */
export function extractPlanActions(output: unknown): AiPlanAction[] {
  if (!output || typeof output !== "object") return [];
  const plan = (output as { plan?: unknown }).plan;
  if (!plan || typeof plan !== "object") return [];
  const actions = (plan as { recommendedActions?: unknown }).recommendedActions;
  if (!Array.isArray(actions)) return [];
  const out: AiPlanAction[] = [];
  for (const item of actions) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const cat = String(o.category ?? "build_next") as SuggestionCategory;
    const category: SuggestionCategory = AI_PLAN_ALLOWED_CATEGORIES.includes(cat) ? cat : "build_next";
    const risk = String(o.risk ?? "low");
    out.push({
      label: String(o.label ?? "").slice(0, 80),
      reason: String(o.reason ?? ""),
      category,
      prompt: String(o.prompt ?? ""),
      confidence: typeof o.confidence === "number" ? o.confidence : 0.5,
      risk: (risk === "low" || risk === "medium" || risk === "high") ? risk : "low",
    });
  }
  return out;
}

