import { describe, it, expect } from "vitest";
import { buildSmartSuggestions, extractPlanActions } from "./suggestion-engine";
import type { Job, JobStatus } from "@/services/jobs";

function mkJob(p: { id: string; type: string; status: JobStatus; createdAt: string; error?: string; output?: Record<string, unknown> }): Job {
  return {
    id: p.id, projectId: "p", workspaceId: "w", type: p.type, status: p.status,
    title: p.id, input: {}, output: p.output ?? {}, error: p.error ?? null, retryCount: 0,
    createdBy: "u", createdAt: p.createdAt, startedAt: null, finishedAt: null,
  };
}

const baseCtx = {
  workspace: { id: "w", name: "W" } as never,
  project: { id: "p", name: "App", description: "" } as never,
  connections: [],
  diagnostics: { lastError: null, providerConnectionStatus: null } as never,
};

describe("suggestion engine retry suggestions", () => {
  it("emits Retry when latest failure has no resolving success", () => {
    const jobs = [
      mkJob({ id: "f1", type: "build.production", status: "failed", createdAt: "2026-05-01T11:00:00Z", error: "boom" }),
    ];
    const out = buildSmartSuggestions({ ...baseCtx, jobs });
    expect(out.some((s) => s.id.startsWith("retry-"))).toBe(true);
  });

  it("does NOT emit Retry when latest failure is resolved by a newer success", () => {
    const jobs = [
      mkJob({ id: "s1", type: "build.production", status: "succeeded", createdAt: "2026-05-01T12:00:00Z" }),
      mkJob({ id: "f1", type: "build.production", status: "failed", createdAt: "2026-05-01T11:00:00Z", error: "invalid bearer token" }),
    ];
    const out = buildSmartSuggestions({ ...baseCtx, jobs });
    expect(out.some((s) => s.id.startsWith("retry-"))).toBe(false);
  });

  it("does NOT emit Retry for ai.plan provider-not-wired placeholder failure", () => {
    const jobs = [
      mkJob({ id: "f1", type: "ai.plan", status: "failed", createdAt: "2026-05-01T11:00:00Z", error: "Provider call is not wired yet — no real changes were made." }),
    ];
    const out = buildSmartSuggestions({ ...baseCtx, jobs });
    expect(out.some((s) => s.id.startsWith("retry-"))).toBe(false);
    expect(out.some((s) => s.id === "wire-ai-planner-provider")).toBe(true);
  });

  it("DOES emit Retry for a real ai.plan runtime error", () => {
    const jobs = [
      mkJob({ id: "f1", type: "ai.plan", status: "failed", createdAt: "2026-05-01T11:00:00Z", error: "TypeError: cannot read property foo of undefined" }),
    ];
    const out = buildSmartSuggestions({ ...baseCtx, jobs });
    expect(out.some((s) => s.id.startsWith("retry-"))).toBe(true);
    expect(out.some((s) => s.id === "wire-ai-planner-provider")).toBe(false);
  });
});

describe("Monster Brain v1 — ai.plan integration", () => {
  it("emits Configure AI provider (NOT Retry) for ai.plan setup failure", () => {
    const jobs = [
      mkJob({
        id: "f1", type: "ai.plan", status: "failed",
        createdAt: "2026-05-01T11:00:00Z",
        error: "AI planner provider is not configured.",
      }),
    ];
    const out = buildSmartSuggestions({ ...baseCtx, jobs });
    expect(out.some((s) => s.id === "configure-ai-provider")).toBe(true);
    expect(out.some((s) => s.id.startsWith("retry-"))).toBe(false);
  });

  it("never re-emits the legacy 'provider call is not wired yet' error text", () => {
    // Simulate a successful new-provider run + a fresh suggestion build.
    const jobs = [
      mkJob({
        id: "s1", type: "ai.plan", status: "succeeded",
        createdAt: "2026-05-01T12:00:00Z",
        output: { plan: { recommendedActions: [], summary: "ok", missingContext: [], proof: { model: "x", durationMs: 1, contextSources: [] } } },
      }),
    ];
    const out = buildSmartSuggestions({ ...baseCtx, jobs });
    for (const s of out) {
      expect(s.label).not.toMatch(/provider call is not wired yet/i);
      expect(s.reason).not.toMatch(/provider call is not wired yet/i);
      expect(s.explanation ?? "").not.toMatch(/provider call is not wired yet/i);
    }
  });

  it("consumes recommendedActions from the latest successful ai.plan", () => {
    const jobs = [
      mkJob({
        id: "p1", type: "ai.plan", status: "succeeded",
        createdAt: "2026-05-01T12:00:00Z",
        output: {
          plan: {
            summary: "do these",
            missingContext: [],
            proof: { model: "google/gemini-3-flash-preview", durationMs: 250, contextSources: ["projects"] },
            recommendedActions: [
              {
                label: "Wire discovery feed",
                reason: "Homepage has no main surface.",
                confidence: 0.92, risk: "low", category: "build_next",
                prompt: "Build /discover", requiredProviders: [],
              },
              {
                label: "Add review queue",
                reason: "Auto-publish is unsafe.",
                confidence: 0.8, risk: "medium", category: "improve_quality",
                prompt: "Add /review", requiredProviders: ["supabase"],
              },
            ],
          },
        },
      }),
    ];
    const out = buildSmartSuggestions({ ...baseCtx, jobs });
    const aiSugg = out.filter((s) => s.id.startsWith("ai-plan-p1-"));
    expect(aiSugg.length).toBeGreaterThanOrEqual(1);
    const labels = aiSugg.map((s) => s.label);
    expect(labels).toContain("Wire discovery feed");
    // AI suggestions outrank generic build_next chips.
    const top = out[0];
    expect(top.id).toMatch(/^ai-plan-p1-/);
  });

  it("extractPlanActions tolerates malformed plan output", () => {
    expect(extractPlanActions(null)).toEqual([]);
    expect(extractPlanActions({ plan: { recommendedActions: "nope" } })).toEqual([]);
    expect(extractPlanActions({ plan: { recommendedActions: [{ label: "x" }] } })).toEqual([{
      label: "x", reason: "", category: "build_next", prompt: "", confidence: 0.5, risk: "low",
  }]);
  });
});

describe("stale suggestion suppression", () => {
  function vercelConn(status: "connected" | "pending" | "error" | "disconnected") {
    return {
      id: "c1", projectId: "p", provider: "vercel", status,
      repoFullName: null, repoUrl: null, defaultBranch: null,
      metadata: {}, createdBy: "u", createdAt: "", updatedAt: "",
      workspaceId: null, externalId: null, url: null,
      tokenOwnerType: null, providerAccountId: null,
    } as never;
  }

  it("does NOT suggest 'Connect Vercel' when a connected Vercel row exists (even after a deploy attempt)", () => {
    const jobs = [
      mkJob({ id: "d1", type: "vercel.create_preview_deploy", status: "succeeded", createdAt: "2026-05-01T12:00:00Z" }),
    ];
    const out = buildSmartSuggestions({
      ...baseCtx,
      jobs,
      connections: [vercelConn("connected")],
    });
    expect(out.some((s) => s.id === "connect-vercel")).toBe(false);
  });

  it("does NOT show 'Wire AI planner provider' for stale ai.plan placeholder failure once a successful ai.plan exists", () => {
    const jobs = [
      mkJob({
        id: "ok", type: "ai.plan", status: "succeeded",
        createdAt: "2026-05-01T12:00:00Z",
        output: { plan: { recommendedActions: [], summary: "ok", missingContext: [], proof: { model: "x", durationMs: 1, contextSources: [] } } },
      }),
      mkJob({
        id: "old", type: "ai.plan", status: "failed",
        createdAt: "2026-05-01T10:00:00Z",
        error: "Provider call is not wired yet — no real changes were made.",
      }),
    ];
    const out = buildSmartSuggestions({ ...baseCtx, jobs });
    expect(out.some((s) => s.id === "wire-ai-planner-provider")).toBe(false);
    // and no retry/resolve-wiring chip either
    expect(out.some((s) => s.id.startsWith("retry-"))).toBe(false);
  });

  it("STILL shows 'Wire AI planner provider' for placeholder failure when no successful ai.plan exists yet", () => {
    const jobs = [
      mkJob({
        id: "old", type: "ai.plan", status: "failed",
        createdAt: "2026-05-01T10:00:00Z",
        error: "Provider call is not wired yet — no real changes were made.",
      }),
    ];
    const out = buildSmartSuggestions({ ...baseCtx, jobs });
    expect(out.some((s) => s.id === "wire-ai-planner-provider")).toBe(true);
  });
});

describe("ai.plan recommendedActions stale filtering", () => {
  function vercelConn() {
    return {
      id: "c1", projectId: "p", provider: "vercel", status: "connected",
      repoFullName: null, repoUrl: null, defaultBranch: null,
      metadata: {}, createdBy: "u", createdAt: "", updatedAt: "",
      workspaceId: null, externalId: null, url: null,
      tokenOwnerType: null, providerAccountId: null,
    } as never;
  }

  it("removes 'Connect Vercel' style AI recs when Vercel is connected", () => {
    const jobs = [
      mkJob({
        id: "p1", type: "ai.plan", status: "succeeded",
        createdAt: "2026-05-01T12:00:00Z",
        output: {
          plan: {
            recommendedActions: [
              { label: "Connect Vercel project", reason: "deploy", confidence: 0.9, risk: "low", category: "connect_provider", prompt: "Link Vercel project to this app", requiredProviders: [] },
              { label: "Build /discover feed", reason: "homepage", confidence: 0.9, risk: "low", category: "build_next", prompt: "Build /discover", requiredProviders: [] },
            ],
          },
        },
      }),
    ];
    const out = buildSmartSuggestions({ ...baseCtx, jobs, connections: [vercelConn()] });
    const aiSugg = out.filter((s) => s.id.startsWith("ai-plan-p1-"));
    const labels = aiSugg.map((s) => s.label);
    expect(labels).toContain("Build /discover feed");
    expect(labels.find((l) => /vercel/i.test(l))).toBeUndefined();
  });

  it("removes AI provider setup AI recs after a successful ai.plan", () => {
    const jobs = [
      mkJob({
        id: "p1", type: "ai.plan", status: "succeeded",
        createdAt: "2026-05-01T12:00:00Z",
        output: {
          plan: {
            recommendedActions: [
              { label: "Configure AI provider key", reason: "setup", confidence: 0.9, risk: "low", category: "blocking", prompt: "Set LOVABLE_API_KEY", requiredProviders: [] },
              { label: "Add review queue", reason: "safety", confidence: 0.9, risk: "low", category: "improve_quality", prompt: "Build /review", requiredProviders: [] },
            ],
          },
        },
      }),
    ];
    const out = buildSmartSuggestions({ ...baseCtx, jobs });
    const aiSugg = out.filter((s) => s.id.startsWith("ai-plan-p1-"));
    const labels = aiSugg.map((s) => s.label);
    expect(labels).toContain("Add review queue");
    expect(labels.find((l) => /ai provider/i.test(l))).toBeUndefined();
  });
});

