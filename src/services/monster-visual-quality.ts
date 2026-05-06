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

  const bannedHits = BANNED_TEMPLATE_STRINGS.filter((s) => allText.includes(s));
  const weakHits = WEAK_PLACEHOLDER_STRINGS.filter((s) =>
    allText.toLowerCase().includes(s.toLowerCase()),
  );
  const workflowHits = WORKFLOW_HINTS.filter((h) => index.toLowerCase().includes(h));
  const mobileMeta = /viewport[^>]+width=device-width/i.test(index);
  const mobileCss = /@media\s*\([^)]*max-width/.test(allText);
  const hasFixedPxWidth =
    /width:\s*\d{4,}px/i.test(allText) || /min-width:\s*1[2-9]\d{2}px/i.test(allText);
  const hasMobileNav =
    /aria-label=["'](?:menu|navigation|open menu)["']/i.test(allText) ||
    /(?:hamburger|menu-toggle|mobile-nav|nav-toggle)/i.test(allText);
  const usesResponsiveUnits = /(?:\b\d+(?:\.\d+)?(?:rem|vw|vh|%|fr))\b/.test(allText);
  const sameAsPrevious = Boolean(input.previousIndexHtml && input.previousIndexHtml === index);
  const briefBakedIn =
    index.includes(input.brief.colorPalette.accent) ||
    index.toLowerCase().includes(input.brief.productCategory.replace(/-/g, " "));

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
      "real-workflow-surface",
      "Has real workflow surface (table/board/queue/etc.)",
      workflowHits.length >= 2,
      workflowHits.length ? `Surfaces: ${workflowHits.join(", ")}` : "No workflow surface detected",
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
