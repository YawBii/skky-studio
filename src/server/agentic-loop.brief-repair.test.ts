// AI design brief + visual-quality banned-string repair coverage for the
// agentic loop.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runAgenticBuild } from "./agentic-loop.server";

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
  messages: Array<{ role: string; content: string }>;
  tools: Array<{ function: { name: string; parameters: unknown } }>;
}

const ORIG = process.env.LOVABLE_API_KEY;

describe("agentic loop — AI brief + banned-string repair", () => {
  beforeEach(() => {
    process.env.LOVABLE_API_KEY = "test-key";
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.LOVABLE_API_KEY;
    else process.env.LOVABLE_API_KEY = ORIG;
    vi.restoreAllMocks();
  });

  it("calls the yawB AI abstraction for the design brief and surfaces provider info", async () => {
    let briefCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      expect(url).toContain("ai.gateway.lovable.dev");
      const body = JSON.parse(String(init?.body ?? "{}")) as ChatBody;
      const toolName = body.tools[0].function.name;
      let args: Record<string, unknown> = {};
      if (toolName === "submit_design_brief") {
        briefCalls++;
        args = {
          productCategory: "family-life",
          targetUser: "households",
          brandFeel: "warm reassuring",
          layoutDirection: "shared timeline",
          navigationPattern: "sidebar-stack",
          typography: { display: "Fraunces", body: "Inter" },
          palette: {
            name: "Hearth Rose",
            bg: "#1a0f12",
            surface: "#fff1ec",
            ink: "#2a131a",
            accent: "#e11d48",
          },
          interactionStyle: "tap-friendly",
          keyScreens: ["Today", "Chores", "Calendar"],
        };
      } else if (toolName === "submit_build_plan") {
        args = {
          appType: "family life coordinator",
          users: ["parents"],
          workflows: ["chores"],
          pages: [{ path: "/", name: "Home", purpose: "Today view" }],
          dataModel: [{ table: "tasks", columns: ["id", "owner"], purpose: "chores" }],
          integrations: [],
          backendNeeds: ["Auth"],
          files: [],
          designDirection: "warm",
        };
      } else if (toolName === "submit_file") {
        const userMsg = JSON.parse(body.messages[body.messages.length - 1].content) as {
          file: { path: string };
        };
        const path = userMsg.file.path;
        if (path === "index.html") {
          args = {
            content:
              '<!doctype html><html><head><meta charset="utf-8"/><meta name="yawb-generator" content="agentic-loop-v1"/><meta name="viewport" content="width=device-width"/><title>Hearth</title></head><body><main><h1>Family today</h1><table><tr><td>Chore</td></tr></table><div class="board">board</div></main><style>@media (max-width: 600px){body{padding:1rem}}</style></body></html>',
          };
        } else if (path === "styles.css") {
          args = { content: "body{font-family:Inter}" };
        } else if (path === "README.md") {
          args = { content: "# Hearth\n" };
        } else if (path.endsWith(".sql")) {
          args = {
            content:
              "create table tasks (id uuid primary key, owner uuid);\nalter table tasks enable row level security;\ncreate policy p on tasks for select using (auth.uid() is not null);",
          };
        } else if (path.endsWith(".tsx")) {
          args = {
            content:
              'import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: P });\nfunction P(){ return <main/>; }\n',
          };
        } else {
          args = { content: "// stub\n" };
        }
      } else if (toolName === "submit_critique") {
        args = { score: 90, summary: "good", issues: [], generic: false };
      }
      return new Response(
        JSON.stringify({
          choices: [
            { message: { tool_calls: [{ function: { arguments: JSON.stringify(args) } }] } },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ) as unknown as Response;
    });

    const sb = makeFakeSupabase();
    const res = await runAgenticBuild({
      sb: sb as never,
      projectId: "p-fam",
      workspaceId: "w",
      jobId: "j",
      projectName: "Hearth",
      userRequest: "Family life coordinator with chores and calendar",
    });

    expect(briefCalls).toBe(1);
    expect(res.designBrief?.source).toBe("ai");
    expect(res.designBrief?.productCategory).toBe("family-life");
    expect(res.provider?.name).toBeDefined();
    expect(res.provider?.model).toBeTruthy();
    expect(res.visualQuality).not.toBeNull();
    // Proof row carries provider + brief metadata, no prompt content.
    const proof = sb.calls.find((c) => c.table === "project_proofs");
    expect(proof).toBeDefined();
    expect((proof?.rows as Record<string, unknown>).provider).toBeDefined();
    expect((proof?.rows as Record<string, unknown>).design_brief).toBeDefined();
  });

  it("falls back to deterministic brief when the AI provider is not configured", async () => {
    delete process.env.LOVABLE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.YAWB_AI_PROVIDER;
    const sb = makeFakeSupabase();
    const res = await runAgenticBuild({
      sb: sb as never,
      projectId: "p",
      workspaceId: null,
      jobId: null,
      projectName: "Bookly",
      userRequest: "booking platform",
    });
    expect(res.ok).toBe(false); // plan call fails (no provider)
    expect(res.designBrief?.source).toBe("deterministic");
    expect(res.provider).toBeNull();
  });

  it("triggers an AI repair when banned template strings appear", async () => {
    let fileCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      expect(url).toContain("ai.gateway.lovable.dev");
      const body = JSON.parse(String(init?.body ?? "{}")) as ChatBody;
      const toolName = body.tools[0].function.name;
      let args: Record<string, unknown> = {};
      if (toolName === "submit_design_brief") {
        args = {
          productCategory: "legal-operations",
          targetUser: "lawyers",
          brandFeel: "authoritative",
          layoutDirection: "case cockpit",
          navigationPattern: "left-rail",
          typography: { display: "Fraunces", body: "Inter" },
          palette: {
            name: "Counsel Oxblood",
            bg: "#120f0a",
            surface: "#f4ebd8",
            ink: "#211814",
            accent: "#9b2f19",
          },
          interactionStyle: "keyboard",
          keyScreens: ["Matters"],
        };
      } else if (toolName === "submit_build_plan") {
        args = {
          appType: "law firm",
          users: ["lawyers"],
          workflows: ["matters"],
          pages: [{ path: "/", name: "Home", purpose: "Matters" }],
          dataModel: [],
          integrations: [],
          backendNeeds: [],
          files: [],
          designDirection: "navy + brass",
        };
      } else if (toolName === "submit_file") {
        const userMsg = JSON.parse(body.messages[body.messages.length - 1].content) as {
          file: { path: string };
          repairHint?: string | null;
        };
        if (userMsg.file.path === "index.html") {
          fileCalls++;
          // First call: poison with a banned string. Second call (repair): clean.
          if (fileCalls === 1) {
            args = {
              content:
                '<!doctype html><html><head><meta charset="utf-8"/><meta name="yawb-generator" content="agentic-loop-v1"/><meta name="viewport" content="width=device-width"/><title>x</title></head><body><h1>Luxury Editorial</h1><table></table></body></html>',
            };
          } else {
            args = {
              content:
                '<!doctype html><html><head><meta charset="utf-8"/><meta name="yawb-generator" content="agentic-loop-v1"/><meta name="viewport" content="width=device-width"/><title>Lex</title></head><body><h1>Matters</h1><table></table></body></html>',
            };
          }
        } else {
          args = { content: "// ok\n" };
        }
      } else if (toolName === "submit_critique") {
        args = { score: 85, summary: "ok", issues: [], generic: false };
      }
      return new Response(
        JSON.stringify({
          choices: [
            { message: { tool_calls: [{ function: { arguments: JSON.stringify(args) } }] } },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ) as unknown as Response;
    });

    const sb = makeFakeSupabase();
    const res = await runAgenticBuild({
      sb: sb as never,
      projectId: "p-law",
      workspaceId: null,
      jobId: null,
      projectName: "LawForge",
      userRequest: "Law firm",
    });
    // index.html was generated twice (initial + repair) due to banned string.
    expect(fileCalls).toBeGreaterThanOrEqual(2);
    // After repair, no banned hits remain.
    expect(res.visualQuality?.bannedHits).toEqual([]);
    // Files were persisted.
    expect(sb.calls.some((c) => c.table === "project_files")).toBe(true);
  });
});
