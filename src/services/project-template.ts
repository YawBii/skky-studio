// Deterministic per-project HTML/CSS generator.
//
// PURPOSE: every project must look DIFFERENT in Local Preview. Picking a
// generic placeholder is what made yawB feel like a one-template tool.
//
// SWAP HOOK: the public surface is `generateProjectFiles(input): GeneratedFile[]`.
// A future AI generator (Lovable AI Gateway) can implement the same shape and
// be swapped in behind the scenes — PreviewPane and project_files do not change.

import type { Project } from "@/services/projects";

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  kind: "source" | "asset";
}

export interface GenerateInput {
  project: Pick<Project, "id" | "name" | "description">;
  /** Optional last user chat message — lets the generator hint at intent. */
  chatRequest?: string | null;
}

export type ProjectCategory =
  | "scanner"
  | "marketplace"
  | "portfolio"
  | "directory"
  | "studio"
  | "saas"
  | "generic";

interface Theme {
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  accent: string;
  accent2: string;
  font: string;
  display: string;
  eyebrow: string;
  cta: string;
  hero: string;
  bullets: string[];
}

// ---------- Category detection (deterministic, keyword-based) ----------

const CATEGORY_KEYWORDS: Array<{ cat: ProjectCategory; words: RegExp }> = [
  { cat: "scanner",     words: /\b(goodhand|scan|scanner|discover|discovery|safety|review|audit|verify|trust|good)\b/i },
  { cat: "marketplace", words: /\b(job|jobs|gig|gigs|hire|hiring|market|marketplace|listing|listings|freelance|work|ujob|career|careers)\b/i },
  { cat: "portfolio",   words: /\b(portfolio|holding|holdings|group|ventures|capital|fund|skky|skkygroup|infrastructure|corporate)\b/i },
  { cat: "directory",   words: /\b(directory|index|catalog|profiles|profile|people|community|leaders|influencers|popular|lastman)\b/i },
  { cat: "studio",      words: /\b(studio|design|creative|gallery|art|brand|agency|skkylab|lab)\b/i },
  { cat: "saas",        words: /\b(saas|dashboard|analytics|metrics|crm|admin|platform|workspace|si4|tool|ops)\b/i },
];

export function detectCategory(input: { name: string; description?: string | null; chatRequest?: string | null }): ProjectCategory {
  const hay = `${input.name ?? ""} ${input.description ?? ""} ${input.chatRequest ?? ""}`;
  for (const k of CATEGORY_KEYWORDS) {
    if (k.words.test(hay)) return k.cat;
  }
  return "generic";
}

// ---------- Per-category themes ----------

const THEMES: Record<ProjectCategory, Theme> = {
  scanner: {
    bg: "#06120c", surface: "#0d1f17", fg: "#e8fff3", muted: "#7fa893",
    accent: "#3ddc84", accent2: "#a3f7bf",
    font: '"Inter", system-ui, sans-serif',
    display: '"Space Grotesk", "Inter", sans-serif',
    eyebrow: "Discovery & trust",
    cta: "Scan a profile",
    hero: "See who actually shows up for the community.",
    bullets: ["Verified contributions", "Reputation signals", "Public-good index"],
  },
  marketplace: {
    bg: "#0a0e1a", surface: "#121a30", fg: "#f1f4ff", muted: "#8c95b3",
    accent: "#ffb547", accent2: "#5b8cff",
    font: '"Inter", system-ui, sans-serif',
    display: '"Plus Jakarta Sans", "Inter", sans-serif',
    eyebrow: "Open opportunities",
    cta: "Post a role",
    hero: "Hire faster. Get hired smarter.",
    bullets: ["Verified employers", "Skill-matched candidates", "Live conversations"],
  },
  portfolio: {
    bg: "#0b0b0f", surface: "#15151c", fg: "#f5f5f7", muted: "#9a9aa6",
    accent: "#d4af37", accent2: "#e9d691",
    font: '"Inter", system-ui, sans-serif',
    display: '"Playfair Display", Georgia, serif',
    eyebrow: "Group & ventures",
    cta: "Explore the group",
    hero: "Quietly building infrastructure that compounds.",
    bullets: ["Long-horizon capital", "Operational craft", "Selective partnerships"],
  },
  directory: {
    bg: "#0f0a14", surface: "#1c1326", fg: "#f7f1ff", muted: "#a59ab8",
    accent: "#c084fc", accent2: "#ff7ab6",
    font: '"Inter", system-ui, sans-serif',
    display: '"Fraunces", Georgia, serif',
    eyebrow: "People worth knowing",
    cta: "Browse profiles",
    hero: "A living directory of the people shaping the conversation.",
    bullets: ["Curated bios", "Influence & reach", "Cited sources"],
  },
  studio: {
    bg: "#0a0a0a", surface: "#161616", fg: "#fafafa", muted: "#9a9a9a",
    accent: "#ff5e3a", accent2: "#ffd6c2",
    font: '"Inter", system-ui, sans-serif',
    display: '"Bricolage Grotesque", "Inter", sans-serif',
    eyebrow: "Independent studio",
    cta: "See selected work",
    hero: "Sharp ideas, made tangible.",
    bullets: ["Brand systems", "Product storytelling", "Launch craft"],
  },
  saas: {
    bg: "#070b14", surface: "#0f1626", fg: "#eef3ff", muted: "#7d8aa6",
    accent: "#5cf2c8", accent2: "#7c9cff",
    font: '"Inter", system-ui, sans-serif',
    display: '"JetBrains Mono", "Inter", monospace',
    eyebrow: "Operations platform",
    cta: "Open the dashboard",
    hero: "Run the boring parts of the business on autopilot.",
    bullets: ["Realtime metrics", "Role-aware controls", "Audit-ready logs"],
  },
  generic: {
    bg: "#0b0f14", surface: "#141a22", fg: "#e6edf3", muted: "#8b96a7",
    accent: "#7c9cff", accent2: "#c8d4ff",
    font: '"Inter", system-ui, sans-serif',
    display: '"Inter", system-ui, sans-serif',
    eyebrow: "Project preview",
    cta: "Get started",
    hero: "A new product is taking shape here.",
    bullets: ["Built with intent", "Designed for clarity", "Ready to ship"],
  },
};

// ---------- Strict text sanitizer (HTML-safe interpolation) ----------

function esc(value: unknown, maxLen = 500): string {
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

// ---------- Public API ----------

export function generateProjectFiles(input: GenerateInput): GeneratedFile[] {
  const name = (input.project.name ?? "").trim() || "Untitled";
  const description = (input.project.description ?? "").trim();
  const category = detectCategory({ name, description, chatRequest: input.chatRequest ?? null });
  const theme = THEMES[category];

  const css = renderCss(theme, category, input.project.id);
  const html = renderHtml({
    name, description, category, theme, hasCss: true,
  });

  return [
    { path: "app.css",    content: css,  language: "css",  kind: "source" },
    { path: "index.html", content: html, language: "html", kind: "source" },
  ];
}

function renderCss(theme: Theme, category: ProjectCategory, projectId: string): string {
  // Tiny per-project hue shift so even same-category projects look distinct.
  const hue = Math.abs(hashCode(projectId)) % 360;
  return `:root{
  --bg:${theme.bg};
  --surface:${theme.surface};
  --fg:${theme.fg};
  --muted:${theme.muted};
  --accent:${theme.accent};
  --accent-2:${theme.accent2};
  --hue:${hue};
}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--fg);font-family:${theme.font};-webkit-font-smoothing:antialiased}
.shell{min-height:100vh;display:flex;flex-direction:column}
.nav{display:flex;align-items:center;justify-content:space-between;padding:20px 32px;border-bottom:1px solid color-mix(in oklab,var(--fg) 8%,transparent)}
.brand{font-family:${theme.display};font-weight:700;letter-spacing:-.01em;font-size:18px;display:flex;align-items:center;gap:10px}
.brand-mark{width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 0 24px color-mix(in oklab,var(--accent) 50%,transparent)}
.nav-links{display:flex;gap:22px;color:var(--muted);font-size:13px}
.nav-cta{background:var(--accent);color:#0a0a0a;border:0;padding:8px 14px;border-radius:999px;font-weight:600;font-size:13px;cursor:pointer}
.hero{padding:96px 32px 64px;max-width:1080px;margin:0 auto;width:100%}
.eyebrow{display:inline-block;letter-spacing:.28em;text-transform:uppercase;font-size:11px;color:var(--accent);background:color-mix(in oklab,var(--accent) 14%,transparent);padding:6px 12px;border-radius:999px;margin-bottom:24px}
h1.title{font-family:${theme.display};font-size:clamp(40px,6vw,72px);line-height:1.02;letter-spacing:-.025em;margin:0 0 20px;background:linear-gradient(180deg,var(--fg),color-mix(in oklab,var(--fg) 70%,var(--accent)));-webkit-background-clip:text;background-clip:text;color:transparent}
p.lede{color:var(--muted);font-size:clamp(16px,2vw,20px);line-height:1.55;max-width:640px;margin:0 0 32px}
.cta-row{display:flex;gap:12px;flex-wrap:wrap}
.cta{background:var(--accent);color:#0a0a0a;border:0;padding:12px 18px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;box-shadow:0 10px 30px -12px color-mix(in oklab,var(--accent) 55%,transparent)}
.cta.ghost{background:transparent;color:var(--fg);border:1px solid color-mix(in oklab,var(--fg) 18%,transparent);box-shadow:none}
.grid{padding:32px;max-width:1080px;margin:0 auto;width:100%;display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.card{background:var(--surface);border:1px solid color-mix(in oklab,var(--fg) 8%,transparent);border-radius:18px;padding:22px;display:flex;flex-direction:column;gap:10px;transition:transform .2s ease,border-color .2s ease}
.card:hover{transform:translateY(-2px);border-color:color-mix(in oklab,var(--accent) 40%,transparent)}
.card-num{font-family:${theme.display};font-size:28px;color:var(--accent);font-weight:700}
.card-title{font-weight:600;font-size:15px}
.card-body{color:var(--muted);font-size:13.5px;line-height:1.5}
footer{margin-top:auto;padding:24px 32px;color:var(--muted);font-size:12px;border-top:1px solid color-mix(in oklab,var(--fg) 8%,transparent);display:flex;justify-content:space-between}
.tag{display:inline-block;font-size:11px;color:var(--muted);padding:4px 10px;border:1px solid color-mix(in oklab,var(--fg) 14%,transparent);border-radius:999px;margin-right:6px}
${categoryFlair(category)}
`;
}

function categoryFlair(c: ProjectCategory): string {
  switch (c) {
    case "scanner":
      return `.hero::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 80% 0%,color-mix(in oklab,var(--accent) 25%,transparent),transparent 60%);pointer-events:none}
.hero{position:relative}`;
    case "marketplace":
      return `.grid .card:nth-child(odd){border-left:3px solid var(--accent)}`;
    case "portfolio":
      return `h1.title{font-style:italic;font-weight:500}`;
    case "directory":
      return `.card{border-radius:24px}.card-num{font-style:italic}`;
    case "studio":
      return `h1.title{text-transform:uppercase;letter-spacing:-.04em}`;
    case "saas":
      return `.card{font-family:${THEMES.saas.display}}.card-title{font-family:${THEMES.saas.font}}`;
    default:
      return "";
  }
}

function renderHtml(input: {
  name: string;
  description: string;
  category: ProjectCategory;
  theme: Theme;
  hasCss: boolean;
}): string {
  const { name, description, theme, category } = input;
  const safeName = esc(name, 200);
  const safeDesc = esc(description || theme.hero, 500);
  const safeCat = esc(category, 40);
  const cards = theme.bullets
    .map(
      (b, i) => `<article class="card">
        <div class="card-num">0${i + 1}</div>
        <div class="card-title">${esc(b, 80)}</div>
        <div class="card-body">${esc(`Built specifically for ${name}.`, 160)}</div>
      </article>`,
    )
    .join("\n      ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" />
    <meta name="referrer" content="no-referrer" />
    <meta name="generator" content="yawB local generator (${safeCat})" />
    <title>${safeName}</title>
    <style>${renderCss(theme, category, "")}</style>
  </head>
  <body>
    <div class="shell">
      <nav class="nav">
        <div class="brand"><span class="brand-mark"></span>${safeName}</div>
        <div class="nav-links"><span>Overview</span><span>Why</span><span>Contact</span></div>
        <button type="button" class="nav-cta">${esc(theme.cta, 40)}</button>
      </nav>
      <section class="hero">
        <span class="eyebrow">${esc(theme.eyebrow, 60)}</span>
        <h1 class="title">${safeName}</h1>
        <p class="lede">${safeDesc}</p>
        <div class="cta-row">
          <button type="button" class="cta">${esc(theme.cta, 40)}</button>
          <button type="button" class="cta ghost">Learn more</button>
        </div>
      </section>
      <section class="grid">
      ${cards}
      </section>
      <footer>
        <span><span class="tag">${safeCat}</span><span class="tag">local preview</span></span>
        <span>Generated by yawB</span>
      </footer>
    </div>
  </body>
</html>`;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

// ---------- Future AI swap-in surface ----------

export interface ProjectGenerator {
  generate(input: GenerateInput): Promise<GeneratedFile[]> | GeneratedFile[];
}

export const deterministicGenerator: ProjectGenerator = {
  generate: (input) => generateProjectFiles(input),
};
