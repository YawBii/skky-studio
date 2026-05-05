import type { MonsterBlueprint } from "./monster-blueprint";

export interface MonsterDesignBrief {
  version: "monster-design-brief-v1";
  productCategory: string;
  targetUser: string;
  brandFeel: string;
  layoutDirection: string;
  navigationPattern: "left-rail" | "top-nav" | "split-pane" | "tabbed-shell" | "sidebar-stack";
  typographyPairing: { display: string; body: string };
  colorPalette: { name: string; bg: string; surface: string; ink: string; accent: string; accent2: string };
  interactionStyle: string;
  spacingRhythm: "tight" | "balanced" | "airy";
  cardStyle: "glass" | "paper" | "neumorphic" | "outline" | "stamp";
  heroComposition: string;
  keyScreens: string[];
  varianceSeed: string;
}

const PALETTES: MonsterDesignBrief["colorPalette"][] = [
  { name: "Counsel Oxblood", bg: "#120f0a", surface: "#f4ebd8", ink: "#211814", accent: "#9b2f19", accent2: "#d7a84d" },
  { name: "Trust Aqua", bg: "#06131e", surface: "#e9f7ff", ink: "#06131e", accent: "#0ea5b7", accent2: "#6ee7b7" },
  { name: "Ledger Forest", bg: "#07110d", surface: "#ecfff6", ink: "#07110d", accent: "#0f9f6e", accent2: "#d7ff62" },
  { name: "Bazaar Citrus", bg: "#130d1d", surface: "#fff4e7", ink: "#281529", accent: "#f97316", accent2: "#8b5cf6" },
  { name: "Studio Indigo", bg: "#080b12", surface: "#edf2ff", ink: "#0b1020", accent: "#4f46e5", accent2: "#06b6d4" },
  { name: "Hearth Rose", bg: "#1a0f12", surface: "#fff1ec", ink: "#2a131a", accent: "#e11d48", accent2: "#fb923c" },
  { name: "Clinic Mint", bg: "#0a1410", surface: "#f1fff8", ink: "#0a1410", accent: "#14b8a6", accent2: "#a7f3d0" },
];

const PAIRINGS: MonsterDesignBrief["typographyPairing"][] = [
  { display: "Fraunces, Georgia, serif", body: "Inter, system-ui, sans-serif" },
  { display: "Space Grotesk, sans-serif", body: "Inter, system-ui, sans-serif" },
  { display: "DM Serif Display, serif", body: "DM Sans, system-ui, sans-serif" },
  { display: "Manrope, sans-serif", body: "Manrope, system-ui, sans-serif" },
  { display: "Playfair Display, serif", body: "Source Sans 3, system-ui, sans-serif" },
];

const NAV: MonsterDesignBrief["navigationPattern"][] = [
  "left-rail",
  "top-nav",
  "split-pane",
  "tabbed-shell",
  "sidebar-stack",
];
const CARDS: MonsterDesignBrief["cardStyle"][] = ["glass", "paper", "neumorphic", "outline", "stamp"];
const SPACE: MonsterDesignBrief["spacingRhythm"][] = ["tight", "balanced", "airy"];

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(arr: readonly T[], seed: number, salt: number): T {
  return arr[(seed + salt) % arr.length];
}

function categoryFor(blueprint: MonsterBlueprint): {
  category: string;
  user: string;
  feel: string;
  layout: string;
  hero: string;
  interaction: string;
  screens: string[];
} {
  const t = `${blueprint.appType} ${blueprint.prompt} ${blueprint.summary}`.toLowerCase();
  if (/law|legal|firm|case|attorney/.test(t))
    return {
      category: "legal-operations",
      user: "lawyers managing matters and clients",
      feel: "authoritative, editorial, trustworthy",
      layout: "case-cockpit with matter timeline + document vault",
      hero: "matter pipeline overview with status, billable hours, and client signals",
      interaction: "keyboard-first, calm motion, document-centric",
      screens: ["Matter board", "Client intake", "Document vault", "Billing & time", "Compliance log"],
    };
  if (/family|child|household|parent|life/.test(t))
    return {
      category: "family-life",
      user: "households coordinating routines, kids, and shared tasks",
      feel: "warm, friendly, reassuring",
      layout: "shared timeline + chore board + check-ins",
      hero: "today view: who is doing what, next handoff, mood check",
      interaction: "tap-friendly, soft animations, large affordances",
      screens: ["Today", "Chore board", "Calendar", "Wallet & allowance", "Memories"],
    };
  if (/booking|appointment|reservation|calendar|schedule/.test(t))
    return {
      category: "booking-platform",
      user: "providers and customers scheduling time",
      feel: "clear, confident, fast",
      layout: "availability grid + provider cards + cart",
      hero: "find a slot in two clicks; provider availability rail",
      interaction: "one-hand tap flow with confirmation toasts",
      screens: ["Find a slot", "Provider profile", "Confirm booking", "My bookings", "Provider dashboard"],
    };
  if (/finance|invoice|ledger|payment|billing|wallet|bank/.test(t))
    return {
      category: "finance",
      user: "operators tracking money and approvals",
      feel: "precise, dense, trustworthy",
      layout: "dual-pane ledger + approvals queue",
      hero: "cash position, today's movements, exceptions to approve",
      interaction: "dense table interactions, keyboard navigation, audit drill-down",
      screens: ["Cash position", "Approvals", "Ledger", "Invoices", "Audit log"],
    };
  if (/market|listing|seller|buyer|shop/.test(t))
    return {
      category: "marketplace",
      user: "buyers discovering and sellers managing inventory",
      feel: "lively, curated, image-led",
      layout: "discover grid + seller studio split",
      hero: "trending categories, featured drops, search-first",
      interaction: "swipeable cards, fast filters, optimistic actions",
      screens: ["Discover", "Listing detail", "Cart & checkout", "Seller studio", "Orders"],
    };
  if (/job|hire|candidate|recruit|talent/.test(t))
    return {
      category: "jobs-platform",
      user: "candidates applying and recruiters reviewing",
      feel: "energetic, clear, pragmatic",
      layout: "swipeable job feed + applicant pipeline",
      hero: "matched roles, application status, recruiter inbox",
      interaction: "quick-apply, status pills, threaded messages",
      screens: ["Job feed", "Apply flow", "Application status", "Recruiter inbox", "Pipeline"],
    };
  if (/health|clinic|patient|wellness/.test(t))
    return {
      category: "healthcare",
      user: "clinicians and patients tracking care",
      feel: "calm, careful, accessible",
      layout: "patient timeline + visit notes + tasks",
      hero: "today's patients, alerts, follow-ups",
      interaction: "form-driven, large hit targets, clear status colors",
      screens: ["Patient list", "Visit notes", "Tasks", "Messages", "Reports"],
    };
  return {
    category: "custom-product",
    user: "operators using a tailored workflow",
    feel: "premium, specific, opinionated",
    layout: "command center + workflow surface",
    hero: "primary metric, next action, recent activity",
    interaction: "responsive, focused, low-noise",
    screens: ["Dashboard", "Records", "Detail", "Settings", "Audit"],
  };
}

export function generateMonsterDesignBrief(
  blueprint: MonsterBlueprint,
  varianceSeed = "",
): MonsterDesignBrief {
  const seed = hash(`${blueprint.appName}|${blueprint.appType}|${varianceSeed}`);
  const meta = categoryFor(blueprint);
  return {
    version: "monster-design-brief-v1",
    productCategory: meta.category,
    targetUser: meta.user,
    brandFeel: meta.feel,
    layoutDirection: meta.layout,
    navigationPattern: pick(NAV, seed, 1),
    typographyPairing: pick(PAIRINGS, seed, 2),
    colorPalette: pick(PALETTES, seed, 3),
    interactionStyle: meta.interaction,
    spacingRhythm: pick(SPACE, seed, 4),
    cardStyle: pick(CARDS, seed, 5),
    heroComposition: meta.hero,
    keyScreens: meta.screens,
    varianceSeed: String(seed),
  };
}

export function summarizeDesignBrief(brief: MonsterDesignBrief): string {
  return [
    `${brief.productCategory} for ${brief.targetUser}`,
    `${brief.brandFeel}`,
    `nav ${brief.navigationPattern}, cards ${brief.cardStyle}, ${brief.spacingRhythm} spacing`,
    `palette ${brief.colorPalette.name}`,
    `type ${brief.typographyPairing.display.split(",")[0]} / ${brief.typographyPairing.body.split(",")[0]}`,
  ].join(" · ");
}
