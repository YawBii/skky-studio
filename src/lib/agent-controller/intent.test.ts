import { describe, it, expect } from "vitest";
import { classifyAgentIntent } from "./intent";

describe("classifyAgentIntent", () => {
  it("classifies homepage redesign as homepage", () => {
    const r = classifyAgentIntent({ userRequest: "Redesign homepage for law firm" });
    expect(r.artifactType).toBe("homepage");
    expect(r.domain).toBe("law-firm");
    expect(r.confidence).toBeGreaterThan(0.7);
  });

  it("classifies AI law firm app with cockpit/admin as app_dashboard", () => {
    const r = classifyAgentIntent({
      userRequest: "Build AI law firm app with case cockpit, invoices, admin panel, supabase",
    });
    expect(r.artifactType).toBe("app_dashboard");
  });

  it("classifies plan request as plan_only", () => {
    const r = classifyAgentIntent({ userRequest: "Give me a plan for law firm site" });
    expect(r.artifactType).toBe("plan_only");
  });

  it("classifies fix preview styling as fix_bug", () => {
    const r = classifyAgentIntent({ userRequest: "fix preview styling" });
    expect(r.artifactType).toBe("fix_bug");
  });

  it("classifies build website as homepage", () => {
    const r = classifyAgentIntent({ userRequest: "Build a business website" });
    expect(r.artifactType).toBe("homepage");
  });
});
