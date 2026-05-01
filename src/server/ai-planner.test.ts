import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runAiPlan, isAiPlannerConfigured, AI_PLANNER_NOT_CONFIGURED_ERROR, type PlanContext } from "./ai-planner.server";

const baseCtx: PlanContext = {
  workspace: { id: "w1", name: "W" },
  project: { id: "p1", name: "Demo", description: "A demo project" },
  selectedPage: "/",
  selectedEnvironment: "preview",
  recentJobs: [],
  latestProofs: [],
  github: { connected: false },
  vercel: { connected: false },
  supabase: { connected: false },
  chatRequest: "Build a discovery feed",
};

describe("ai planner provider", () => {
  const ORIG_KEY = process.env.LOVABLE_API_KEY;
  const ORIG_KEY2 = process.env.AI_GATEWAY_KEY;

  beforeEach(() => {
    delete process.env.LOVABLE_API_KEY;
    delete process.env.AI_GATEWAY_KEY;
  });
  afterEach(() => {
    if (ORIG_KEY !== undefined) process.env.LOVABLE_API_KEY = ORIG_KEY;
    if (ORIG_KEY2 !== undefined) process.env.AI_GATEWAY_KEY = ORIG_KEY2;
    vi.restoreAllMocks();
  });

  it("returns the new setup error when no API key is configured", async () => {
    expect(isAiPlannerConfigured()).toBe(false);
    const r = await runAiPlan({ context: baseCtx, contextSources: ["projects"], baseMissing: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(AI_PLANNER_NOT_CONFIGURED_ERROR);
      expect(r.setupError).toBe(true);
      // Must NOT use the legacy placeholder error.
      expect(r.error).not.toMatch(/provider call is not wired yet/i);
    }
  });

  it("parses a successful tool-call response into PlanResult JSON", async () => {
    process.env.LOVABLE_API_KEY = "test-key";
    const planArgs = {
      summary: "Ship the discovery feed first.",
      recommendedActions: [
        {
          label: "Design discovery feed",
          reason: "Homepage has no main surface yet.",
          confidence: 0.9,
          risk: "low",
          category: "build_next",
          prompt: "Design /discover with cards",
          requiredProviders: [],
        },
      ],
      missingContext: ["latest_proofs"],
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{
          message: {
            tool_calls: [{
              function: { name: "submit_plan", arguments: JSON.stringify(planArgs) },
            }],
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const r = await runAiPlan({ context: baseCtx, contextSources: ["projects", "project_jobs"], baseMissing: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.summary).toContain("discovery feed");
      expect(r.plan.recommendedActions).toHaveLength(1);
      expect(r.plan.recommendedActions[0].category).toBe("build_next");
      expect(r.plan.recommendedActions[0].confidence).toBeCloseTo(0.9);
      expect(r.plan.proof.model).toBeTruthy();
      expect(r.plan.proof.contextSources).toContain("projects");
      expect(r.plan.missingContext).toContain("latest_proofs");
    }
  });

  it("surfaces gateway 402 errors as a typed setup-style failure", async () => {
    process.env.LOVABLE_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("payment required", { status: 402 }),
    );
    const r = await runAiPlan({ context: baseCtx, contextSources: [], baseMissing: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.httpStatus).toBe(402);
      expect(r.error).toMatch(/credits/i);
    }
  });
});
