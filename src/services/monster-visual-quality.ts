import type { MonsterGeneratedFile } from "./monster-orchestrator";
import type { MonsterDesignBrief } from "./monster-design-brief";

export interface VisualQualityCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface VisualQualityReport {
  version: "monster-visual-quality-v1";
  passed: boolean;
  checks: VisualQualityCheck[];
  bannedHits: string[];
  weakHits: string[];
}

const BANNED_TEMPLATE_STRINGS = [
  "Luxury Editorial",
  "Clean Minimal",
  "Money operations",
  "Lorem ipsum",
  "Your tagline here",
  "REPLACE this",
  "TODO: copy",
  "Insert headline",
  // Editorial / brand-magazine nav labels that signal a marketing site rather
  // than a SaaS app shell. yawB previews must not present these as primary nav.
  "Manifesto",
  "Atelier",
  "Journal",
  "The Sovereignty of Law",
  "Sovereignty",
  "Aeterna",
  "Lex Scripta",
  "Examine Briefing",
  "Private Tier",
  "stock image",
  "stock photo",
];

// Editorial / blog / publication nouns. Case-sensitive whole-word match in the
// generated body. These must never appear in a SaaS app shell.
const BLOG_TERMS = [
  "Briefing",
  "Article",
  "Library",
  "Publication",
  "Volume",
  "Archive",
];

const WEAK_PLACEHOLDER_STRINGS = [
  "Welcome to your app",
  "Start building",
  "Hello world",
  "Coming soon",
  "Click here",
  "Learn more about us",
];

const WORKFLOW_HINTS = [
  "table",
  "list",
  "form",
  "card",
  "queue",
  "grid",
  "timeline",
  "pipeline",
  "calendar",
  "ledger",
  "feed",
  "board",
  "dashboard",
  "approvals",
  "intake",
  "cockpit",
  "matter",
  "invoice",
  "admin",
];

// Substrings that, if found in the first ~3500 chars of <body>, count as a
// real app workflow surface above the fold (vs. landing-only marketing).
const ABOVE_FOLD_HINTS = [
  "<table",
  "<form",
  'role="grid"',
  'role="list"',
  "queue",
  "cockpit",
  "intake",
  "pipeline",
  "timeline",
  "dashboard",
  "ledger",
  "approvals",
  "data-grid",
  "workflow-board",
];

function check(id: string, label: string, passed: boolean, detail: string): VisualQualityCheck {
  return { id, label, passed, detail };
}

export function evaluateVisualQuality(input: {
  files: MonsterGeneratedFile[];
  brief: MonsterDesignBrief;
  previousIndexHtml?: string | null;
}): VisualQualityReport {
  const index = input.files.find((f) => f.path === "index.html")?.content ?? "";
  const allText = input.files
    .filter((f) => f.path.endsWith(".html") || f.path.endsWith(".tsx") || f.path.endsWith(".css"))
    .map((f) => f.content)
    .join("\n");

  const bannedHits = BANNED_TEMPLATE_STRINGS.filter((s) =>
    allText.toLowerCase().includes(s.toLowerCase()),
  );
  const weakHits = WEAK_PLACEHOLDER_STRINGS.filter((s) =>
    allText.toLowerCase().includes(s.toLowerCase()),
  );
  const workflowHits = WORKFLOW_HINTS.filter((h) => index.toLowerCase().includes(h));
  const visibleIndexText = index.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const mobileMeta = /viewport[^>]+width=device-width/i.test(index);
  const mobileCss = /@media\s*\([^)]*max-width/.test(allText);
  const hasFixedPxWidth =
    /(^|[;{\s])width:\s*\d{4,}px/i.test(allText) || /(^|[;{\s])min-width:\s*1[2-9]\d{2}px/i.test(allText);
  const hasMobileNav =
    /aria-label=["'](?:menu|navigation|open menu)["']/i.test(allText) ||
    /(?:hamburger|menu-toggle|mobile-nav|nav-toggle)/i.test(allText);
  const usesResponsiveUnits = /(?:\b\d+(?:\.\d+)?(?:rem|vw|vh|%|fr))\b/.test(allText);
  const sameAsPrevious = Boolean(input.previousIndexHtml && input.previousIndexHtml === index);
  const briefBakedIn =
    index.includes(input.brief.colorPalette.accent) ||
    index.toLowerCase().includes(input.brief.productCategory.replace(/-/g, " "));
  // Above-the-fold workflow detection: take the first ~3000 chars after <body>
  // and require at least one app workflow signal — a landing-only hero is not
  // enough.
  const bodyMatch = index.match(/<body[\s\S]{0,3000}/i);
  const aboveFold = (bodyMatch ? bodyMatch[0] : index.slice(0, 3000)).toLowerCase();
  const aboveFoldHits = ABOVE_FOLD_HINTS.filter((h) => aboveFold.includes(h.toLowerCase()));

  // Hero must NOT dominate the first screen. A giant editorial h1 (font-size
  // >= ~64px or clamp ceiling >= 80px) is treated as marketing-only.
  const heroOversize =
    /h1[^{}]*\{[^}]*font-size:\s*(?:clamp\([^)]*?,\s*)?(?:6[4-9]|[7-9]\d|1\d{2,})px/i.test(
      allText,
    ) || /font-size:\s*clamp\([^)]*,\s*[7-9]\d?px,\s*\d+px\)/i.test(allText);

  // Law-firm / matter-product token gate (only enforced when the brief or
  // index hints at the legal domain). Tokens MUST appear above the fold.
  const legalContext =
    /\b(law|legal|firm|matter|case|attorney|counsel|client intake)\b/i.test(index) ||
    /\b(law|legal|firm|matter|case|attorney|counsel)\b/i.test(input.brief.productCategory);
  const lawTokens = {
    "client-intake": /client intake/i.test(aboveFold),
    "case-cockpit": /case cockpit|matter board/i.test(aboveFold),
    "invoices-payments": /invoices|payments/i.test(aboveFold),
    "admin-roles": /\badmin\b|\broles\b/i.test(aboveFold),
    "supabase-rls": /supabase|\brls\b/i.test(aboveFold),
  };
  const lawTokenMisses = Object.entries(lawTokens)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  // Detect <img> or background-image above the first workflow surface.
  const bodyOpen = index.search(/<body[\s>]/i);
  const bodyText = bodyOpen >= 0 ? index.slice(bodyOpen) : index;
  const firstWorkflowIdx = (() => {
    let min = -1;
    for (const h of ABOVE_FOLD_HINTS) {
      const i = bodyText.toLowerCase().indexOf(h.toLowerCase());
      if (i >= 0 && (min < 0 || i < min)) min = i;
    }
    return min;
  })();
  const beforeWorkflow = firstWorkflowIdx >= 0 ? bodyText.slice(0, firstWorkflowIdx) : bodyText;
  const hasImgBeforeWorkflow =
    /<img[\s>]/i.test(beforeWorkflow) ||
    /background-image\s*:\s*url\(/i.test(beforeWorkflow) ||
    /<picture[\s>]/i.test(beforeWorkflow);

  // Blog / publication / library nouns — case-insensitive whole-word.
  const blogHits = BLOG_TERMS.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(visibleIndexText));

  // Cheap contrast guard: dark text on dark background within the same rule.
  const darkOnDark = (() => {
    const isDarkHex = (hex: string): boolean => {
      const m = hex.replace("#", "");
      if (m.length !== 3 && m.length !== 6) return false;
      const full =
        m.length === 3
          ? m
              .split("")
              .map((c) => c + c)
              .join("")
          : m;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return lum < 0.35;
    };
    const ruleRe = /\{([^}]{0,400})\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(allText))) {
      const rule = m[1];
      const colorM = rule.match(/(?:^|;|\s)color\s*:\s*(#[0-9a-fA-F]{3,6})/);
      const bgM = rule.match(/background(?:-color)?\s*:\s*(?:[^;]*?)(#[0-9a-fA-F]{3,6})/);
      if (colorM && bgM && isDarkHex(colorM[1]) && isDarkHex(bgM[1])) return true;
    }
    return false;
  })();

  const checks: VisualQualityCheck[] = [
    check(
      "no-banned-template",
      "No banned generic template strings",
      bannedHits.length === 0,
      bannedHits.length ? `Banned: ${bannedHits.join(", ")}` : "Clean",
    ),
    check(
      "no-weak-placeholder",
      "No weak placeholder copy",
      weakHits.length === 0,
      weakHits.length ? `Weak: ${weakHits.join(", ")}` : "Clean",
    ),
    check(
      "no-blog-terms",
      "No blog/article/publication wording",
      blogHits.length === 0,
      blogHits.length ? `Blog terms: ${blogHits.join(", ")}` : "Clean",
    ),
    check(
      "real-workflow-surface",
      "Has real workflow surface (table/board/queue/etc.)",
      workflowHits.length >= 2,
      workflowHits.length ? `Surfaces: ${workflowHits.join(", ")}` : "No workflow surface detected",
    ),
    check(
      "workflow-above-fold",
      "Workflow surface visible above the fold (not landing-only)",
      aboveFoldHits.length >= 1,
      aboveFoldHits.length
        ? `Above-fold: ${aboveFoldHits.join(", ")}`
        : "Only hero/landing content detected — needs cockpit/intake/queue/timeline above the fold",
    ),
    check(
      "no-image-before-workflow",
      "No <img>/background-image before the first workflow surface",
      !hasImgBeforeWorkflow,
      hasImgBeforeWorkflow
        ? "Found stock image / hero image before the first workflow section"
        : "Workflow surface comes first",
    ),
    check(
      "contrast-ok",
      "Text/background contrast not dark-on-dark",
      !darkOnDark,
      darkOnDark ? "Found dark text on dark background" : "OK",
    ),
    check(
      "mobile-ready",
      "Mobile viewport + responsive CSS",
      mobileMeta && mobileCss,
      `viewport=${mobileMeta}, mediaQuery=${mobileCss}`,
    ),
    check(
      "no-fixed-large-width",
      "No fixed desktop-only widths",
      !hasFixedPxWidth,
      hasFixedPxWidth ? "Found fixed >=1000px width" : "Fluid widths",
    ),
    check(
      "mobile-nav-component",
      "Mobile-friendly nav (toggle/hamburger)",
      hasMobileNav || !mobileCss,
      hasMobileNav ? "Mobile nav detected" : "No mobile nav toggle found",
    ),
    check(
      "responsive-units",
      "Uses responsive units (rem/%/vw/vh/fr)",
      usesResponsiveUnits,
      usesResponsiveUnits ? "Responsive units used" : "Only px units detected",
    ),
    check(
      "differs-from-previous",
      "Differs from previous generation",
      !sameAsPrevious,
      sameAsPrevious ? "Identical HTML to previous run" : "Distinct from previous",
    ),
    check(
      "design-brief-applied",
      "Design brief applied (palette/category present)",
      briefBakedIn,
      briefBakedIn
        ? `Found palette accent ${input.brief.colorPalette.accent} or category`
        : "Design brief not visibly applied to preview",
    ),
    check(
      "hero-not-oversized",
      "Hero typography stays compact (no editorial-magazine h1)",
      !heroOversize,
      heroOversize
        ? "Found large h1 font-size (>=64px) — hero dominates the first screen"
        : "Hero kept compact",
    ),
    check(
      "law-firm-tokens-present",
      "Law-firm app surfaces present above the fold (intake/cockpit/billing/admin/supabase)",
      !legalContext || lawTokenMisses.length === 0,
      legalContext
        ? lawTokenMisses.length === 0
          ? "All law-firm tokens present above the fold"
          : `Missing above the fold: ${lawTokenMisses.join(", ")}`
        : "Not a legal-domain project — skipped",
    ),
  ];

  return {
    version: "monster-visual-quality-v1",
    passed: checks.every((c) => c.passed),
    checks,
    bannedHits,
    weakHits,
  };
}

export interface DesignSelfCritique {
  beautiful: string[];
  appSpecific: string[];
  improvements: string[];
  passedVisualQuality: boolean;
  verdict: "ship" | "repair" | "block";
}

export function critiqueGeneratedDesign(input: {
  brief: MonsterDesignBrief;
  visual: VisualQualityReport;
}): DesignSelfCritique {
  const { brief, visual } = input;
  const beautiful = [
    `Palette "${brief.colorPalette.name}" gives a ${brief.brandFeel} feel`,
    `Typography pairing ${brief.typographyPairing.display.split(",")[0]} / ${brief.typographyPairing.body.split(",")[0]} differentiates the brand`,
    `${brief.cardStyle} cards with ${brief.spacingRhythm} rhythm and ${brief.navigationPattern} navigation`,
  ];
  const appSpecific = [
    `Built for ${brief.targetUser}`,
    `Hero composition: ${brief.heroComposition}`,
    `Key screens: ${brief.keyScreens.join(", ")}`,
  ];
  const improvements = visual.checks.filter((c) => !c.passed).map((c) => `${c.label}: ${c.detail}`);
  const verdict: DesignSelfCritique["verdict"] = visual.passed
    ? "ship"
    : visual.bannedHits.length
      ? "block"
      : "repair";
  return {
    beautiful,
    appSpecific,
    improvements,
    passedVisualQuality: visual.passed,
    verdict,
  };
}
