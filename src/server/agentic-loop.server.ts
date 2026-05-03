// Server-only agentic build loop. Implements:
//   1) Plan → 2) Codegen → 3) Verify → 4) Repair → 5) Critique → 6) Persist + Proof
//
// SECURITY: server-only (`.server.ts`). Reads LOVABLE_API_KEY from process.env.
// Never imported into client bundles.

import type { MonsterSupabaseLike } from "@/services/monster-persistence";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PLAN_MODEL = "google/gemini-2.5-pro";
const CODE_MODEL = "google/gemini-3-flash-preview";
const CRITIC_MODEL = "google/gemini-2.5-pro";

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
  previewSource: string | null;
  limitations: string[];
  error?: string;
}

function getKey(): string | null {
  return process.env.LOVABLE_API_KEY || process.env.AI_GATEWAY_KEY || null;
}

export function isAgenticLoopConfigured(): boolean {
  return Boolean(getKey());
}

async function callGateway(input: {
  model: string;
  system: string;
  user: string;
  tool: { name: string; description: string; parameters: Record<string, unknown> };
}): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; error: string }> {
  const key = getKey();
  if (!key) return { ok: false, error: "LOVABLE_API_KEY not configured" };
  let resp: Response;
  try {
    resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        tools: [{ type: "function", function: input.tool }],
        tool_choice: { type: "function", function: { name: input.tool.name } },
      }),
    });
  } catch (e) {
    return { ok: false, error: `network: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return { ok: false, error: `gateway ${resp.status}: ${text.slice(0, 400)}` };
  }
  const body = (await resp.json().catch(() => null)) as {
    choices?: Array<{
      message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
    }>;
  } | null;
  const args = body?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return { ok: false, error: "missing tool_calls arguments" };
  try {
    return { ok: true, value: JSON.parse(args) as Record<string, unknown> };
  } catch (e) {
    return { ok: false, error: `tool args parse: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ---------- 1. Plan ----------

const PLAN_TOOL = {
  name: "submit_build_plan",
  description:
    "Submit a complete, opinionated build plan for the user's product request. Be specific.",
  parameters: {
    type: "object",
    properties: {
      appType: { type: "string", description: "e.g. 'AI law firm SaaS', 'pet adoption marketplace'" },
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
          "Concrete files to write. MUST include 'index.html' and 'styles.css'. Add 'app.js' for interactivity, 'supabase/migrations/001_init.sql' if data model exists, 'README.md', and route HTML files for each non-home page.",
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
    model: PLAN_MODEL,
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
  // Ensure index.html + styles.css are in the file list.
  const have = new Set(plan.files.map((f) => f.path));
  if (!have.has("index.html"))
    plan.files.unshift({ path: "index.html", purpose: "Landing/preview", language: "html" });
  if (!have.has("styles.css"))
    plan.files.push({
      path: "styles.css",
      purpose: "Global design system",
      language: "css",
    });
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
  const designConstraints = isIndex
    ? "MUST include <meta name=\"yawb-generator\" content=\"agentic-loop-v1\" />. MUST be a real, content-rich page tailored to the user's product (not a template). Hero, primary workflow surface, navigation to other pages, and clear CTAs. Use semantic HTML and link to ./styles.css."
    : "Write production-quality code. No placeholder TODOs. Match the plan's design direction.";
  const r = await callGateway({
    model: CODE_MODEL,
    system: `You are yawB's code generator. Write a single complete file. ${designConstraints} Forbidden strings: "Luxury Editorial", "Clean Minimal", "Money operations", "Lorem ipsum".`,
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
  }
  return out;
}

function balancedTags(html: string): boolean {
  // Lightweight: every opening tag (excluding void) has a closing tag.
  const voids = new Set([
    "br", "hr", "img", "input", "meta", "link", "source", "area", "base", "col", "embed", "param",
    "track", "wbr",
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
    model: CRITIC_MODEL,
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

  const planResp = await buildPlan(input.userRequest, input.projectName);
  if (!planResp.ok) {
    return emptyFailure(input, planResp.error, limitations);
  }
  const plan = planResp.plan;

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
      // One redesign pass.
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
        files,
        written,
        checks,
        repairs,
        critique: { ...critiqueResult, redesigned },
        previewSource: index?.content ?? null,
        limitations,
        error: `project_files upsert ${f.path}: ${error.message}`,
      };
    }
    written.push(f.path);
  }

  // Persist proof
  const proofRow = {
    project_id: input.projectId,
    job_id: input.jobId,
    workspace_id: input.workspaceId,
    generator: "agentic-loop-v1",
    user_request: input.userRequest,
    plan,
    files_written: written,
    checks,
    repairs,
    critique: { ...critiqueResult, redesigned },
    preview_source: index?.content ?? null,
    limitations,
    ok: written.length > 0 && Boolean(index),
  };
  try {
    await input.sb.from("project_proofs").insert(proofRow);
  } catch {
    // table may not exist yet — continue, proof is best-effort
  }

  const allChecksPassed = checks.every((c) => c.ok);
  return {
    ok: written.length > 0 && Boolean(index) && allChecksPassed,
    generator: "agentic-loop-v1",
    userRequest: input.userRequest,
    plan,
    files,
    written: written.sort(),
    checks,
    repairs,
    critique: { ...critiqueResult, redesigned },
    previewSource: index?.content ?? null,
    limitations,
  };
}

function emptyFailure(
  input: { projectId: string; userRequest: string },
  error: string,
  limitations: string[],
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
    files: [],
    written: [],
    checks: [],
    repairs: [],
    critique: { score: 0, summary: error, issues: [error], redesigned: false },
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
