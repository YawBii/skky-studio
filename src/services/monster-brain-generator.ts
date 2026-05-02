// Monster Brain v1 — deterministic project-aware generator.
//
// Goal: every project must look meaningfully different in Local Preview —
// distinct archetype, layout, palette, copy, and structure. No shared template.
//
// Public surface (stable — an AI adapter can implement the same shape later):
//   - inferProjectArchetype(project, context?) -> Archetype
//   - generateProjectFiles(project, context?)  -> GeneratedProjectFile[]
//   - designSignature(project, archetype)      -> string  (proof of distinctness)
//
// All HTML/CSS/JS is generated as plain strings — the iframe sandbox in
// PreviewPane is locked down (no scripts) for srcDoc rendering, but app.js
// is still emitted as a real file for parity with future hosted previews.

import type { Project } from "@/services/projects";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Archetype =
  | "social-good"
  | "corporate"
  | "jobs"
  | "fintech"
  | "identity"
  | "gaming"
  | "saas"
  | "portfolio"
  | "marketplace"
  | "default";

export interface GeneratedProjectFile {
  path: string;
  content: string;
  language: string;
  kind: "source" | "asset";
}

export interface MonsterBrainContext {
  /** Last user chat message — informs intent. */
  chatRequest?: string | null;
  /** Connected providers (github/vercel/supabase/...) — informs sections. */
  connectedProviders?: string[] | null;
  /** Files already produced — generator may preserve or evolve them later. */
  previousFiles?: { path: string }[] | null;
  /** Last few job summaries — used as proof block hints. */
  recentJobs?: Array<{ type: string; status: string; summary?: string | null }> | null;
  /** Per-regeneration entropy — when present, every regen produces a distinct design. */
  regenerationSeed?: string | null;
  /** Forces a non-default variant pick even when no chat request changed. */
  forceVariant?: boolean;
}

/** Build the seed basis used for theme/copy/section variance. */
function buildSeedBasis(project: ProjectLike, context?: MonsterBrainContext | null): string {
  return [
    project.id ?? "",
    project.name ?? "",
    project.description ?? "",
    context?.regenerationSeed ?? "",
    context?.chatRequest ?? "",
  ].filter(Boolean).join(":") || "x";
}

type ProjectLike = Pick<Project, "id" | "name"> & { description?: string | null };

// ---------------------------------------------------------------------------
// Archetype inference
// ---------------------------------------------------------------------------

const ARCHETYPE_RULES: Array<{ archetype: Archetype; pattern: RegExp }> = [
  { archetype: "social-good", pattern: /\b(goodhand|good[-\s]?hand|scanner|scan|praise|humanity|kindness|impact|community|charity|volunteer|nonprofit|social[-\s]?good|do[-\s]?good)\b/i },
  { archetype: "corporate",   pattern: /\b(skky\s*group|skkygroup|skky|holding|holdings|group|ventures|capital|portfolio[-\s]?group|infrastructure|corporate|conglomerate|enterprise)\b/i },
  { archetype: "jobs",        pattern: /\b(ujob|u[-\s]?job|job|jobs|hiring|hire|recruit|recruiter|candidate|candidates|career|careers|work|workforce|gig|gigs|talent|employer|employee)\b/i },
  { archetype: "fintech",     pattern: /\b(fintech|payment|payments|invoice|invoices|invoicing|money|wallet|bank|banking|ledger|finance|treasury|payroll|stripe|billing|checkout|transactions?)\b/i },
  { archetype: "identity",    pattern: /\b(identity|identify|verification|verify|verified|trust|kyc|aml|compliance|auth|authn|authz|passport|credential|credentials|id[-\s]?check|last[-\s]?man|lastman)\b/i },
  { archetype: "gaming",      pattern: /\b(gaming|game|games|player|players|leaderboard|esports|arcade|guild|clan|quest|tournament|multiplayer)\b/i },
  { archetype: "saas",        pattern: /\b(saas|dashboard|analytics|metrics|crm|admin|platform|workspace|si4|ops|devtool|devtools|monitoring|observability)\b/i },
  { archetype: "portfolio",   pattern: /\b(portfolio|case[-\s]?stud(?:y|ies)|showcase|gallery|works|selected[-\s]?work|designer|artist)\b/i },
  { archetype: "marketplace", pattern: /\b(marketplace|market[-\s]?place|listing|listings|sellers?|buyers?|store|shop|catalog|commerce)\b/i },
];

export function inferProjectArchetype(
  project: ProjectLike,
  context?: MonsterBrainContext | null,
): Archetype {
  const hay = [
    project.name ?? "",
    project.description ?? "",
    context?.chatRequest ?? "",
    ...(context?.recentJobs ?? []).map((j) => j.summary ?? ""),
  ].join(" ");
  for (const rule of ARCHETYPE_RULES) {
    if (rule.pattern.test(hay)) return rule.archetype;
  }
  return "default";
}

// ---------------------------------------------------------------------------
// Theme + section catalog
// ---------------------------------------------------------------------------

interface Theme {
  bg: string;
  surface: string;
  surface2: string;
  fg: string;
  muted: string;
  accent: string;
  accent2: string;
  ring: string;
  display: string;
  body: string;
}

interface Copy {
  eyebrow: string;
  title: string;
  lede: string;
  primaryCta: string;
  secondaryCta: string;
  navLinks: string[];
  metricLabels: string[];
  metricValues: string[];
}

interface Blueprint {
  archetype: Archetype;
  theme: Theme;
  copy: Copy;
  /** Ordered list of section render keys. */
  sections: SectionKey[];
}

type SectionKey =
  | "hero-search"
  | "hero-spotlight"
  | "hero-glass"
  | "hero-finance"
  | "hero-identity"
  | "hero-gaming"
  | "hero-default"
  | "scanner-feed"
  | "praise-cards"
  | "impact-metrics"
  | "trust-panel"
  | "portfolio-grid"
  | "operating-principles"
  | "regions"
  | "architecture"
  | "featured-roles"
  | "candidate-company-split"
  | "trust-badges"
  | "transaction-cards"
  | "security-layer"
  | "metrics-strip"
  | "trust-graph"
  | "compliance-cards"
  | "activity-timeline"
  | "game-cards"
  | "leaderboard"
  | "community-cta"
  | "feature-grid"
  | "pricing-tiers"
  | "faq-accordion"
  | "testimonial-wall"
  | "logo-strip"
  | "process-steps"
  | "cta-band"
  | "footer";

// ---------------------------------------------------------------------------
// Themes per archetype (with deterministic per-project hue rotation)
// ---------------------------------------------------------------------------

function baseThemeFor(archetype: Archetype): Theme {
  switch (archetype) {
    case "social-good":
      return { bg: "#0a1410", surface: "#0f1c16", surface2: "#13261d", fg: "#ecfff4", muted: "#88a99a", accent: "#f5b84b", accent2: "#3ddc84", ring: "rgba(245,184,75,.35)", display: '"Fraunces", Georgia, serif', body: '"Inter", system-ui, sans-serif' };
    case "corporate":
      return { bg: "#070b0c", surface: "#0c1416", surface2: "#101c20", fg: "#eef5f5", muted: "#8aa0a4", accent: "#3fb39a", accent2: "#9bbac0", ring: "rgba(63,179,154,.28)", display: '"Playfair Display", Georgia, serif', body: '"Inter", system-ui, sans-serif' };
    case "jobs":
      return { bg: "#0a0d18", surface: "#121730", surface2: "#171d3d", fg: "#f3f5ff", muted: "#9aa3c8", accent: "#5b8cff", accent2: "#c084fc", ring: "rgba(91,140,255,.32)", display: '"Plus Jakarta Sans", "Inter", sans-serif', body: '"Inter", system-ui, sans-serif' };
    case "fintech":
      return { bg: "#040813", surface: "#0a1224", surface2: "#0f182f", fg: "#e8f3ff", muted: "#7c92ad", accent: "#5cf2c8", accent2: "#7c9cff", ring: "rgba(92,242,200,.28)", display: '"JetBrains Mono", ui-monospace, monospace', body: '"Inter", system-ui, sans-serif' };
    case "identity":
      return { bg: "#06101a", surface: "#0c1928", surface2: "#102236", fg: "#e6f1ff", muted: "#7d96b3", accent: "#4dd0e1", accent2: "#7cffb3", ring: "rgba(77,208,225,.32)", display: '"Space Grotesk", "Inter", sans-serif', body: '"Inter", system-ui, sans-serif' };
    case "gaming":
      return { bg: "#08060f", surface: "#120c20", surface2: "#1a1230", fg: "#fdf3ff", muted: "#a89bc4", accent: "#ff3ea5", accent2: "#7cf5ff", ring: "rgba(255,62,165,.4)", display: '"Bricolage Grotesque", "Inter", sans-serif', body: '"Inter", system-ui, sans-serif' };
    case "saas":
      return { bg: "#070b14", surface: "#0f1626", surface2: "#141d33", fg: "#eef3ff", muted: "#7d8aa6", accent: "#7c9cff", accent2: "#5cf2c8", ring: "rgba(124,156,255,.3)", display: '"Inter", system-ui, sans-serif', body: '"Inter", system-ui, sans-serif' };
    case "portfolio":
      return { bg: "#0a0a0c", surface: "#131316", surface2: "#1a1a1f", fg: "#fafafa", muted: "#9a9aa6", accent: "#ff5e3a", accent2: "#ffd6c2", ring: "rgba(255,94,58,.3)", display: '"Bricolage Grotesque", "Inter", sans-serif', body: '"Inter", system-ui, sans-serif' };
    case "marketplace":
      return { bg: "#0a0e1a", surface: "#121a30", fg: "#f1f4ff", surface2: "#16203a", muted: "#8c95b3", accent: "#ffb547", accent2: "#5b8cff", ring: "rgba(255,181,71,.3)", display: '"Plus Jakarta Sans", "Inter", sans-serif', body: '"Inter", system-ui, sans-serif' };
    default:
      return { bg: "#0b0f14", surface: "#141a22", surface2: "#1a212c", fg: "#e6edf3", muted: "#8b96a7", accent: "#7c9cff", accent2: "#c8d4ff", ring: "rgba(124,156,255,.28)", display: '"Inter", system-ui, sans-serif', body: '"Inter", system-ui, sans-serif' };
  }
}

function shiftedTheme(base: Theme, seedBasis: string): Theme {
  const hue = Math.abs(hash(seedBasis)) % 360;
  return { ...base, ring: base.ring, _hue: hue } as Theme & { _hue: number };
}

/** Variant index 0..N-1 derived from seedBasis — selects layout/order variant. */
export function variantIndex(seedBasis: string, modulo: number = 6): number {
  return Math.abs(hash(`v:${seedBasis}`)) % Math.max(1, modulo);
}

// ---------------------------------------------------------------------------
// Copy per archetype (sections + nav + metrics)
// ---------------------------------------------------------------------------

function copyFor(archetype: Archetype, project: ProjectLike): Copy {
  const name = (project.name ?? "Untitled").trim() || "Untitled";
  const desc = (project.description ?? "").trim();
  switch (archetype) {
    case "social-good":
      return {
        eyebrow: "Discovery · Praise · Trust",
        title: `${name}: see who shows up for the community.`,
        lede: desc || "A live scanner that surfaces the people quietly doing good — verified, contextual, and impossible to fake.",
        primaryCta: "Scan a profile",
        secondaryCta: "How it works",
        navLinks: ["Scanner", "Praise", "Impact", "Trust"],
        metricLabels: ["Verified profiles", "Acts surfaced", "Communities", "Trust score"],
        metricValues: ["12,480", "284,019", "63", "97%"],
      };
    case "corporate":
      return {
        eyebrow: "Group · Operating system",
        title: `${name} — quietly building infrastructure that compounds.`,
        lede: desc || "An operating group of long-horizon ventures. Calm capital, sharp craft, selective partnerships.",
        primaryCta: "Explore the group",
        secondaryCta: "Contact the office",
        navLinks: ["Portfolio", "Principles", "Regions", "Architecture", "Contact"],
        metricLabels: ["Operating companies", "Regions", "Years compounding", "Net retention"],
        metricValues: ["14", "9", "11", "138%"],
      };
    case "jobs":
      return {
        eyebrow: "Hiring marketplace",
        title: `${name} — hire faster. Get hired smarter.`,
        lede: desc || "A two-sided marketplace where verified employers meet skill-matched candidates in real conversations.",
        primaryCta: "Search roles",
        secondaryCta: "Post a role",
        navLinks: ["Roles", "Companies", "Candidates", "How it works"],
        metricLabels: ["Open roles", "Verified companies", "Candidates", "Avg. time-to-hire"],
        metricValues: ["3,902", "812", "48,210", "11 days"],
      };
    case "fintech":
      return {
        eyebrow: "Money operations",
        title: `${name} — money operations on autopilot.`,
        lede: desc || "A finance OS that ingests transactions, reconciles them, and gives you a single, audit-ready ledger.",
        primaryCta: "Open the dashboard",
        secondaryCta: "See security model",
        navLinks: ["Transactions", "Ledger", "Security", "Pricing"],
        metricLabels: ["Volume / mo", "Reconciliation", "Latency", "Uptime"],
        metricValues: ["$48.2M", "99.97%", "84ms", "99.999%"],
      };
    case "identity":
      return {
        eyebrow: "Identity · Verification · Trust",
        title: `${name} — proof of who, every time.`,
        lede: desc || "A verification layer that turns scattered signals into a single, defensible identity graph.",
        primaryCta: "Verify a profile",
        secondaryCta: "Read trust model",
        navLinks: ["Verification", "Trust graph", "Compliance", "Activity"],
        metricLabels: ["Profiles verified", "Signals correlated", "Avg. confidence", "False-positive"],
        metricValues: ["1.2M", "84", "0.97", "0.21%"],
      };
    case "gaming":
      return {
        eyebrow: "Play · Compete · Belong",
        title: `${name} — where the next match starts.`,
        lede: desc || "A community-first gaming hub: matchmaking, leaderboards, and squads worth showing up for.",
        primaryCta: "Find a match",
        secondaryCta: "View leaderboard",
        navLinks: ["Games", "Leaderboard", "Squads", "Events"],
        metricLabels: ["Active players", "Matches today", "Tournaments", "Squads"],
        metricValues: ["184k", "62,419", "37", "8,902"],
      };
    case "saas":
      return {
        eyebrow: "Operations platform",
        title: `${name} — run the boring parts on autopilot.`,
        lede: desc || "Realtime metrics, role-aware controls, and audit-ready logs in one calm dashboard.",
        primaryCta: "Open dashboard",
        secondaryCta: "View metrics",
        navLinks: ["Overview", "Metrics", "Controls", "Audit"],
        metricLabels: ["Workflows", "Avg. SLA", "Operators", "Audit events"],
        metricValues: ["218", "99.4%", "47", "2.1M"],
      };
    case "portfolio":
      return {
        eyebrow: "Selected work",
        title: `${name} — sharp ideas, made tangible.`,
        lede: desc || "An independent studio building brand systems, product stories, and launch craft.",
        primaryCta: "See selected work",
        secondaryCta: "Get in touch",
        navLinks: ["Work", "Studio", "Process", "Contact"],
        metricLabels: ["Projects shipped", "Studio years", "Industries", "Awards"],
        metricValues: ["62", "8", "14", "21"],
      };
    case "marketplace":
      return {
        eyebrow: "Open marketplace",
        title: `${name} — buyers and sellers in one calm place.`,
        lede: desc || "A curated marketplace built around verified listings and signal-rich profiles.",
        primaryCta: "Browse listings",
        secondaryCta: "Become a seller",
        navLinks: ["Listings", "Sellers", "Trust", "Pricing"],
        metricLabels: ["Active listings", "Verified sellers", "Categories", "Avg. response"],
        metricValues: ["18,402", "2,018", "42", "9 min"],
      };
    default:
      return {
        eyebrow: "New product",
        title: `${name} — a calm, deliberate take on its category.`,
        lede: desc || "A product taking shape here, designed with intent and ready to evolve.",
        primaryCta: "Get started",
        secondaryCta: "Learn more",
        navLinks: ["Overview", "Features", "Pricing", "Contact"],
        metricLabels: ["Built with", "Designed for", "Ready to", "Status"],
        metricValues: ["intent", "clarity", "ship", "v1"],
      };
  }
}

function sectionsFor(archetype: Archetype): SectionKey[] {
  switch (archetype) {
    case "social-good":
      return ["hero-spotlight", "scanner-feed", "impact-metrics", "praise-cards", "process-steps", "trust-panel", "testimonial-wall", "cta-band", "footer"];
    case "corporate":
      return ["hero-glass", "logo-strip", "portfolio-grid", "operating-principles", "regions", "architecture", "testimonial-wall", "cta-band", "footer"];
    case "jobs":
      return ["hero-search", "logo-strip", "featured-roles", "candidate-company-split", "process-steps", "trust-badges", "metrics-strip", "testimonial-wall", "cta-band", "footer"];
    case "fintech":
      return ["hero-finance", "metrics-strip", "transaction-cards", "security-layer", "compliance-cards", "pricing-tiers", "faq-accordion", "cta-band", "footer"];
    case "identity":
      return ["hero-identity", "trust-graph", "compliance-cards", "activity-timeline", "process-steps", "security-layer", "faq-accordion", "cta-band", "footer"];
    case "gaming":
      return ["hero-gaming", "game-cards", "leaderboard", "metrics-strip", "community-cta", "testimonial-wall", "footer"];
    case "saas":
      return ["hero-default", "logo-strip", "feature-grid", "metrics-strip", "process-steps", "pricing-tiers", "testimonial-wall", "faq-accordion", "cta-band", "footer"];
    case "portfolio":
      return ["hero-spotlight", "portfolio-grid", "operating-principles", "process-steps", "testimonial-wall", "cta-band", "footer"];
    case "marketplace":
      return ["hero-search", "feature-grid", "logo-strip", "trust-badges", "testimonial-wall", "pricing-tiers", "faq-accordion", "cta-band", "footer"];
    default:
      return ["hero-default", "feature-grid", "metrics-strip", "process-steps", "testimonial-wall", "cta-band", "footer"];
  }
}

// ---------------------------------------------------------------------------
// Sanitizer (HTML-safe interpolation)
// ---------------------------------------------------------------------------

function esc(value: unknown, maxLen = 600): string {
  const raw = typeof value === "string" ? value : "";
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "")
    .slice(0, maxLen);
  return cleaned.replace(/[&<>"'`/=]/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      case "`": return "&#96;";
      case "/": return "&#47;";
      case "=": return "&#61;";
      default: return c;
    }
  });
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

/** Tiny deterministic PRNG seeded from project id. */
function rngFor(seed: string): () => number {
  let s = Math.abs(hash(seed)) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], rnd: () => number): T { return arr[Math.floor(rnd() * arr.length)]; }

// ---------------------------------------------------------------------------
// Section renderers — return inner HTML strings
// ---------------------------------------------------------------------------

function renderNav(name: string, copy: Copy): string {
  const links = copy.navLinks.map((l) => `<a href="#${esc(l).toLowerCase().replace(/\s+/g, "-")}">${esc(l, 40)}</a>`).join("");
  return `<nav class="mb-nav">
    <div class="mb-brand"><span class="mb-mark"></span><span>${esc(name, 60)}</span></div>
    <div class="mb-nav-links">${links}</div>
    <button type="button" class="mb-nav-cta">${esc(copy.primaryCta, 40)}</button>
  </nav>`;
}

function renderHero(kind: SectionKey, name: string, copy: Copy): string {
  const titleSafe = esc(copy.title, 240);
  const ledeSafe = esc(copy.lede, 600);
  const primary = esc(copy.primaryCta, 40);
  const secondary = esc(copy.secondaryCta, 40);
  const eyebrow = esc(copy.eyebrow, 80);

  switch (kind) {
    case "hero-search":
      return `<section class="mb-hero mb-hero-search">
        <span class="mb-eyebrow">${eyebrow}</span>
        <h1 class="mb-title">${titleSafe}</h1>
        <p class="mb-lede">${ledeSafe}</p>
        <form class="mb-search" onsubmit="event.preventDefault()">
          <input type="text" placeholder="Search roles, skills, companies…" aria-label="Search" />
          <select aria-label="Location"><option>Anywhere</option><option>Remote</option><option>Europe</option><option>Americas</option></select>
          <button type="submit">${primary}</button>
        </form>
        <div class="mb-pill-row"><span>Engineering</span><span>Design</span><span>Product</span><span>Ops</span><span>Growth</span></div>
      </section>`;
    case "hero-spotlight":
      return `<section class="mb-hero mb-hero-spotlight">
        <div class="mb-spotlight-glow"></div>
        <span class="mb-eyebrow">${eyebrow}</span>
        <h1 class="mb-title">${titleSafe}</h1>
        <p class="mb-lede">${ledeSafe}</p>
        <div class="mb-cta-row"><button type="button" class="mb-cta">${primary}</button><button type="button" class="mb-cta ghost">${secondary}</button></div>
      </section>`;
    case "hero-glass":
      return `<section class="mb-hero mb-hero-glass">
        <span class="mb-eyebrow serif">${eyebrow}</span>
        <h1 class="mb-title serif">${titleSafe}</h1>
        <p class="mb-lede">${ledeSafe}</p>
        <div class="mb-cta-row"><button type="button" class="mb-cta">${primary}</button><button type="button" class="mb-cta ghost">${secondary}</button></div>
      </section>`;
    case "hero-finance":
      return `<section class="mb-hero mb-hero-finance">
        <span class="mb-eyebrow mono">${eyebrow}</span>
        <h1 class="mb-title mono">${titleSafe}</h1>
        <p class="mb-lede">${ledeSafe}</p>
        <div class="mb-cta-row"><button type="button" class="mb-cta">${primary}</button><button type="button" class="mb-cta ghost">${secondary}</button></div>
        <div class="mb-ticker" aria-hidden="true"><span>USD/EUR 1.087</span><span>BTC 71,402</span><span>SPX 5,318</span><span>VIX 12.4</span></div>
      </section>`;
    case "hero-identity":
      return `<section class="mb-hero mb-hero-identity">
        <span class="mb-eyebrow">${eyebrow}</span>
        <h1 class="mb-title">${titleSafe}</h1>
        <p class="mb-lede">${ledeSafe}</p>
        <div class="mb-cta-row"><button type="button" class="mb-cta">${primary}</button><button type="button" class="mb-cta ghost">${secondary}</button></div>
      </section>`;
    case "hero-gaming":
      return `<section class="mb-hero mb-hero-gaming">
        <span class="mb-eyebrow neon">${eyebrow}</span>
        <h1 class="mb-title neon">${titleSafe}</h1>
        <p class="mb-lede">${ledeSafe}</p>
        <div class="mb-cta-row"><button type="button" class="mb-cta neon">${primary}</button><button type="button" class="mb-cta ghost">${secondary}</button></div>
      </section>`;
    default:
      return `<section class="mb-hero">
        <span class="mb-eyebrow">${eyebrow}</span>
        <h1 class="mb-title">${titleSafe}</h1>
        <p class="mb-lede">${ledeSafe}</p>
        <div class="mb-cta-row"><button type="button" class="mb-cta">${primary}</button><button type="button" class="mb-cta ghost">${secondary}</button></div>
      </section>`;
  }
}

function renderSection(key: SectionKey, name: string, copy: Copy, archetype: Archetype, seed: string = "x"): string {
  const rnd = rngFor(`${seed}:${key}`);
  switch (key) {
    case "scanner-feed":
      return `<section id="scanner" class="mb-section">
        <h2 class="mb-h2">Live scanner feed</h2>
        <p class="mb-sub">Real signals from real contributors — surfaced the moment they happen.</p>
        <ul class="mb-feed">
          ${shuffle(["Mira hosted a free repair café for 38 neighbours.", "Devon shipped weekly groceries to 12 elders.", "Aisha published an open-source mental-health toolkit.", "Tom ran a 6-week mentorship circle for first-gen students.", "Priya organised a clothing swap for 60 families.", "Joon ran weekend coding clinics at the public library."], rnd).slice(0, 5).map((t, i) => `<li class="mb-feed-row"><span class="mb-feed-dot"></span><span class="mb-feed-when">${i === 0 ? "just now" : `${i * 7}m ago`} · 0${i + 1}</span><span class="mb-feed-what">${esc(t)}</span></li>`).join("")}
        </ul>
      </section>`;
    case "praise-cards":
      return `<section id="praise" class="mb-section">
        <h2 class="mb-h2">Praise cards</h2>
        <div class="mb-grid mb-grid-3">
          ${[
            { who: "Mira O.", what: "Quietly fed her block for a year.", tag: "neighbourhood" },
            { who: "Devon K.", what: "Drove 4hr/wk delivering medication to elders.", tag: "care" },
            { who: "Aisha R.", what: "Open-sourced the curriculum she paid $9k for.", tag: "knowledge" },
          ].map((p) => `<article class="mb-card mb-card-praise">
            <header class="mb-card-head"><span class="mb-avatar">${esc(p.who.charAt(0))}</span><div><strong>${esc(p.who)}</strong><span class="mb-tag">${esc(p.tag)}</span></div></header>
            <p>${esc(p.what)}</p>
            <footer class="mb-card-foot"><button type="button" class="mb-link">Add praise →</button></footer>
          </article>`).join("")}
        </div>
      </section>`;
    case "impact-metrics":
    case "metrics-strip":
      return `<section id="impact" class="mb-section mb-metrics">
        ${copy.metricLabels.map((label, i) => `<div class="mb-metric"><div class="mb-metric-value">${esc(copy.metricValues[i] ?? "—", 40)}</div><div class="mb-metric-label">${esc(label, 60)}</div></div>`).join("")}
      </section>`;
    case "trust-panel":
      return `<section id="trust" class="mb-section mb-trust">
        <div>
          <h2 class="mb-h2">Why this is trustworthy</h2>
          <p class="mb-sub">Every signal is verifiable. Every claim links to a public source. Every profile is opt-in.</p>
          <ul class="mb-checklist">
            ${["Public, cited sources for every claim.", "Opt-in profiles only — no scraping.", "No private data is ever stored.", "Audited by an independent civic team."].map((t) => `<li>${esc(t)}</li>`).join("")}
          </ul>
        </div>
        <aside class="mb-trust-aside">
          <div class="mb-trust-stat"><span class="mb-metric-value">97%</span><span class="mb-metric-label">trust score</span></div>
        </aside>
      </section>`;
    case "portfolio-grid":
      return `<section id="portfolio" class="mb-section">
        <h2 class="mb-h2">Operating companies</h2>
        <div class="mb-grid mb-grid-3">
          ${[
            { n: "Skky Lab",      d: "Independent design and product studio." },
            { n: "Skky Capital",  d: "Long-horizon checks for compounding teams." },
            { n: "Skky Infra",    d: "Backbone services for portfolio operations." },
            { n: "Skky Civic",    d: "Public-good infrastructure with measurable impact." },
            { n: "Skky Talent",   d: "In-house operators placed inside portfolio companies." },
            { n: "Skky Research", d: "Quiet, long-cycle research on new categories." },
          ].map((c) => `<article class="mb-card mb-card-portfolio">
            <div class="mb-card-mark"></div>
            <h3>${esc(c.n)}</h3>
            <p>${esc(c.d)}</p>
            <span class="mb-link">Read brief →</span>
          </article>`).join("")}
        </div>
      </section>`;
    case "operating-principles":
      return `<section id="principles" class="mb-section">
        <h2 class="mb-h2">Operating principles</h2>
        <div class="mb-grid mb-grid-2">
          ${[
            ["01", "Compound, don't spike.", "Every decision is judged on the 10-year version of itself."],
            ["02", "Operators over observers.", "We hire builders, not commentators."],
            ["03", "Calm capital.", "We rarely move fast and never move loud."],
            ["04", "Selective partnership.", "Most of what crosses our desk is a polite no."],
          ].map(([n, t, d]) => `<article class="mb-card mb-card-principle"><span class="mb-card-num">${esc(n)}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join("")}
        </div>
      </section>`;
    case "regions":
      return `<section id="regions" class="mb-section">
        <h2 class="mb-h2">Regions</h2>
        <div class="mb-region-grid">
          ${shuffle(["Stockholm", "Berlin", "London", "New York", "Singapore", "São Paulo", "Cape Town", "Tokyo", "Sydney", "Lisbon", "Toronto", "Dubai"], rnd).slice(0, 9).map((r) => `<div class="mb-region"><span class="mb-region-dot"></span>${esc(r)}</div>`).join("")}
        </div>
      </section>`;
    case "architecture":
      return `<section id="architecture" class="mb-section mb-architecture">
        <div>
          <h2 class="mb-h2">Architecture</h2>
          <p class="mb-sub">A shared operating layer underneath every portfolio company — finance, identity, hiring, infra — so each team can focus on the thing only they can do.</p>
        </div>
        <ol class="mb-stack">
          ${["Identity & access", "Finance & ledger", "Hiring & talent", "Observability", "Customer ops"].map((l, i) => `<li><span>0${i + 1}</span>${esc(l)}</li>`).join("")}
        </ol>
      </section>`;
    case "featured-roles":
      return `<section id="roles" class="mb-section">
        <h2 class="mb-h2">Featured roles</h2>
        <div class="mb-grid mb-grid-2">
          ${[
            { co: "North", role: "Senior Backend Engineer", loc: "Remote · EU", comp: "€95–130k" },
            { co: "Quill", role: "Lead Product Designer", loc: "Berlin · Hybrid", comp: "€110–140k" },
            { co: "Orbit", role: "Staff Platform Engineer", loc: "Remote · Global", comp: "$160–210k" },
            { co: "Field", role: "Founding GTM", loc: "London · Onsite", comp: "£90–120k + equity" },
          ].map((r) => `<article class="mb-card mb-card-role">
            <div class="mb-role-head"><span class="mb-co">${esc(r.co)}</span><span class="mb-tag">verified</span></div>
            <h3>${esc(r.role)}</h3>
            <div class="mb-role-meta"><span>${esc(r.loc)}</span><span>${esc(r.comp)}</span></div>
            <button type="button" class="mb-cta sm">Apply</button>
          </article>`).join("")}
        </div>
      </section>`;
    case "candidate-company-split":
      return `<section id="candidates" class="mb-section mb-split">
        <article class="mb-split-side">
          <h3>For candidates</h3>
          <p>Skill-matched roles, transparent comp, and one inbox for every conversation.</p>
          <ul class="mb-checklist"><li>Verified employers only</li><li>Comp shown upfront</li><li>One thread per role</li></ul>
          <button type="button" class="mb-cta">Find a role</button>
        </article>
        <article class="mb-split-side alt">
          <h3>For companies</h3>
          <p>Pre-screened candidates, structured interviews, and a hiring loop you can audit end-to-end.</p>
          <ul class="mb-checklist"><li>Skill-screened pipelines</li><li>Async interview kits</li><li>Hiring analytics</li></ul>
          <button type="button" class="mb-cta ghost">Post a role</button>
        </article>
      </section>`;
    case "trust-badges":
      return `<section id="trust" class="mb-section mb-badges">
        ${["SOC 2 Type II", "GDPR", "ISO 27001", "Verified payments", "Bias-checked"].map((b) => `<span class="mb-badge">${esc(b)}</span>`).join("")}
      </section>`;
    case "transaction-cards":
      return `<section id="transactions" class="mb-section">
        <h2 class="mb-h2 mono">Transactions</h2>
        <div class="mb-tx-list">
          ${[
            { co: "Stripe Inc.",   amt: "+$12,480.00", state: "settled" },
            { co: "Vercel",        amt: "−$842.10",    state: "pending" },
            { co: "AWS",           amt: "−$3,201.55",  state: "settled" },
            { co: "Customer 4012", amt: "+$980.00",    state: "settled" },
            { co: "Payroll",       amt: "−$48,200.00", state: "scheduled" },
          ].map((t) => `<div class="mb-tx ${t.state}"><span class="mb-tx-co">${esc(t.co)}</span><span class="mb-tx-state">${esc(t.state)}</span><span class="mb-tx-amt">${esc(t.amt)}</span></div>`).join("")}
        </div>
      </section>`;
    case "security-layer":
      return `<section id="security" class="mb-section mb-security">
        <h2 class="mb-h2">Security layer</h2>
        <div class="mb-grid mb-grid-3">
          ${[
            ["Encrypted at rest", "AES-256 across every record."],
            ["Audit-ready logs", "Every action signed & timestamped."],
            ["Role-based access", "Least-privilege by default."],
          ].map(([t, d]) => `<article class="mb-card mb-card-security"><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join("")}
        </div>
      </section>`;
    case "trust-graph":
      return `<section id="trust-graph" class="mb-section">
        <h2 class="mb-h2">Trust graph</h2>
        <p class="mb-sub">Every identity is the sum of its verifiable signals. We show the graph; you keep the keys.</p>
        <div class="mb-graph">
          ${[
            "Government ID", "Phone", "Email", "Domain", "Employer", "Bank", "Address", "Social",
          ].map((n, i) => `<span class="mb-graph-node n${i % 4}">${esc(n)}</span>`).join("")}
        </div>
      </section>`;
    case "compliance-cards":
      return `<section id="compliance" class="mb-section">
        <h2 class="mb-h2">Compliance</h2>
        <div class="mb-grid mb-grid-3">
          ${[
            ["KYC", "Document + biometric verification with liveness."],
            ["AML", "Continuous screening against 200+ sanctions lists."],
            ["GDPR / CCPA", "Per-record consent + audit trail by default."],
          ].map(([t, d]) => `<article class="mb-card"><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join("")}
        </div>
      </section>`;
    case "activity-timeline":
      return `<section id="activity" class="mb-section">
        <h2 class="mb-h2">Activity timeline</h2>
        <ol class="mb-timeline">
          ${[
            ["08:14", "Profile #4019 verified — confidence 0.98"],
            ["08:22", "Signal correlated: employer + bank match"],
            ["09:01", "Manual review escalated for #4022"],
            ["09:18", "Sanctions list refresh — 0 hits"],
          ].map(([t, w]) => `<li><span class="mb-time">${esc(t)}</span><span>${esc(w)}</span></li>`).join("")}
        </ol>
      </section>`;
    case "game-cards":
      return `<section id="games" class="mb-section">
        <h2 class="mb-h2 neon">Featured games</h2>
        <div class="mb-grid mb-grid-3">
          ${[
            ["Neon Drift",   "Arcade racer · 2–8 players"],
            ["Skyfall Ops",  "Tactical shooter · 5v5"],
            ["Lumen Quest",  "Co-op puzzle · 1–4 players"],
          ].map(([t, d]) => `<article class="mb-card mb-card-game"><div class="mb-card-mark"></div><h3>${esc(t)}</h3><p>${esc(d)}</p><button type="button" class="mb-cta sm neon">Play</button></article>`).join("")}
        </div>
      </section>`;
    case "leaderboard":
      return `<section id="leaderboard" class="mb-section">
        <h2 class="mb-h2 neon">Leaderboard</h2>
        <ol class="mb-leaderboard">
          ${[
            ["@nyx",     "12,402 pts"],
            ["@atlas",   "11,980 pts"],
            ["@vesper",  "11,510 pts"],
            ["@rune",    "10,884 pts"],
            ["@halcyon", "10,201 pts"],
          ].map(([h, s], i) => `<li><span class="mb-rank">#${i + 1}</span><span class="mb-handle">${esc(h)}</span><span class="mb-score">${esc(s)}</span></li>`).join("")}
        </ol>
      </section>`;
    case "community-cta":
      return `<section id="community" class="mb-section mb-cta-band neon">
        <h2 class="mb-h2 neon">Bring your squad.</h2>
        <p class="mb-sub">Free to join. Cross-platform. No spam, ever.</p>
        <button type="button" class="mb-cta neon">${esc(copy.primaryCta, 40)}</button>
      </section>`;
    case "feature-grid":
      return `<section id="features" class="mb-section">
        <h2 class="mb-h2">What ${esc(name, 60)} does</h2>
        <div class="mb-grid mb-grid-3">
          ${[
            ["Built with intent", `Tailored for the shape of ${name}.`],
            ["Designed for clarity", "Calm interfaces, fewer modals, sharper defaults."],
            ["Ready to evolve", "Each section is a real building block, not a placeholder."],
          ].map(([t, d], i) => `<article class="mb-card"><span class="mb-card-num">0${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join("")}
        </div>
      </section>`;
    case "pricing-tiers": {
      const tiers = shuffle([
        { n: "Starter",      p: "$0",   blurb: "For solo builders just getting traction.",   feats: ["1 workspace", "Community support", "Basic analytics"] },
        { n: "Team",         p: "$24",  blurb: "Small teams shipping every week.",            feats: ["Unlimited projects", "Priority support", "Audit log", "Roles"] },
        { n: "Scale",        p: "$98",  blurb: "Operating teams that need guarantees.",       feats: ["SSO + SCIM", "99.99% SLA", "Dedicated CSM", "Custom contracts"] },
      ], rnd);
      return `<section id="pricing" class="mb-section">
        <h2 class="mb-h2">Pricing</h2>
        <p class="mb-sub">Honest tiers. No surprise overages.</p>
        <div class="mb-grid mb-grid-3">
          ${tiers.map((t, i) => `<article class="mb-card mb-card-tier${i === 1 ? " featured" : ""}">
            <h3>${esc(t.n)}</h3>
            <div class="mb-tier-price">${esc(t.p)}<span>/mo</span></div>
            <p>${esc(t.blurb)}</p>
            <ul class="mb-checklist">${t.feats.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
            <button type="button" class="mb-cta sm">${esc(copy.primaryCta, 40)}</button>
          </article>`).join("")}
        </div>
      </section>`;
    }
    case "faq-accordion": {
      const faqs = shuffle([
        ["Is my data encrypted?", "Yes — AES-256 at rest, TLS 1.3 in transit, and per-tenant keys."],
        ["How do you handle exports?", "One-click CSV/JSON export from every table. No vendor lock-in."],
        ["Do you offer SSO?", "SAML SSO and SCIM provisioning are included on Scale and above."],
        ["What's your uptime?", "99.99% measured SLA with public status history."],
        ["Can I self-host?", "Self-hosted runtime is available for Scale customers under contract."],
        ["Is there a free trial?", "Yes — 14 days, full feature access, no credit card."],
      ], rnd).slice(0, 5);
      return `<section id="faq" class="mb-section">
        <h2 class="mb-h2">Frequently asked</h2>
        <div class="mb-faq">
          ${faqs.map(([q, a]) => `<details class="mb-faq-row"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
        </div>
      </section>`;
    }
    case "testimonial-wall": {
      const quotes = shuffle([
        { q: `${name} replaced four tools in our stack. We didn't expect that.`, a: "Lena V.", r: "VP Eng, Northwind" },
        { q: `The team ships like it's a personal project. Rare and great.`,    a: "Marcus T.", r: "Founder, Atlas" },
        { q: `Best onboarding I've done in years. We were live the same day.`,   a: "Priya R.", r: "Head of Ops, Quill" },
        { q: `Quiet, clear, and unreasonably reliable.`,                          a: "Jordan B.", r: "CTO, Field" },
        { q: `It feels like the product knows what we want before we do.`,        a: "Aiko S.",  r: "PM, Lumen" },
      ], rnd).slice(0, 3);
      return `<section id="testimonials" class="mb-section">
        <h2 class="mb-h2">Trusted by teams that ship</h2>
        <div class="mb-grid mb-grid-3">
          ${quotes.map((t) => `<figure class="mb-card mb-card-quote">
            <blockquote>“${esc(t.q)}”</blockquote>
            <figcaption><strong>${esc(t.a)}</strong><span>${esc(t.r)}</span></figcaption>
          </figure>`).join("")}
        </div>
      </section>`;
    }
    case "logo-strip": {
      const logos = shuffle(["northwind", "atlas", "quill", "field", "orbit", "lumen", "halo", "ember", "nyx"], rnd).slice(0, 6);
      return `<section class="mb-section mb-logos" aria-label="Customer logos">
        <p class="mb-logos-eyebrow">Trusted by teams at</p>
        <div class="mb-logos-row">${logos.map((l) => `<span class="mb-logo">${esc(l)}</span>`).join("")}</div>
      </section>`;
    }
    case "process-steps": {
      const steps = [
        ["01", "Connect", "Plug in your sources in under 5 minutes."],
        ["02", "Configure", "Pick the workflow that fits your team's shape."],
        ["03", "Operate", "Run, audit, and iterate without leaving the app."],
        ["04", "Improve", "Weekly insights point to the next compounding fix."],
      ];
      return `<section id="how-it-works" class="mb-section">
        <h2 class="mb-h2">How it works</h2>
        <ol class="mb-process">
          ${steps.map(([n, t, d]) => `<li><span class="mb-process-num">${esc(n)}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join("")}
        </ol>
      </section>`;
    }
    case "cta-band":
      return `<section class="mb-section mb-cta-band">
        <h2 class="mb-h2">${esc(`Ready to see ${name} in motion?`)}</h2>
        <p class="mb-sub">${esc(copy.lede, 240)}</p>
        <div class="mb-cta-row"><button type="button" class="mb-cta">${esc(copy.primaryCta, 40)}</button><button type="button" class="mb-cta ghost">${esc(copy.secondaryCta, 40)}</button></div>
      </section>`;
    case "footer":
      return `<footer class="mb-footer">
        <div><span class="mb-tag">${esc(archetype)}</span><span class="mb-tag">monster brain v1</span></div>
        <div>${esc(name, 60)} — generated by yawB</div>
      </footer>`;
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

function renderCss(theme: Theme & { _hue?: number }, archetype: Archetype, projectId: string): string {
  const hue = theme._hue ?? Math.abs(hash(projectId)) % 360;
  return `:root{
  --bg:${theme.bg};
  --surface:${theme.surface};
  --surface-2:${theme.surface2};
  --fg:${theme.fg};
  --muted:${theme.muted};
  --accent:${theme.accent};
  --accent-2:${theme.accent2};
  --ring:${theme.ring};
  --hue:${hue};
}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--fg);font-family:${theme.body};-webkit-font-smoothing:antialiased;line-height:1.5}
img{max-width:100%}
a{color:inherit;text-decoration:none}
.mb-shell{min-height:100vh;display:flex;flex-direction:column}
.mb-nav{display:flex;align-items:center;gap:24px;padding:18px 32px;border-bottom:1px solid color-mix(in oklab,var(--fg) 7%,transparent);position:sticky;top:0;background:color-mix(in oklab,var(--bg) 88%,transparent);backdrop-filter:saturate(140%) blur(8px);z-index:5}
.mb-brand{display:flex;align-items:center;gap:10px;font-family:${theme.display};font-weight:700;font-size:17px;letter-spacing:-.01em}
.mb-mark{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 0 24px var(--ring)}
.mb-nav-links{display:flex;gap:22px;color:var(--muted);font-size:13px;flex:1}
.mb-nav-links a:hover{color:var(--fg)}
.mb-nav-cta{background:var(--accent);color:#0a0a0a;border:0;padding:9px 16px;border-radius:999px;font-weight:600;font-size:13px;cursor:pointer;box-shadow:0 8px 24px -10px var(--ring)}
.mb-section{padding:72px 32px;max-width:1120px;margin:0 auto;width:100%}
.mb-hero{padding:96px 32px 72px;max-width:1120px;margin:0 auto;width:100%;position:relative;overflow:hidden}
.mb-eyebrow{display:inline-block;letter-spacing:.28em;text-transform:uppercase;font-size:11px;color:var(--accent);background:color-mix(in oklab,var(--accent) 14%,transparent);padding:6px 12px;border-radius:999px;margin-bottom:22px}
.mb-eyebrow.serif{font-family:${theme.display};letter-spacing:.18em;text-transform:none}
.mb-eyebrow.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase}
.mb-eyebrow.neon{box-shadow:0 0 20px var(--ring)}
.mb-title{font-family:${theme.display};font-size:clamp(40px,6vw,72px);line-height:1.04;letter-spacing:-.025em;margin:0 0 18px;background:linear-gradient(180deg,var(--fg),color-mix(in oklab,var(--fg) 60%,var(--accent)));-webkit-background-clip:text;background-clip:text;color:transparent}
.mb-title.serif{font-style:italic;font-weight:500}
.mb-title.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(34px,5vw,60px)}
.mb-title.neon{text-shadow:0 0 24px var(--ring)}
.mb-lede{color:var(--muted);font-size:clamp(15px,1.6vw,19px);max-width:680px;margin:0 0 28px}
.mb-cta-row{display:flex;gap:12px;flex-wrap:wrap}
.mb-cta{background:var(--accent);color:#0a0a0a;border:0;padding:12px 18px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;box-shadow:0 16px 40px -16px var(--ring);transition:transform .15s ease}
.mb-cta:hover{transform:translateY(-1px)}
.mb-cta.sm{padding:8px 12px;font-size:12.5px;border-radius:10px}
.mb-cta.ghost{background:transparent;color:var(--fg);border:1px solid color-mix(in oklab,var(--fg) 18%,transparent);box-shadow:none}
.mb-cta.neon{box-shadow:0 0 0 1px var(--accent),0 0 32px var(--ring)}
.mb-h2{font-family:${theme.display};font-size:clamp(24px,3vw,34px);letter-spacing:-.018em;margin:0 0 10px}
.mb-h2.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0}
.mb-h2.neon{text-shadow:0 0 18px var(--ring)}
.mb-sub{color:var(--muted);max-width:680px;margin:0 0 28px}
.mb-grid{display:grid;gap:16px}
.mb-grid-2{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.mb-grid-3{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.mb-card{background:var(--surface);border:1px solid color-mix(in oklab,var(--fg) 8%,transparent);border-radius:18px;padding:22px;display:flex;flex-direction:column;gap:8px;transition:transform .2s ease,border-color .2s ease}
.mb-card:hover{transform:translateY(-2px);border-color:color-mix(in oklab,var(--accent) 35%,transparent)}
.mb-card h3{font-family:${theme.display};font-size:17px;margin:6px 0 0;letter-spacing:-.005em}
.mb-card p{color:var(--muted);font-size:13.5px;margin:0}
.mb-card-num{font-family:${theme.display};color:var(--accent);font-size:24px;font-weight:700}
.mb-link{color:var(--accent);font-size:13px;font-weight:600}
.mb-card-mark{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 0 30px var(--ring);margin-bottom:6px}
.mb-tag{display:inline-block;font-size:10.5px;color:var(--muted);padding:3px 9px;border:1px solid color-mix(in oklab,var(--fg) 14%,transparent);border-radius:999px;margin-left:6px}

/* Search hero */
.mb-search{display:grid;grid-template-columns:1fr 180px auto;gap:8px;background:var(--surface);border:1px solid color-mix(in oklab,var(--fg) 10%,transparent);border-radius:16px;padding:8px;max-width:760px}
.mb-search input,.mb-search select{background:transparent;border:0;color:var(--fg);padding:12px 14px;font-size:14px;outline:none}
.mb-search button{background:var(--accent);color:#0a0a0a;border:0;border-radius:10px;padding:0 18px;font-weight:600;cursor:pointer}
.mb-pill-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px;color:var(--muted);font-size:12px}
.mb-pill-row span{padding:4px 10px;border:1px solid color-mix(in oklab,var(--fg) 12%,transparent);border-radius:999px}

/* Spotlight hero */
.mb-hero-spotlight .mb-spotlight-glow{position:absolute;inset:-20% -10% auto auto;width:60%;height:80%;background:radial-gradient(closest-side,color-mix(in oklab,var(--accent) 30%,transparent),transparent 70%);pointer-events:none;filter:blur(20px)}

/* Glass hero */
.mb-hero-glass{background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 6%,transparent),transparent 60%)}
.mb-hero-glass::after{content:"";position:absolute;inset:auto -40% -60% -40%;height:120%;background:radial-gradient(closest-side,color-mix(in oklab,var(--accent-2) 18%,transparent),transparent 60%);pointer-events:none}

/* Finance hero */
.mb-hero-finance{background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 8%,transparent),transparent 60%)}
.mb-ticker{margin-top:20px;display:flex;gap:24px;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);font-size:12.5px;border-top:1px dashed color-mix(in oklab,var(--fg) 14%,transparent);padding-top:12px}

/* Identity hero */
.mb-hero-identity::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 100% 0%,color-mix(in oklab,var(--accent) 18%,transparent),transparent 60%);pointer-events:none}

/* Gaming hero */
.mb-hero-gaming{background:radial-gradient(ellipse at top,color-mix(in oklab,var(--accent) 22%,transparent),transparent 60%)}
.neon{color:var(--accent)}

/* Feed */
.mb-feed{list-style:none;padding:0;margin:0;border:1px solid color-mix(in oklab,var(--fg) 8%,transparent);border-radius:18px;overflow:hidden;background:var(--surface)}
.mb-feed-row{display:grid;grid-template-columns:14px 110px 1fr;gap:12px;align-items:center;padding:14px 18px;border-top:1px solid color-mix(in oklab,var(--fg) 6%,transparent)}
.mb-feed-row:first-child{border-top:0}
.mb-feed-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px var(--ring)}
.mb-feed-when{color:var(--muted);font-size:12px;font-family:ui-monospace,monospace}
.mb-feed-what{font-size:14px}

/* Praise */
.mb-card-praise .mb-card-head{display:flex;align-items:center;gap:12px}
.mb-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));display:grid;place-items:center;color:#0a0a0a;font-weight:700}
.mb-card-praise .mb-card-foot{margin-top:auto}

/* Metrics */
.mb-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:18px;background:var(--surface);border:1px solid color-mix(in oklab,var(--fg) 8%,transparent);border-radius:20px;padding:24px}
.mb-metric{display:flex;flex-direction:column;gap:4px}
.mb-metric-value{font-family:${theme.display};font-size:28px;color:var(--fg);letter-spacing:-.01em}
.mb-metric-label{color:var(--muted);font-size:12.5px;text-transform:uppercase;letter-spacing:.16em}

/* Trust */
.mb-trust{display:grid;grid-template-columns:1.4fr 1fr;gap:24px;align-items:start}
.mb-checklist{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:8px;color:var(--muted);font-size:14px}
.mb-checklist li::before{content:"✓ ";color:var(--accent);font-weight:700;margin-right:6px}
.mb-trust-aside{background:var(--surface);border:1px solid color-mix(in oklab,var(--fg) 8%,transparent);border-radius:20px;padding:24px;display:grid;place-items:center;min-height:160px}
.mb-trust-stat{display:flex;flex-direction:column;align-items:center;gap:6px}

/* Portfolio */
.mb-card-portfolio h3{font-size:18px}
.mb-card-principle .mb-card-num{font-style:italic}
.mb-region-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.mb-region{display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--surface);border:1px solid color-mix(in oklab,var(--fg) 8%,transparent);border-radius:12px}
.mb-region-dot{width:8px;height:8px;border-radius:50%;background:var(--accent-2)}
.mb-architecture{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
.mb-stack{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.mb-stack li{display:flex;gap:14px;align-items:center;padding:14px 18px;background:var(--surface);border:1px solid color-mix(in oklab,var(--fg) 8%,transparent);border-radius:12px}
.mb-stack li span{color:var(--accent);font-family:ui-monospace,monospace;font-size:12px}

/* Roles */
.mb-card-role .mb-role-head{display:flex;justify-content:space-between;align-items:center}
.mb-co{font-family:${theme.display};font-weight:700}
.mb-role-meta{display:flex;justify-content:space-between;color:var(--muted);font-size:12.5px;margin:6px 0 12px}

/* Split */
.mb-split{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding-top:32px}
.mb-split-side{background:var(--surface);border:1px solid color-mix(in oklab,var(--fg) 8%,transparent);border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:10px}
.mb-split-side.alt{background:linear-gradient(180deg,var(--surface-2),var(--surface))}

/* Badges */
.mb-badges{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.mb-badge{padding:8px 14px;border:1px solid color-mix(in oklab,var(--fg) 14%,transparent);border-radius:999px;color:var(--muted);font-size:12.5px;background:var(--surface)}

/* Transactions */
.mb-tx-list{display:grid;gap:8px;font-family:ui-monospace,monospace}
.mb-tx{display:grid;grid-template-columns:1fr 100px 140px;gap:8px;padding:14px 18px;background:var(--surface);border:1px solid color-mix(in oklab,var(--fg) 8%,transparent);border-radius:12px;font-size:13px}
.mb-tx-state{color:var(--muted);text-transform:uppercase;letter-spacing:.16em;font-size:11px}
.mb-tx.pending .mb-tx-state{color:var(--accent)}
.mb-tx-amt{text-align:right;color:var(--fg)}

/* Trust graph */
.mb-graph{display:flex;flex-wrap:wrap;gap:10px}
.mb-graph-node{padding:10px 14px;border-radius:999px;background:var(--surface);border:1px solid color-mix(in oklab,var(--accent) 30%,transparent);font-size:13px}
.mb-graph-node.n1{background:color-mix(in oklab,var(--accent) 12%,var(--surface))}
.mb-graph-node.n2{background:color-mix(in oklab,var(--accent-2) 14%,var(--surface))}
.mb-graph-node.n3{border-color:color-mix(in oklab,var(--accent-2) 40%,transparent)}

/* Timeline */
.mb-timeline{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.mb-timeline li{display:grid;grid-template-columns:80px 1fr;gap:14px;padding:12px 18px;background:var(--surface);border-left:3px solid var(--accent);border-radius:8px;font-size:13.5px}
.mb-time{color:var(--muted);font-family:ui-monospace,monospace}

/* Leaderboard */
.mb-leaderboard{list-style:none;padding:0;margin:0;display:grid;gap:6px}
.mb-leaderboard li{display:grid;grid-template-columns:60px 1fr 120px;gap:8px;padding:14px 18px;background:var(--surface);border:1px solid color-mix(in oklab,var(--fg) 8%,transparent);border-radius:12px}
.mb-rank{color:var(--accent);font-weight:700}
.mb-handle{font-family:${theme.display}}
.mb-score{text-align:right;color:var(--muted);font-family:ui-monospace,monospace}

/* CTA band */
.mb-cta-band{text-align:center;background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 8%,transparent),transparent 70%);border-radius:24px;padding:64px 24px;margin:48px auto;max-width:1120px}
.mb-cta-band.neon{box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--accent) 40%,transparent)}
.mb-cta-band .mb-cta-row{justify-content:center}

/* Pricing */
.mb-card-tier{gap:12px}
.mb-card-tier.featured{border-color:color-mix(in oklab,var(--accent) 60%,transparent);box-shadow:0 24px 60px -28px var(--ring)}
.mb-tier-price{font-family:${theme.display};font-size:38px;color:var(--fg);letter-spacing:-.02em}
.mb-tier-price span{font-size:13px;color:var(--muted);margin-left:4px}

/* FAQ */
.mb-faq{display:grid;gap:8px}
.mb-faq-row{background:var(--surface);border:1px solid color-mix(in oklab,var(--fg) 8%,transparent);border-radius:12px;padding:14px 18px}
.mb-faq-row summary{cursor:pointer;font-weight:600;list-style:none}
.mb-faq-row summary::-webkit-details-marker{display:none}
.mb-faq-row[open] summary{color:var(--accent)}
.mb-faq-row p{color:var(--muted);font-size:13.5px;margin:8px 0 0}

/* Testimonial wall */
.mb-card-quote blockquote{margin:0 0 12px;font-family:${theme.display};font-size:17px;line-height:1.4;color:var(--fg)}
.mb-card-quote figcaption{display:flex;flex-direction:column;color:var(--muted);font-size:12.5px}
.mb-card-quote figcaption strong{color:var(--fg);font-weight:600;font-size:13px}

/* Logos */
.mb-logos{text-align:center;padding-top:24px;padding-bottom:24px}
.mb-logos-eyebrow{color:var(--muted);text-transform:uppercase;letter-spacing:.22em;font-size:11px;margin:0 0 18px}
.mb-logos-row{display:flex;flex-wrap:wrap;justify-content:center;gap:32px;color:var(--muted);font-family:${theme.display};font-size:18px;letter-spacing:.04em;opacity:.7}
.mb-logo{padding:6px 0;text-transform:lowercase}

/* Process */
.mb-process{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.mb-process li{display:flex;gap:14px;background:var(--surface);border:1px solid color-mix(in oklab,var(--fg) 8%,transparent);border-radius:14px;padding:18px}
.mb-process-num{font-family:${theme.display};color:var(--accent);font-size:22px;font-weight:700}
.mb-process h3{margin:0 0 4px;font-size:15px}
.mb-process p{color:var(--muted);font-size:13px;margin:0}

/* Footer */
.mb-footer{margin-top:auto;padding:24px 32px;color:var(--muted);font-size:12px;border-top:1px solid color-mix(in oklab,var(--fg) 8%,transparent);display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}

/* Responsive */
@media (max-width: 760px){
  .mb-trust,.mb-architecture,.mb-split{grid-template-columns:1fr}
  .mb-search{grid-template-columns:1fr}
  .mb-tx{grid-template-columns:1fr 80px 110px}
  .mb-nav-links{display:none}
}
${archetypeFlair(archetype)}
`;
}

function archetypeFlair(archetype: Archetype): string {
  switch (archetype) {
    case "social-good":
      return `.mb-card-praise{background:linear-gradient(180deg,var(--surface),var(--surface-2))}`;
    case "corporate":
      return `.mb-card-portfolio{border-radius:14px}.mb-card-portfolio h3{font-style:italic;font-weight:500}`;
    case "jobs":
      return `.mb-card-role{border-left:3px solid var(--accent)}`;
    case "fintech":
      return `.mb-card-security{font-family:ui-monospace,monospace}.mb-card-security h3{font-family:${THEMES_DISPLAY_INTER}}`;
    case "identity":
      return `.mb-graph-node{font-family:ui-monospace,monospace;letter-spacing:.04em}`;
    case "gaming":
      return `.mb-card-game{background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 8%,var(--surface)),var(--surface))}`;
    case "portfolio":
      return `.mb-title{text-transform:uppercase;letter-spacing:-.04em}`;
    default:
      return "";
  }
}

// Used inside template literal in archetypeFlair
const THEMES_DISPLAY_INTER = `"Inter", system-ui, sans-serif`;

// ---------------------------------------------------------------------------
// JS (tiny, progressive enhancement only — sandbox blocks scripts in Local
// Preview srcDoc, but we still emit a real file for hosted previews.)
// ---------------------------------------------------------------------------

function renderJs(name: string, archetype: Archetype): string {
  return `// ${name} — ${archetype} (monster brain v1)
(function(){
  function ready(fn){ if(document.readyState!=='loading'){fn();} else {document.addEventListener('DOMContentLoaded',fn);} }
  ready(function(){
    document.querySelectorAll('a[href^="#"]').forEach(function(a){
      a.addEventListener('click', function(e){
        var id=a.getAttribute('href').slice(1);
        var el=id?document.getElementById(id):null;
        if(el){ e.preventDefault(); el.scrollIntoView({behavior:'smooth',block:'start'}); }
      });
    });
    var observer = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('mb-in'); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.mb-section, .mb-hero, .mb-card').forEach(function(el){ observer.observe(el); });
  });
})();
`;
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function renderHtml(blueprint: Blueprint, project: ProjectLike, seedBasis: string): string {
  const name = (project.name ?? "Untitled").trim() || "Untitled";
  const safeName = esc(name, 200);
  const safeArchetype = esc(blueprint.archetype, 40);
  const css = renderCss(blueprint.theme as Theme & { _hue?: number }, blueprint.archetype, seedBasis);
  const sectionsHtml = blueprint.sections
    .map((k) => k.startsWith("hero-") ? renderHero(k, name, blueprint.copy) : renderSection(k, name, blueprint.copy, blueprint.archetype, seedBasis))
    .join("\n      ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" />
    <meta name="referrer" content="no-referrer" />
    <meta name="generator" content="yawb monster-brain v1 (${safeArchetype})" />
    <title>${safeName}</title>
    <style>${css}</style>
  </head>
  <body>
    <div class="mb-shell">
      ${renderNav(name, blueprint.copy)}
      ${sectionsHtml}
    </div>
  </body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const HERO_VARIANTS: Record<Archetype, SectionKey[]> = {
  "social-good": ["hero-spotlight", "hero-glass", "hero-default"],
  corporate:     ["hero-glass", "hero-spotlight", "hero-default"],
  jobs:          ["hero-search", "hero-default", "hero-spotlight"],
  fintech:       ["hero-finance", "hero-default", "hero-glass"],
  identity:      ["hero-identity", "hero-spotlight", "hero-default"],
  gaming:        ["hero-gaming", "hero-spotlight", "hero-default"],
  saas:          ["hero-default", "hero-glass", "hero-spotlight"],
  portfolio:     ["hero-spotlight", "hero-default", "hero-glass"],
  marketplace:   ["hero-search", "hero-spotlight", "hero-default"],
  default:       ["hero-default", "hero-spotlight", "hero-glass"],
};

/** Apply seed-driven variance: swap hero variant + shuffle middle sections. */
function applyVariance(
  base: SectionKey[],
  archetype: Archetype,
  seedBasis: string,
  active: boolean,
): SectionKey[] {
  if (!active) return base;
  const rnd = rngFor(`sections:${seedBasis}`);
  const heroOptions = HERO_VARIANTS[archetype] ?? HERO_VARIANTS.default;
  const newHero = heroOptions[Math.floor(rnd() * heroOptions.length)];
  // Keep first slot if it's a hero, last slot (footer), and CTA band order;
  // shuffle the rest.
  const head: SectionKey[] = base[0]?.startsWith("hero-") ? [newHero] : [];
  const tailIdx = base.length - 1;
  const tail: SectionKey[] = base[tailIdx] === "footer" ? ["footer"] : [];
  const middle = base.slice(head.length, tail.length ? tailIdx : base.length);
  const shuffled = shuffle(middle, rnd);
  return [...head, ...shuffled, ...tail];
}

export function designSignature(
  project: ProjectLike,
  archetype: Archetype,
  context?: MonsterBrainContext | null,
): string {
  const seedBasis = buildSeedBasis(project, context);
  const hue = Math.abs(hash(seedBasis)) % 360;
  const variant = variantIndex(seedBasis);
  const seedTag = context?.regenerationSeed
    ? `:seed${Math.abs(hash(context.regenerationSeed)).toString(36).slice(0, 6)}`
    : "";
  const slug = (project.name ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  return `mb-v1:${archetype}:hue${hue}:variant-${variant}${seedTag}:${slug}`;
}

export function generateProjectFiles(
  project: ProjectLike,
  context?: MonsterBrainContext | null,
): GeneratedProjectFile[] {
  const archetype = inferProjectArchetype(project, context ?? null);
  const seedBasis = buildSeedBasis(project, context);
  const baseTheme = baseThemeFor(archetype);
  const theme = shiftedTheme(baseTheme, seedBasis);
  const copy = copyFor(archetype, project);
  const baseSections = sectionsFor(archetype);
  const variance = Boolean(context?.regenerationSeed) || Boolean(context?.forceVariant);
  const sections = applyVariance(baseSections, archetype, seedBasis, variance);
  const blueprint: Blueprint = { archetype, theme, copy, sections };

  const html = renderHtml(blueprint, project, seedBasis);
  const css = renderCss(theme as Theme & { _hue?: number }, archetype, seedBasis);
  const js = renderJs(project.name ?? "Untitled", archetype);

  return [
    { path: "app.css",    content: css,  language: "css",        kind: "source" },
    { path: "app.js",     content: js,   language: "javascript", kind: "source" },
    { path: "index.html", content: html, language: "html",       kind: "source" },
  ];
}

// ---------------------------------------------------------------------------
// AI swap-in surface
// ---------------------------------------------------------------------------

export interface ProjectGenerator {
  generate(project: ProjectLike, context?: MonsterBrainContext | null): Promise<GeneratedProjectFile[]> | GeneratedProjectFile[];
}

export const deterministicGenerator: ProjectGenerator = {
  generate: (p, c) => generateProjectFiles(p, c ?? null),
};
