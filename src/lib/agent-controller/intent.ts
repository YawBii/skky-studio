// Intent classifier for the Agent Controller.
//
// Pure function; no I/O. Determines what the user is asking for.

import type { AgentIntent, ArtifactType } from "./types";

const PLAN_VERBS = /\b(plan|audit|review|analy[sz]e|outline|propose)\b/i;
const BUILD_VERBS =
  /\b(build|create|make|implement|ship|scaffold|generate|design|redesign|replace|launch|update|add)\b/i;

const HOMEPAGE_HINTS =
  /\b(home\s?page|landing\s?page|website|marketing\s?site|business\s?(site|website)|firm\s?(site|website)|public\s?site)\b/i;

const DASHBOARD_HINTS =
  /\b(dashboard|cockpit|control\s?center|saas\s?app|workbench|operator\s?app|matter\s?board|case\s?cockpit)\b/i;

const ADMIN_HINTS = /\b(admin\s?panel|moderation|backoffice|back-office|ops\s?console)\b/i;
const CRM_HINTS = /\b(crm|customer\s?relationship|pipeline|leads?\s?manager)\b/i;
const MARKETPLACE_HINTS = /\b(marketplace|two-?sided|listings?|catalogue?|storefront)\b/i;
const AUTH_HINTS = /\b(auth\s?flow|login\s?flow|sign[\s-]?in|sign[\s-]?up|password\s?reset)\b/i;
const SCHEMA_HINTS = /\b(database|schema|migration|table|rls\s?polic)/i;
const DEPLOY_HINTS = /\b(deploy|production\s?build|publish|ship\s?live|vercel)\b/i;
const FIX_HINTS = /\b(fix|bug|broken|error|repair|stale|not\s?working|hotfix)\b/i;

const DOMAIN_LAW = /\b(law\s?firm|legal|attorney|lawyer|barrister|counsel)\b/i;

export interface ClassifyInput {
  userRequest: string;
}

export function classifyAgentIntent(input: ClassifyInput): AgentIntent {
  const text = (input.userRequest ?? "").trim();
  if (!text) {
    return { artifactType: "unknown", confidence: 0, reason: "empty input" };
  }

  const domain = DOMAIN_LAW.test(text) ? "law-firm" : null;
  const isPlanOnly = PLAN_VERBS.test(text) && !BUILD_VERBS.test(text);

  if (isPlanOnly) {
    return {
      artifactType: "plan_only",
      confidence: 0.9,
      reason: "plan/audit/review verb with no build verb",
      domain,
    };
  }

  // "Redesign homepage for X" must classify as homepage even if X mentions
  // dashboard-y words elsewhere. Homepage hints win when present and the
  // user is not asking for an explicit dashboard/app build.
  const explicitDashboard = DASHBOARD_HINTS.test(text);
  const explicitHomepage = HOMEPAGE_HINTS.test(text);

  if (explicitHomepage && !explicitDashboard) {
    return {
      artifactType: "homepage",
      confidence: 0.95,
      reason: "matched homepage/landing/website wording",
      domain,
    };
  }

  if (explicitHomepage && explicitDashboard) {
    // Tie-break: if the user said "homepage" first, prefer homepage.
    const homeIdx = text.search(HOMEPAGE_HINTS);
    const dashIdx = text.search(DASHBOARD_HINTS);
    if (homeIdx >= 0 && (dashIdx < 0 || homeIdx <= dashIdx)) {
      return {
        artifactType: "homepage",
        confidence: 0.7,
        reason: "homepage and dashboard both mentioned; homepage first",
        domain,
      };
    }
  }

  // Dashboard/cockpit/SaaS wins over admin when both present (admin panel is
  // typically a sub-surface of an app_dashboard build).
  if (explicitDashboard) {
    return {
      artifactType: "app_dashboard",
      confidence: 0.85,
      reason: "dashboard/cockpit/saas wording",
      domain,
    };
  }
  if (ADMIN_HINTS.test(text)) {
    return { artifactType: "admin_panel", confidence: 0.85, reason: "admin/moderation wording", domain };
  }
  if (CRM_HINTS.test(text)) {
    return { artifactType: "crm", confidence: 0.85, reason: "crm/pipeline wording", domain };
  }
  if (MARKETPLACE_HINTS.test(text)) {
    return { artifactType: "marketplace", confidence: 0.85, reason: "marketplace wording", domain };
  }
  if (AUTH_HINTS.test(text)) {
    return { artifactType: "auth_flow", confidence: 0.8, reason: "auth/login wording", domain };
  }
  if (SCHEMA_HINTS.test(text)) {
    return { artifactType: "database_schema", confidence: 0.8, reason: "schema/migration wording", domain };
  }
  if (DEPLOY_HINTS.test(text)) {
    return { artifactType: "deploy", confidence: 0.8, reason: "deploy/publish wording", domain };
  }
  if (FIX_HINTS.test(text)) {
    return { artifactType: "fix_bug", confidence: 0.75, reason: "fix/bug/repair wording", domain };
  }

  return {
    artifactType: "unknown",
    confidence: 0.3,
    reason: "no strong signal in request",
    domain,
  };
}
