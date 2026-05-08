// Verifier — artifact-specific gates. Picks the gate based on intent.

import type { ArtifactType, VerificationCheck, VerificationResult } from "./types";
import { FORBIDDEN_DASHBOARD_TOKENS } from "./preview-mismatch";

export interface VerifyInput {
  artifactType: ArtifactType;
  files: { indexHtml: string | null; stylesCss: string | null };
}

const HOMEPAGE_REQUIRED = [
  {
    id: "nav",
    label: "Top navigation",
    re: /<nav[\s>]|class=["'][^"']*(?:site-nav|nav-links|navbar|navigation)[^"']*["']/i,
  },
  {
    id: "hero",
    label: "Hero section",
    re: /<section[^>]*data-section=["']hero["']|class=["'][^"']*hero[^"']*["']/i,
  },
  {
    id: "cta",
    label: "Primary CTA",
    re: /class=["'][^"']*cta[^"']*["']|<a[^>]+(?:Get|Book|Schedule|Start)[^<]*<\/a>/i,
  },
  {
    id: "practice",
    label: "Practice/services section",
    re: /Practice\s?Areas|Services|practice-areas|services-grid/i,
  },
  {
    id: "team",
    label: "Attorneys / team / trust section",
    re: /attorneys|our team|team-grid|partners|senior counsel|years of experience|trust-bar/i,
  },
  {
    id: "pricing",
    label: "Pricing or process section",
    re: /pricing|price-card|how we work|workflow-steps|process|retainer|consultation packages/i,
  },
  {
    id: "contact",
    label: "Contact / consultation section",
    re: /contact|consultation|book a (call|consult)|free consultation/i,
  },
  {
    id: "styled",
    label: "Has stylesheet content",
    re: /./, // checked separately below
  },
];

const DASHBOARD_REQUIRED = [
  { id: "nav", label: "Navigation", re: /<nav|sidebar|navigation/i },
  {
    id: "cockpit",
    label: "Cockpit / matter board shell",
    re: /case cockpit|matter board|workflow|pipeline|board|cockpit|queue|tasks?/i,
  },
  { id: "data", label: "Data/state surface", re: /<table|data-grid|kpi|metric|chart/i },
  {
    id: "admin-shell",
    label: "Admin/app shell actions",
    re: /admin panel|app[-\s]*dashboard|<button|action|primary-cta/i,
  },
];

function checkHomepage(html: string, css: string | null): VerificationResult {
  const checks: VerificationCheck[] = [];
  for (const r of HOMEPAGE_REQUIRED) {
    if (r.id === "styled") {
      const hasCss = !!css && css.trim().length > 200;
      const inlineStyle = /<style[\s>]/i.test(html);
      checks.push({
        id: r.id,
        label: r.label,
        passed: hasCss || inlineStyle,
        detail: hasCss ? "styles.css present" : inlineStyle ? "inline <style>" : "no styles",
      });
      continue;
    }
    checks.push({ id: r.id, label: r.label, passed: r.re.test(html) });
  }
  const forbiddenTokensFound = FORBIDDEN_DASHBOARD_TOKENS.filter((t) => t.re.test(html)).map(
    (t) => t.id,
  );
  checks.push({
    id: "no-dashboard-tokens",
    label: "No forbidden dashboard tokens",
    passed: forbiddenTokensFound.length === 0,
    detail:
      forbiddenTokensFound.length > 0
        ? `Homepage contains forbidden dashboard tokens: ${forbiddenTokensFound.join(", ")}`
        : undefined,
  });
  const blogRe =
    /\b(blog post|article series|publication|library archive|journal entry|manifesto|atelier)\b/i;
  checks.push({
    id: "no-blog",
    label: "No blog/article/library/archive framing",
    passed: !blogRe.test(html),
    detail: blogRe.test(html) ? "forbidden blog/article framing present" : undefined,
  });
  // Raw unstyled HTML guard — if there's no <head> with styling and no css.
  const headHasStyling = /<link[^>]+stylesheet|<style[\s>]/i.test(html);
  checks.push({
    id: "not-raw-html",
    label: "Not raw unstyled HTML",
    passed: headHasStyling || (!!css && css.length > 0),
  });
  // Mobile viewport meta.
  checks.push({
    id: "responsive",
    label: "Responsive meta viewport",
    passed: /<meta[^>]+name=["']viewport["']/i.test(html),
  });
  const failed = checks.filter((c) => !c.passed);
  return {
    passed: failed.length === 0,
    gate: "homepage",
    checks,
    failedGates: failed.map((c) => c.detail ?? c.label),
  };
}

function checkDashboard(html: string): VerificationResult {
  const checks: VerificationCheck[] = DASHBOARD_REQUIRED.map((r) => ({
    id: r.id,
    label: r.label,
    passed: r.re.test(html),
  }));
  const failed = checks.filter((c) => !c.passed);
  return {
    passed: failed.length === 0,
    gate: "app_dashboard",
    checks,
    failedGates: failed.map((c) => c.label),
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
  switch (input.artifactType) {
    case "homepage":
      return checkHomepage(html, css);
    case "app_dashboard":
    case "admin_panel":
      return checkDashboard(html);
    default:
      return {
        passed: true,
        gate: input.artifactType,
        checks: [{ id: "noop", label: "No gate for this artifact", passed: true }],
        failedGates: [],
      };
  }
}
