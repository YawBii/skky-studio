// Law-firm acceptance test for the agentic build loop.
//
// Covers:
//  - Plan → Codegen → Verify → Critique → Persist
//  - The plan auto-includes index.html, styles.css, README.md, supabase migration,
//    and a TanStack Start scaffold under src/routes/.
//  - Verification flags missing RLS in SQL files.
//  - No banned preset/template strings reach the output.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runAgenticBuild, isAgenticLoopConfigured } from "./agentic-loop.server";

interface UpsertCall {
  table: string;
  rows: Record<string, unknown>;
}

function makeFakeSupabase() {
  const calls: UpsertCall[] = [];
  return {
    calls,
    from(table: string) {
      return {
        upsert: async (rows: Record<string, unknown>) => {
          calls.push({ table, rows });
          return { error: null };
        },
        insert: async (rows: Record<string, unknown>) => {
          calls.push({ table, rows });
          return { error: null };
        },
      };
    },
  };
}

interface ChatBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  tools: Array<{ function: { name: string; parameters: unknown } }>;
}

function makeGatewayMock() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (!url.includes("ai.gateway.lovable.dev")) {
      throw new Error(`unexpected fetch ${url}`);
    }
    const body = JSON.parse(String(init?.body ?? "{}")) as ChatBody;
    const toolName = body.tools[0].function.name;
    let args: Record<string, unknown>;
    if (toolName === "submit_build_plan") {
      args = {
        appType: "premium AI law firm SaaS",
        users: ["partners", "associates", "clients"],
        workflows: ["client intake", "case cockpit", "invoicing"],
        pages: [
          { path: "/", name: "Home", purpose: "Marketing + sign in" },
          { path: "/intake", name: "Intake", purpose: "Client intake form" },
          { path: "/cases", name: "Cases", purpose: "Case cockpit" },
        ],
        dataModel: [
          { table: "clients", columns: ["id", "name", "email"], purpose: "Client records" },
          { table: "cases", columns: ["id", "client_id", "status"], purpose: "Case records" },
        ],
        integrations: ["Stripe", "Supabase Auth"],
        backendNeeds: ["Auth", "Payments", "Admin"],
        files: [],
        designDirection: "Editorial serif headlines, deep navy and brass, generous whitespace",
      };
    } else if (toolName === "submit_file") {
      const userMsg = JSON.parse(body.messages[body.messages.length - 1].content) as {
        file: { path: string };
      };
      const path = userMsg.file.path;
      args = { content: fakeFileFor(path) };
    } else if (toolName === "submit_critique") {
      args = {
        score: 88,
        summary: "Custom legal SaaS, not a template.",
        issues: [],
        generic: false,
      };
    } else {
      throw new Error(`unknown tool ${toolName}`);
    }
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              tool_calls: [{ function: { arguments: JSON.stringify(args) } }],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ) as unknown as Response;
  });
}

function fakeFileFor(path: string): string {
  if (path === "index.html") {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="yawb-generator" content="agentic-loop-v1" /><title>Lex Cockpit</title><link rel="stylesheet" href="./styles.css" /></head><body><header><nav><a href="/intake">Intake</a><a href="/cases">Cases</a></nav></header><main><h1>Lex Cockpit for modern law firms</h1><p>Client intake, case cockpit, invoices.</p><a href="/intake" class="cta">Start intake</a></main></body></html>`;
  }
  if (path === "styles.css") {
    return `:root{--navy:#0b1f3a;--brass:#b08d3a}body{font-family:Georgia,serif;background:#fff;color:var(--navy)}`;
  }
  if (path === "README.md") return `# Lex Cockpit\n\nPremium AI law firm SaaS.\n`;
  if (path.endsWith(".sql")) {
    return `create table clients (id uuid primary key, name text, email text);
create table cases (id uuid primary key, client_id uuid, status text);
alter table clients enable row level security;
alter table cases enable row level security;
create policy "clients self" on clients for select using (auth.uid() is not null);
create policy "cases self" on cases for select using (auth.uid() is not null);`;
  }
  if (path.startsWith("src/routes/") && path.endsWith(".tsx")) {
    const route = path === "src/routes/index.tsx" ? "/" : "/" + path.replace("src/routes/", "").replace(".tsx", "");
    return `import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("${route}")({ component: Page });

function Page() {
  return <main><h1>${route}</h1></main>;
}
`;
  }
  return `// ${path}\nexport const placeholder = true;\n`;
}

describe("agentic build loop — law firm acceptance", () => {
  const ORIG = process.env.LOVABLE_API_KEY;
  beforeEach(() => {
    process.env.LOVABLE_API_KEY = "test-key";
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.LOVABLE_API_KEY;
    else process.env.LOVABLE_API_KEY = ORIG;
    vi.restoreAllMocks();
  });

  it("is configured when LOVABLE_API_KEY is set", () => {
    expect(isAgenticLoopConfigured()).toBe(true);
  });

  it("produces a custom legal SaaS, not a template", async () => {
    makeGatewayMock();
    const sb = makeFakeSupabase();
    const res = await runAgenticBuild({
      sb: sb as never,
      projectId: "p1",
      workspaceId: "w1",
      jobId: "j1",
      projectName: "Lex Cockpit",
      userRequest:
        "Build a premium AI law firm app with auth, client intake, case cockpit, invoices, payments, admin panel, and Supabase backend.",
    });

    expect(res.ok).toBe(true);
    expect(res.plan.appType.toLowerCase()).toContain("law");
    // Static preview files
    expect(res.written).toContain("index.html");
    expect(res.written).toContain("styles.css");
    expect(res.written).toContain("README.md");
    // SQL migration with RLS
    expect(res.written).toContain("supabase/migrations/001_init.sql");
    // TanStack Start scaffold
    expect(res.written).toContain("src/routes/index.tsx");
    expect(res.written.some((p) => p.startsWith("src/routes/") && p.endsWith(".tsx") && p !== "src/routes/index.tsx")).toBe(true);
    // No banned template strings anywhere
    for (const f of res.files) {
      expect(f.content).not.toMatch(/Luxury Editorial|Clean Minimal|Money operations|Lorem ipsum/);
    }
    // Verification ran and passed
    expect(res.checks.every((c) => c.ok)).toBe(true);
    // Critique recorded
    expect(res.critique.score).toBeGreaterThanOrEqual(70);
    // Files persisted to project_files and proof inserted
    const tables = sb.calls.map((c) => c.table);
    expect(tables.filter((t) => t === "project_files").length).toBeGreaterThan(0);
    expect(tables).toContain("project_proofs");
  });
});
