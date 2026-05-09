import type { AgentIntent } from "./types";

export interface ClassifyInput {
  userRequest: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termRegex(term: string): RegExp {
  // Word-bounded match so "review" doesn't match "preview".
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => termRegex(term).test(text));
}

function indexOfAny(text: string, terms: string[]): number {
  const matches = terms
    .map((term) => {
      const m = termRegex(term).exec(text);
      return m ? m.index : -1;
    })
    .filter((i) => i >= 0);
  return matches.length ? Math.min(...matches) : -1;
}

const planTerms = ["plan", "audit", "review", "analyze", "analyse", "outline", "propose"];
const buildTerms = [
  "build",
  "create",
  "make",
  "implement",
  "ship",
  "scaffold",
  "generate",
  "design",
  "redesign",
  "replace",
  "launch",
  "update",
  "add",
  "turn",
  "convert",
  "transform",
  "fit",
  "change",
];
const homepageTerms = [
  "homepage",
  "home page",
  "landing page",
  "website",
  "marketing site",
  "business site",
  "business website",
  "firm site",
  "firm website",
  "public site",
  "public-facing site",
  "public facing site",
  "site",
];
const dashboardTerms = [
  "dashboard",
  "cockpit",
  "control center",
  "saas app",
  "workbench",
  "operator app",
  "matter board",
  "case cockpit",
];
const replacementTerms = [
  "redesign",
  "make",
  "turn",
  "convert",
  "replace",
  "fit",
  "change",
  "transform",
];
const lawTerms = ["law firm", "legal", "attorney", "lawyer", "counsel"];

export function classifyAgentIntent(input: ClassifyInput): AgentIntent {
  const raw = (input.userRequest ?? "").trim();
  const text = raw.toLowerCase();
  if (!text) return { artifactType: "unknown", confidence: 0, reason: "empty input" };

  const domain = hasAny(text, lawTerms) ? "law-firm" : null;
  const isPlanOnly = hasAny(text, planTerms) && !hasAny(text, buildTerms);
  if (isPlanOnly) {
    return {
      artifactType: "plan_only",
      confidence: 0.9,
      reason: "plan/audit/review verb with no build verb",
      domain,
    };
  }

  const homepageIdx = indexOfAny(text, homepageTerms);
  const dashboardIdx = indexOfAny(text, dashboardTerms);
  const explicitHomepage = homepageIdx >= 0;
  const explicitDashboard = dashboardIdx >= 0;
  const replacementIdx = indexOfAny(text, replacementTerms);

  if (explicitHomepage && replacementIdx >= 0) {
    return {
      artifactType: "homepage",
      confidence: 0.98,
      reason: "homepage replacement/redesign intent",
      domain,
    };
  }

  if (explicitHomepage && (!explicitDashboard || homepageIdx <= dashboardIdx)) {
    return {
      artifactType: "homepage",
      confidence: explicitDashboard ? 0.7 : 0.95,
      reason: explicitDashboard
        ? "homepage and dashboard both mentioned; homepage first"
        : "matched homepage/landing/website wording",
      domain,
    };
  }

  if (explicitDashboard) {
    return {
      artifactType: "app_dashboard",
      confidence: 0.85,
      reason: "dashboard/cockpit/saas wording",
      domain,
    };
  }
  if (
    text.includes("admin panel") ||
    text.includes("moderation") ||
    text.includes("backoffice") ||
    text.includes("back-office") ||
    text.includes("ops console")
  ) {
    return {
      artifactType: "admin_panel",
      confidence: 0.85,
      reason: "admin/moderation wording",
      domain,
    };
  }
  if (
    text.includes("crm") ||
    text.includes("customer relationship") ||
    text.includes("pipeline") ||
    text.includes("lead manager") ||
    text.includes("leads manager")
  ) {
    return { artifactType: "crm", confidence: 0.85, reason: "crm/pipeline wording", domain };
  }
  if (
    text.includes("marketplace") ||
    text.includes("two-sided") ||
    text.includes("listing") ||
    text.includes("catalogue") ||
    text.includes("catalog") ||
    text.includes("storefront")
  ) {
    return { artifactType: "marketplace", confidence: 0.85, reason: "marketplace wording", domain };
  }
  if (
    text.includes("auth flow") ||
    text.includes("login flow") ||
    text.includes("sign in") ||
    text.includes("sign up") ||
    text.includes("password reset")
  ) {
    return { artifactType: "auth_flow", confidence: 0.8, reason: "auth/login wording", domain };
  }
  if (
    text.includes("database") ||
    text.includes("schema") ||
    text.includes("migration") ||
    text.includes("table") ||
    text.includes("rls polic")
  ) {
    return {
      artifactType: "database_schema",
      confidence: 0.8,
      reason: "schema/migration wording",
      domain,
    };
  }
  if (
    text.includes("deploy") ||
    text.includes("production build") ||
    text.includes("publish") ||
    text.includes("ship live") ||
    text.includes("vercel")
  ) {
    return { artifactType: "deploy", confidence: 0.8, reason: "deploy/publish wording", domain };
  }
  if (
    text.includes("fix") ||
    text.includes("bug") ||
    text.includes("broken") ||
    text.includes("error") ||
    text.includes("repair") ||
    text.includes("stale") ||
    text.includes("not working") ||
    text.includes("hotfix")
  ) {
    return { artifactType: "fix_bug", confidence: 0.75, reason: "fix/bug/repair wording", domain };
  }

  return {
    artifactType: "unknown",
    confidence: 0.3,
    reason: "no strong signal in request",
    domain,
  };
}
