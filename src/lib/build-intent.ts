// Detects whether a user chat prompt is asking yawB to actually BUILD/GENERATE
// an app (versus asking for a plan, summary, audit, or pure Q&A).
//
// Used by:
//   - AssistantPanel.send(): routes build intents to ai.generate_changes
//     instead of stopping at ai.plan.
//   - monster-jobs-runner: if ai.plan slips through, the runner uses the same
//     detector to auto-handoff to the agentic build loop.

export interface BuildIntentResult {
  isBuild: boolean;
  reason: string;
}

const PLAN_ONLY = /\b(rollout plan|migration strategy|implementation plan|project plan|go[- ]to[- ]market plan|roadmap|strategy|proposal|spec|prd|requirements|architecture review|explain|summari[sz]e|compare|audit|review)\b/i;

const STRONG_BUILD = /\b(build|create|make|ship|scaffold|implement|generate|design|redesign)\b[\s\S]{0,80}\b(app|site|website|web app|dashboard|admin panel|portal|landing page|saas|marketplace|crm|tool|backend|frontend|first version|first screen|prototype|mvp|platform)\b/i;

const COMBO_BUILD =
  /\b(auth|supabase|backend|database|admin panel|payments?|stripe|checkout)\b/i;
const PRODUCT_NOUN =
  /\b(app|site|website|dashboard|portal|platform|saas|marketplace|crm)\b/i;

const SHORT_BUILD = /^\s*(build|create|generate|design|make|scaffold)\b/i;

export function detectBuildIntent(text: string | null | undefined): BuildIntentResult {
  const t = (text ?? "").trim();
  if (!t) return { isBuild: false, reason: "empty" };

  if (PLAN_ONLY.test(t) && !STRONG_BUILD.test(t)) {
    return { isBuild: false, reason: "plan-only verb" };
  }
  if (STRONG_BUILD.test(t)) return { isBuild: true, reason: "strong build verb + product noun" };
  if (COMBO_BUILD.test(t) && PRODUCT_NOUN.test(t)) {
    return { isBuild: true, reason: "backend keyword + product noun" };
  }
  if (SHORT_BUILD.test(t) && t.length < 80 && PRODUCT_NOUN.test(t)) {
    return { isBuild: true, reason: "short build command" };
  }
  return { isBuild: false, reason: "no build signal" };
}
