// Server-only agentic build loop. Implements:
//   1) Plan → 2) Codegen → 3) Verify → 4) Repair → 5) Critique → 6) Persist + Proof
//
// Calls into the yawB-owned AI provider abstraction (`src/server/ai/tool-call.ts`)
// — provider selection respects YAWB_AI_PROVIDER / YAWB_AI_MODEL.

import type { MonsterSupabaseLike } from "@/services/monster-persistence";
import { runToolCall } from "./ai/tool-call";
import { resolveProvider } from "./ai/resolver";
import { evaluateVisualQuality, type VisualQualityReport } from "@/services/monster-visual-quality";
import { generateMonsterDesignBrief } from "@/services/monster-design-brief";
import { createMonsterBlueprint } from "@/services/monster-director";

export interface AgenticDesignBrief {
  productCategory: string;
  targetUser: string;
  brandFeel: string;
  layoutDirection: string;
  navigationPattern: string;
  typography: { display: string; body: string };
  palette: { name: string; bg: string; surface: string; ink: string; accent: string };
  interactionStyle: string;
  keyScreens: string[];
  source: "ai" | "deterministic";
}

export interface AgenticPlan {
  appType: string;
  users: string[];
  workflows: string[];
  pages: Array<{ path: string; name: string; purpose: string }>;
  dataModel: Array<{ table: string; columns: string[]; purpose: string }>;
  integrations: string[];
  backendNeeds: string[];
  files: Array<{ path: string; purpose: string; language: string }>;
  designDirection: string;
}

export interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}
export interface RepairRecord {
  path: string;
  reason: string;
  attempt: number;
  ok: boolean;
}

export interface AgenticBuildResult {
  ok: boolean;
  generator: "agentic-loop-v1";
  userRequest: string;
  plan: AgenticPlan;
  designBrief: AgenticDesignBrief | null;
  files: Array<{ path: string; content: string; language: string }>;
  written: string[];
  checks: CheckResult[];
  repairs: RepairRecord[];
  critique: {
    score: number;
    summary: string;
    issues: string[];
    redesigned: boolean;
  };
  visualQuality: VisualQualityReport | null;
  provider: { name: string; model: string } | null;
  previewSource: string | null;
  limitations: string[];
  error?: string;
}

// Per-route model hints. The yawB resolver will fall back to the active
// provider's defaultModel if a hint isn't supported by that provider.
const PLAN_MODEL_HINT = process.env.YAWB_AI_PLAN_MODEL || undefined;
const CODE_MODEL_HINT = process.env.YAWB_AI_CODE_MODEL || undefined;
const CRITIC_MODEL_HINT = process.env.YAWB_AI_CRITIC_MODEL || undefined;
const BRIEF_MODEL_HINT = process.env.YAWB_AI_BRIEF_MODEL || undefined;

export function isAgenticLoopConfigured(): boolean {
  return resolveProvider().configured;
}

async function callGateway(input: {
  model?: string;
  system: string;
  user: string;
  tool: { name: string; description: string; parameters: Record<string, unknown> };
}): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; error: string }> {
  const r = await runToolCall({
    system: input.system,
    messages: [{ role: "user", content: input.user }],
    tool: input.tool,
    model: input.model,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, value: r.value.value };
}

// ---------- 1. Plan ----------

const PLAN_TOOL = {
  name: "submit_build_plan",
  description:
    "Submit a complete, opinionated build plan for the user's product request. Be specific.",
  parameters: {
    type: "object",
    properties: {
      appType: {
        type: "string",
        description: "e.g. 'AI law firm SaaS', 'pet adoption marketplace'",
      },
      users: { type: "array", items: { type: "string" } },
      workflows: { type: "array", items: { type: "string" } },
      pages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            name: { type: "string" },
            purpose: { type: "string" },
          },
          required: ["path", "name", "purpose"],
        },
      },
      dataModel: {
        type: "array",
        items: {
          type: "object",
          properties: {
            table: { type: "string" },
            columns: { type: "array", items: { type: "string" } },
            purpose: { type: "string" },
          },
          required: ["table", "columns", "purpose"],
        },
      },
      integrations: { type: "array", items: { type: "string" } },
      backendNeeds: { type: "array", items: { type: "string" } },
      files: {
        type: "array",
        description:
          "Concrete files to write. MUST include: (1) 'index.html' and 'styles.css' that drive the visible preview; (2) 'app.js' if interactive; (3) one HTML page per non-home route; (4) 'supabase/migrations/001_init.sql' with create-table + RLS enable + policies for every dataModel table; (5) a parallel TanStack Start scaffold under 'src/' — 'src/routes/index.tsx' and one 'src/routes/<page>.tsx' per page, 'src/components/<Component>.tsx' for reusable UI, 'src/services/<name>.ts' for data access; (6) 'README.md' summarizing the build. The static files render the preview; the src/ scaffold is the export target.",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            purpose: { type: "string" },
            language: { type: "string" },
          },
          required: ["path", "purpose", "language"],
        },
      },
      designDirection: {
        type: "string",
        description:
          "Specific, non-generic design direction: typography, palette, mood, layout principles. Avoid 'modern minimal'.",
      },
    },
    required: [
      "appType",
      "users",
      "workflows",
      "pages",
      "dataModel",
      "integrations",
      "backendNeeds",
      "files",
      "designDirection",
    ],
  },
};

async function buildPlan(
  userRequest: string,
  projectName: string,
): Promise<{ ok: true; plan: AgenticPlan } | { ok: false; error: string }> {
  const r = await callGateway({
    model: PLAN_MODEL_HINT,
    system:
      "You are yawB's senior product architect. Read the user's request and produce a SPECIFIC, opinionated build plan for a custom application — never a generic template. Infer app type, users, workflows, pages, data model, integrations, backend needs, and concrete files. Pick a distinctive design direction tied to the product domain.",
    user: JSON.stringify({ projectName, userRequest }),
    tool: PLAN_TOOL,
  });
  if (!r.ok) return r;
  const v = r.value as Partial<AgenticPlan>;
  const plan: AgenticPlan = {
    appType: String(v.appType ?? "custom-app"),
    users: Array.isArray(v.users) ? v.users.map(String) : [],
    workflows: Array.isArray(v.workflows) ? v.workflows.map(String) : [],
    pages: Array.isArray(v.pages) ? (v.pages as AgenticPlan["pages"]) : [],
    dataModel: Array.isArray(v.dataModel) ? (v.dataModel as AgenticPlan["dataModel"]) : [],
    integrations: Array.isArray(v.integrations) ? v.integrations.map(String) : [],
    backendNeeds: Array.isArray(v.backendNeeds) ? v.backendNeeds.map(String) : [],
    files: Array.isArray(v.files) ? (v.files as AgenticPlan["files"]) : [],
    designDirection: String(v.designDirection ?? ""),
  };
  // Ensure essential files are in the file list.
  const have = new Set(plan.files.map((f) => f.path));
  if (!have.has("index.html"))
    plan.files.unshift({ path: "index.html", purpose: "Landing/preview", language: "html" });
  if (!have.has("styles.css"))
    plan.files.push({ path: "styles.css", purpose: "Global design system", language: "css" });
  if (!have.has("README.md"))
    plan.files.push({ path: "README.md", purpose: "Build summary", language: "markdown" });
  if (plan.dataModel.length > 0 && !have.has("supabase/migrations/001_init.sql"))
    plan.files.push({
      path: "supabase/migrations/001_init.sql",
      purpose: "Initial schema + RLS policies",
      language: "sql",
    });
  // Parallel TanStack Start scaffold for export.
  if (!have.has("src/routes/index.tsx"))
    plan.files.push({
      path: "src/routes/index.tsx",
      purpose: "TanStack Start home route (export scaffold)",
      language: "typescript",
    });
  for (const p of plan.pages) {
    if (p.path === "/" || p.path === "/index") continue;
    const slug = p.path.replace(/^\//, "").replace(/\//g, ".") || "page";
    const tsx = `src/routes/${slug}.tsx`;
    if (!have.has(tsx))
      plan.files.push({
        path: tsx,
        purpose: `TanStack Start route for ${p.name} (export scaffold)`,
        language: "typescript",
      });
  }
  return { ok: true, plan };
}

// ---------- 2. Codegen ----------

const FILE_TOOL = {
  name: "submit_file",
  description: "Submit the full source content for one file.",
  parameters: {
    type: "object",
    properties: {
      content: { type: "string", description: "The complete file body. No markdown fences." },
    },
    required: ["content"],
  },
};

async function generateFile(input: {
  plan: AgenticPlan;
  userRequest: string;
  file: { path: string; purpose: string; language: string };
  repairHint?: string;
}): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const isIndex = input.file.path === "index.html";
  const isTsxRoute = input.file.path.startsWith("src/routes/") && input.file.path.endsWith(".tsx");
  const isSql = input.file.path.endsWith(".sql");
  let designConstraints: string;
  if (isIndex) {
    designConstraints =
      'MUST include <meta name="yawb-generator" content="agentic-loop-v1" />. MUST be a real, content-rich page tailored to the user\'s product (not a template). Hero, primary workflow surface, navigation to other pages, and clear CTAs. Use semantic HTML and link to ./styles.css.';
  } else if (isTsxRoute) {
    designConstraints =
      'Use TanStack Start file-based routing: `import { createFileRoute } from "@tanstack/react-router"; export const Route = createFileRoute("<path>")({ component: Page }); function Page() { ... }`. No default export. No React Router imports. Match the plan\'s design direction.';
  } else if (isSql) {
    designConstraints =
      "Emit Postgres SQL: CREATE TABLE for every plan.dataModel entry, ALTER TABLE ... ENABLE ROW LEVEL SECURITY, and at least one CREATE POLICY per table. Use auth.uid() where appropriate. No DROP statements.";
  } else {
    designConstraints =
      "Write production-quality code. No placeholder TODOs. Match the plan's design direction.";
  }
  const r = await callGateway({
    model: CODE_MODEL_HINT,
    system: `You are yawB's code generator. Write a single complete file. ${designConstraints} Forbidden strings: "Luxury Editorial", "Clean Minimal", "Money operations", "Lorem ipsum", "TODO".`,
    user: JSON.stringify({
      userRequest: input.userRequest,
      plan: input.plan,
      file: input.file,
      repairHint: input.repairHint ?? null,
    }),
    tool: FILE_TOOL,
  });
  if (!r.ok) return r;
  const content = String(r.value.content ?? "");
  if (!content.trim()) return { ok: false, error: "empty file content" };
  return { ok: true, content };
}

// ---------- 3. Verify ----------

const BANNED = ["Luxury Editorial", "Clean Minimal", "Money operations", "Lorem ipsum"];

function checkFile(file: { path: string; content: string }): CheckResult[] {
  const out: CheckResult[] = [];
  out.push({
    name: `${file.path}: non-empty`,
    ok: file.content.trim().length > 50,
    detail: `${file.content.length} chars`,
  });
  const banned = BANNED.find((b) => file.content.includes(b));
  out.push({
    name: `${file.path}: no banned preset strings`,
    ok: !banned,
    detail: banned ? `contains "${banned}"` : undefined,
  });
  if (file.path.endsWith(".html")) {
    out.push({
      name: `${file.path}: has <html>`,
      ok: /<html[\s>]/i.test(file.content),
    });
    out.push({
      name: `${file.path}: balanced tags`,
      ok: balancedTags(file.content),
    });
  }
  if (file.path === "index.html") {
    out.push({
      name: `index.html: yawb-generator meta`,
      ok: file.content.includes('content="agentic-loop-v1"'),
    });
  }
  if (file.path.endsWith(".css")) {
    out.push({
      name: `${file.path}: balanced braces`,
      ok: countChar(file.content, "{") === countChar(file.content, "}"),
    });
  }
  if (file.path.endsWith(".sql")) {
    out.push({
      name: `${file.path}: contains create table`,
      ok: /create\s+table/i.test(file.content),
    });
    out.push({
      name: `${file.path}: enables RLS`,
      ok: /enable\s+row\s+level\s+security/i.test(file.content),
    });
    out.push({
      name: `${file.path}: has policy`,
      ok: /create\s+policy/i.test(file.content),
    });
  }
  if (file.path.endsWith(".tsx") && file.path.startsWith("src/routes/")) {
    out.push({
      name: `${file.path}: uses createFileRoute`,
      ok: /createFileRoute\s*\(/.test(file.content),
    });
    out.push({
      name: `${file.path}: no react-router-dom`,
      ok: !/from\s+["']react-router-dom["']/.test(file.content),
    });
    out.push({
      name: `${file.path}: balanced braces`,
      ok: countChar(file.content, "{") === countChar(file.content, "}"),
    });
  }
  return out;
}

function balancedTags(html: string): boolean {
  // Lightweight: every opening tag (excluding void) has a closing tag.
  const voids = new Set([
    "br",
    "hr",
    "img",
    "input",
    "meta",
    "link",
    "source",
    "area",
    "base",
    "col",
    "embed",
    "param",
    "track",
    "wbr",
  ]);
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
  const stack: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const name = m[1].toLowerCase();
    const isClose = m[0].startsWith("</");
    const selfClose = m[2] === "/" || voids.has(name);
    if (selfClose) continue;
    if (isClose) {
      const top = stack.pop();
      if (top !== name) return false;
    } else {
      stack.push(name);
    }
  }
  return stack.length === 0;
}

function countChar(s: string, c: string): number {
  let n = 0;
  for (const ch of s) if (ch === c) n++;
  return n;
}

// ---------- 4. Critique ----------

const CRITIC_TOOL = {
  name: "submit_critique",
  description: "Score the preview against the original user request.",
  parameters: {
    type: "object",
    properties: {
      score: { type: "number", description: "0-100. ≥75 means acceptable." },
      summary: { type: "string" },
      issues: { type: "array", items: { type: "string" } },
      generic: { type: "boolean", description: "True if preview looks template/generic." },
    },
    required: ["score", "summary", "issues", "generic"],
  },
};

async function critique(input: {
  userRequest: string;
  plan: AgenticPlan;
  indexHtml: string;
}): Promise<{
  score: number;
  summary: string;
  issues: string[];
  generic: boolean;
}> {
  const r = await callGateway({
    model: CRITIC_MODEL_HINT,
    system:
      "You are a strict design + product critic. Judge whether the preview HTML matches the user's request and the plan, and whether it feels custom (not a template). Be specific.",
    user: JSON.stringify({
      userRequest: input.userRequest,
      plan: input.plan,
      indexHtml: input.indexHtml.slice(0, 16000),
    }),
    tool: CRITIC_TOOL,
  });
  if (!r.ok) {
    return { score: 0, summary: `critic failed: ${r.error}`, issues: [r.error], generic: false };
  }
  return {
    score: Number(r.value.score ?? 0),
    summary: String(r.value.summary ?? ""),
    issues: Array.isArray(r.value.issues) ? r.value.issues.map(String) : [],
    generic: Boolean(r.value.generic ?? false),
  };
}

// ---------- 4b. Design brief (AI-first, deterministic fallback) ----------

const BRIEF_TOOL = {
  name: "submit_design_brief",
  description: "Produce a custom design brief for the user's product BEFORE files are generated.",
  parameters: {
    type: "object",
    properties: {
      productCategory: { type: "string" },
      targetUser: { type: "string" },
      brandFeel: { type: "string" },
      layoutDirection: { type: "string" },
      navigationPattern: { type: "string" },
      typography: {
        type: "object",
        properties: { display: { type: "string" }, body: { type: "string" } },
        required: ["display", "body"],
      },
      palette: {
        type: "object",
        properties: {
          name: { type: "string" },
          bg: { type: "string" },
          surface: { type: "string" },
          ink: { type: "string" },
          accent: { type: "string" },
        },
        required: ["name", "bg", "surface", "ink", "accent"],
      },
      interactionStyle: { type: "string" },
      keyScreens: { type: "array", items: { type: "string" } },
    },
    required: [
      "productCategory",
      "targetUser",
      "brandFeel",
      "layoutDirection",
      "navigationPattern",
      "typography",
      "palette",
      "interactionStyle",
      "keyScreens",
    ],
  },
};

function deterministicBrief(input: {
  projectName: string;
  userRequest: string;
}): AgenticDesignBrief {
  const blueprint = createMonsterBlueprint({
    project: { id: "agentic", name: input.projectName, description: input.userRequest },
    chatRequest: input.userRequest,
  });
  const det = generateMonsterDesignBrief(blueprint, input.userRequest);
  return {
    productCategory: det.productCategory,
    targetUser: det.targetUser,
    brandFeel: det.brandFeel,
    layoutDirection: det.layoutDirection,
    navigationPattern: det.navigationPattern,
    typography: det.typographyPairing,
    palette: {
      name: det.colorPalette.name,
      bg: det.colorPalette.bg,
      surface: det.colorPalette.surface,
      ink: det.colorPalette.ink,
      accent: det.colorPalette.accent,
    },
    interactionStyle: det.interactionStyle,
    keyScreens: det.keyScreens,
    source: "deterministic",
  };
}

async function buildDesignBrief(input: {
  projectName: string;
  userRequest: string;
}): Promise<AgenticDesignBrief> {
  const r = await callGateway({
    model: BRIEF_MODEL_HINT,
    system:
      "You are yawB's design strategist. Produce a non-generic design brief tailored to the product domain. Never reuse 'Luxury Editorial' or 'Clean Minimal'.",
    user: JSON.stringify({ projectName: input.projectName, userRequest: input.userRequest }),
    tool: BRIEF_TOOL,
  });
  if (!r.ok) return deterministicBrief(input);
  const v = r.value as Partial<AgenticDesignBrief> & {
    typography?: { display?: string; body?: string };
    palette?: { name?: string; bg?: string; surface?: string; ink?: string; accent?: string };
  };
  const fb = deterministicBrief(input);
  return {
    productCategory: String(v.productCategory ?? fb.productCategory),
    targetUser: String(v.targetUser ?? fb.targetUser),
    brandFeel: String(v.brandFeel ?? fb.brandFeel),
    layoutDirection: String(v.layoutDirection ?? fb.layoutDirection),
    navigationPattern: String(v.navigationPattern ?? fb.navigationPattern),
    typography: {
      display: String(v.typography?.display ?? fb.typography.display),
      body: String(v.typography?.body ?? fb.typography.body),
    },
    palette: {
      name: String(v.palette?.name ?? fb.palette.name),
      bg: String(v.palette?.bg ?? fb.palette.bg),
      surface: String(v.palette?.surface ?? fb.palette.surface),
      ink: String(v.palette?.ink ?? fb.palette.ink),
      accent: String(v.palette?.accent ?? fb.palette.accent),
    },
    interactionStyle: String(v.interactionStyle ?? fb.interactionStyle),
    keyScreens: Array.isArray(v.keyScreens) ? v.keyScreens.map(String) : fb.keyScreens,
    source: "ai",
  };
}

function briefToVisualQualityShape(b: AgenticDesignBrief) {
  // Adapter so the existing visual-quality gate (which expects a
  // MonsterDesignBrief) can score agentic output.
  return {
    version: "monster-design-brief-v1" as const,
    productCategory: b.productCategory,
    targetUser: b.targetUser,
    brandFeel: b.brandFeel,
    layoutDirection: b.layoutDirection,
    navigationPattern: ([
      "left-rail",
      "top-nav",
      "split-pane",
      "tabbed-shell",
      "sidebar-stack",
    ].includes(b.navigationPattern)
      ? b.navigationPattern
      : "top-nav") as "left-rail" | "top-nav" | "split-pane" | "tabbed-shell" | "sidebar-stack",
    typographyPairing: b.typography,
    colorPalette: { ...b.palette, accent2: b.palette.accent },
    interactionStyle: b.interactionStyle,
    spacingRhythm: "balanced" as const,
    cardStyle: "paper" as const,
    heroComposition: b.layoutDirection,
    keyScreens: b.keyScreens,
    varianceSeed: "agentic",
  };
}

// ---------- 5. Orchestrate ----------

export async function runAgenticBuild(input: {
  sb: MonsterSupabaseLike;
  projectId: string;
  workspaceId: string | null;
  jobId: string | null;
  projectName: string;
  userRequest: string;
}): Promise<AgenticBuildResult> {
  const limitations: string[] = [
    "Verification is heuristic (syntax/balance/banned strings). No real tsc/vite runs in this loop.",
    "Generated code is static HTML/CSS/JS plus draft Supabase SQL. Wire to a real framework on next pass.",
  ];
  const r = resolveProvider();
  const providerInfo = r.configured
    ? { name: r.provider.name, model: r.model || r.provider.defaultModel }
    : null;

  // Step 0: Design brief (AI with deterministic fallback) BEFORE plan/files.
  const designBrief = await buildDesignBrief({
    projectName: input.projectName,
    userRequest: input.userRequest,
  });

  const planResp = await buildPlan(input.userRequest, input.projectName);
  if (!planResp.ok) {
    return emptyFailure(input, planResp.error, limitations, designBrief, providerInfo);
  }
  const plan = planResp.plan;
  // Bake the brief into the design direction so codegen sees it.
  plan.designDirection =
    `${plan.designDirection}\n\nBrief: category=${designBrief.productCategory}; user=${designBrief.targetUser}; feel=${designBrief.brandFeel}; nav=${designBrief.navigationPattern}; palette=${designBrief.palette.name} (accent ${designBrief.palette.accent}); typography=${designBrief.typography.display}/${designBrief.typography.body}; screens=${designBrief.keyScreens.join(", ")}.`.trim();

  const files: Array<{ path: string; content: string; language: string }> = [];
  const checks: CheckResult[] = [];
  const repairs: RepairRecord[] = [];

  for (const spec of plan.files) {
    let attempt = 0;
    let content = "";
    let lastReason = "";
    while (attempt < 3) {
      const gen = await generateFile({
        plan,
        userRequest: input.userRequest,
        file: spec,
        repairHint: attempt === 0 ? undefined : lastReason,
      });
      if (!gen.ok) {
        lastReason = gen.error;
        attempt++;
        repairs.push({ path: spec.path, reason: gen.error, attempt, ok: false });
        continue;
      }
      content = gen.content;
      const fileChecks = checkFile({ path: spec.path, content });
      const failed = fileChecks.filter((c) => !c.ok);
      if (failed.length === 0) {
        checks.push(...fileChecks);
        break;
      }
      lastReason = `Failed checks: ${failed.map((c) => `${c.name}${c.detail ? ` (${c.detail})` : ""}`).join("; ")}`;
      attempt++;
      repairs.push({ path: spec.path, reason: lastReason, attempt, ok: false });
      if (attempt >= 3) {
        checks.push(...fileChecks);
      }
    }
    if (content) {
      files.push({ path: spec.path, content, language: spec.language || guessLang(spec.path) });
      if (repairs.length && repairs[repairs.length - 1].path === spec.path) {
        repairs[repairs.length - 1].ok = true;
      }
    }
  }

  // Critique pass on index.html
  const index = files.find((f) => f.path === "index.html");
  let critiqueResult = {
    score: 0,
    summary: "no index.html generated",
    issues: ["missing index.html"] as string[],
    generic: false,
  };
  let redesigned = false;
  if (index) {
    critiqueResult = await critique({
      userRequest: input.userRequest,
      plan,
      indexHtml: index.content,
    });
    if (critiqueResult.score < 70 || critiqueResult.generic) {
      const hint = `Critic flagged the previous index.html (score ${critiqueResult.score}, generic=${critiqueResult.generic}). Issues: ${critiqueResult.issues.join("; ")}. Regenerate with stronger product specificity and a more distinctive visual identity.`;
      const regen = await generateFile({
        plan,
        userRequest: input.userRequest,
        file: { path: "index.html", purpose: "Landing/preview", language: "html" },
        repairHint: hint,
      });
      if (regen.ok) {
        index.content = regen.content;
        redesigned = true;
        repairs.push({ path: "index.html", reason: hint, attempt: 99, ok: true });
        const second = await critique({
          userRequest: input.userRequest,
          plan,
          indexHtml: index.content,
        });
        critiqueResult = second;
      }
    }
  }

  // Visual quality gate (shared with monster orchestrator). On banned/weak
  // hits, ask the AI to repair the offending files once.
  let visualQuality: VisualQualityReport = evaluateVisualQuality({
    files: files.map((f) => ({
      path: f.path,
      content: f.content,
      language: f.language,
      kind: "source",
    })),
    brief: briefToVisualQualityShape(designBrief),
    previousIndexHtml: null,
  });
  if (!visualQuality.passed && visualQuality.bannedHits.length > 0) {
    const hint = `Visual quality gate failed. Remove banned template strings: ${visualQuality.bannedHits.join(", ")}. Use the design brief instead (category=${designBrief.productCategory}, brand=${designBrief.brandFeel}).`;
    for (const f of files) {
      if (!visualQuality.bannedHits.some((b) => f.content.includes(b))) continue;
      const spec = plan.files.find((p) => p.path === f.path) ?? {
        path: f.path,
        purpose: "repair",
        language: f.language,
      };
      const regen = await generateFile({
        plan,
        userRequest: input.userRequest,
        file: spec,
        repairHint: hint,
      });
      if (regen.ok) {
        f.content = regen.content;
        repairs.push({ path: f.path, reason: hint, attempt: 99, ok: true });
      }
    }
    visualQuality = evaluateVisualQuality({
      files: files.map((f) => ({
        path: f.path,
        content: f.content,
        language: f.language,
        kind: "source",
      })),
      brief: briefToVisualQualityShape(designBrief),
      previousIndexHtml: null,
    });
  }

  // Persist files
  const written: string[] = [];
  for (const f of files) {
    const { error } = await input.sb.from("project_files").upsert(
      {
        project_id: input.projectId,
        path: f.path,
        content: f.content,
        language: f.language,
        kind: f.path.startsWith("supabase/") || f.path.startsWith("docs/") ? "asset" : "source",
      },
      { onConflict: "project_id,path" },
    );
    if (error) {
      return {
        ok: false,
        generator: "agentic-loop-v1",
        userRequest: input.userRequest,
        plan,
        designBrief,
        files,
        written,
        checks,
        repairs,
        critique: { ...critiqueResult, redesigned },
        visualQuality,
        provider: providerInfo,
        previewSource: index?.content ?? null,
        limitations,
        error: `project_files upsert ${f.path}: ${error.message}`,
      };
    }
    written.push(f.path);
  }

  // Persist proof (no prompts/responses recorded — only metadata).
  const proofRow = {
    project_id: input.projectId,
    job_id: input.jobId,
    workspace_id: input.workspaceId,
    generator: "agentic-loop-v1",
    user_request: input.userRequest,
    plan,
    design_brief: designBrief,
    provider: providerInfo,
    files_written: written,
    checks,
    repairs,
    critique: { ...critiqueResult, redesigned },
    visual_quality: visualQuality,
    preview_source: index?.content ?? null,
    limitations,
    ok: written.length > 0 && Boolean(index) && visualQuality.bannedHits.length === 0,
  };
  try {
    await input.sb.from("project_proofs").insert(proofRow);
  } catch {
    // table may not exist yet — continue, proof is best-effort
  }

  const allChecksPassed = checks.every((c) => c.ok);
  return {
    ok:
      written.length > 0 &&
      Boolean(index) &&
      allChecksPassed &&
      visualQuality.bannedHits.length === 0,
    generator: "agentic-loop-v1",
    userRequest: input.userRequest,
    plan,
    designBrief,
    files,
    written: written.sort(),
    checks,
    repairs,
    critique: { ...critiqueResult, redesigned },
    visualQuality,
    provider: providerInfo,
    previewSource: index?.content ?? null,
    limitations,
  };
}

function emptyFailure(
  input: { projectId: string; userRequest: string },
  error: string,
  limitations: string[],
  designBrief: AgenticDesignBrief | null,
  providerInfo: { name: string; model: string } | null,
): AgenticBuildResult {
  return {
    ok: false,
    generator: "agentic-loop-v1",
    userRequest: input.userRequest,
    plan: {
      appType: "",
      users: [],
      workflows: [],
      pages: [],
      dataModel: [],
      integrations: [],
      backendNeeds: [],
      files: [],
      designDirection: "",
    },
    designBrief,
    files: [],
    written: [],
    checks: [],
    repairs: [],
    critique: { score: 0, summary: error, issues: [error], redesigned: false },
    visualQuality: null,
    provider: providerInfo,
    previewSource: null,
    limitations,
    error,
  };
}

function guessLang(path: string): string {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".sql")) return "sql";
  if (path.endsWith(".md")) return "markdown";
  return "text";
}
