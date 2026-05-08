import type { ArtifactType, VerificationCheck, VerificationResult } from "./types";
import { findForbiddenDashboardTokens } from "./forbidden-dashboard-tokens";

export interface VerifyInput {
  artifactType: ArtifactType;
  files: {
    indexHtml: string | null;
    stylesCss?: string | null;
  };
}

const HOMEPAGE_REQUIRED = [
  {
    id: "nav",
    label: "Top navigation",
    re: /<nav\b|class=["'][^"']*(?:site-header|site-navigation|nav-links|navbar|navigation)[^"']*["']/i,
  },
  {
    id: "hero",
    label: "Hero section",
    re: /data-section=["']hero["']|class=["'][^"']*hero[^"']*["']/i,
  },
  {
    id: "cta",
    label: "Primary CTA",
    re: /class=["'][^"']*\bcta\b[^"']*["']|(?:Get|Book|Schedule|Start|Request)\s+(?:a\s+)?(?:free\s+)?(?:consultation|now)/i,
  },
  {
    id: "practice",
    label: "Practice/services section",
    re: /Practice\s?Areas|Services|practice-areas|services-grid/i,
  },
  {
    id: "team",
    label: "Attorneys / team section",
    re: /attorneys|our team|team-grid|partners|senior counsel/i,
  },
  {
    id: "pricing",
    label: "Pricing or process section",
    re: /pricing|price-card|how it works|process-list|process-section|retainer|consultation/i,
  },
  {
    id: "contact",
    label: "Contact / consultation section",
    re: /contact|consultation|book a (call|consult)|free consultation|request consultation/i,
  },
];

function homepageChecks(html: string, css: string | null | undefined): VerificationResult {
  const checks: VerificationCheck[] = [];
  const fullOutput = `${html}\n${css ?? ""}`;
  const forbiddenTokensFound = findForbiddenDashboardTokens(fullOutput);

  for (const required of HOMEPAGE_REQUIRED) {
    const passed = required.re.test(html);
    checks.push({
      id: required.id,
      label: required.label,
      passed,
      detail: passed ? "present" : "missing",
    });
  }

  const hasCss = typeof css === "string" && css.trim().length > 200;
  const hasLinkedOrInlineStyle =
    /<link[^>]+rel=["']stylesheet["']/i.test(html) || /<style[\s>]/i.test(html);
  checks.push({
    id: "styled",
    label: "Has stylesheet content",
    passed: hasCss || hasLinkedOrInlineStyle,
    detail: hasCss
      ? "styles.css present"
      : hasLinkedOrInlineStyle
        ? "style reference present"
        : "no style source",
  });
  checks.push({
    id: "responsive",
    label: "Responsive meta viewport",
    passed: /<meta[^>]+name=["']viewport["']/i.test(html),
  });
  const blogFraming =
    /\b(blog post|article series|publication|library archive|journal entry|manifesto|atelier)\b/i;
  checks.push({
    id: "no-blog",
    label: "No blog/article/library/archive framing",
    passed: !blogFraming.test(html),
    detail: blogFraming.test(html) ? "forbidden blog/article/library/archive framing present" : "clean",
  });
  checks.push({
    id: "not-raw-html",
    label: "Not raw unstyled HTML",
    passed: /<!doctype html>|<html\b/i.test(html) && (hasCss || hasLinkedOrInlineStyle),
  });
  checks.push({
    id: "no-dashboard-tokens",
    label: "No forbidden dashboard tokens",
    passed: forbiddenTokensFound.length === 0,
    detail:
      forbiddenTokensFound.length > 0
        ? `Homepage contains forbidden dashboard tokens: ${forbiddenTokensFound.join(", ")}`
        : "clean",
  });

  const failed = checks.filter((check) => !check.passed);
  return {
    passed: failed.length === 0,
    gate: "homepage",
    checks,
    failedGates: failed.map((check) => check.detail ?? check.label),
  };
}

function dashboardChecks(html: string): VerificationResult {
  const checks: VerificationCheck[] = [
    {
      id: "nav",
      label: "Navigation",
      passed: /nav|sidebar|menu/i.test(html),
    },
    {
      id: "cockpit",
      label: "Cockpit / workspace surface",
      passed: /cockpit|board|metrics|workflow|table/i.test(html),
    },
    {
      id: "data",
      label: "Data surface",
      passed: /table|card|metric|status|owner|timeline/i.test(html),
    },
    {
      id: "admin-shell",
      label: "Admin shell",
      passed: /admin|role|permission|user/i.test(html),
    },
  ];
  const failed = checks.filter((check) => !check.passed);
  return {
    passed: failed.length === 0,
    gate: "app_dashboard",
    checks,
    failedGates: failed.map((check) => check.label),
  };
}

export function verifyArtifact(input: VerifyInput): VerificationResult {
  const html = input.files.indexHtml ?? "";
  const css = input.files.stylesCss ?? null;
  if (!html.trim()) {
    return {
      passed: false,
      gate: input.artifactType,
      checks: [{ id: "exists", label: "index.html exists", passed: false }],
      failedGates: ["index.html exists"],
    };
  }
  if (input.artifactType === "homepage") {
    return homepageChecks(html, css);
  }
  if (input.artifactType === "app_dashboard" || input.artifactType === "admin_panel") {
    return dashboardChecks(html);
  }
  return {
    passed: true,
    gate: input.artifactType,
    checks: [{ id: "noop", label: "No verifier for artifact type", passed: true }],
    failedGates: [],
  };
}
