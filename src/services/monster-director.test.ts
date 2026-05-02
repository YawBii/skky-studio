import { describe, expect, it } from "vitest";
import {
  createMonsterBlueprint,
  inferMonsterAppType,
  inferMonsterDesignMode,
} from "./monster-director";

const project = { id: "p1", name: "yawB", description: "prompt first app builder" };

describe("Monster Director", () => {
  it("infers a premium law firm as luxury editorial without template selection", () => {
    const input = {
      project,
      chatRequest: "Build a premium AI law firm with auth, dashboard, admin and payments",
    };
    expect(inferMonsterAppType(input)).toBe("professional-services");
    expect(inferMonsterDesignMode(input)).toBe("editorial-luxury");
    const blueprint = createMonsterBlueprint(input);
    expect(blueprint.design.mode).toBe("editorial-luxury");
    expect(blueprint.routes.some((r) => r.path === "/dashboard")).toBe(true);
    expect(blueprint.routes.some((r) => r.path === "/admin" && r.auth === "role")).toBe(true);
    expect(blueprint.backend.mode).toBe("supabase");
    expect(blueprint.acceptanceTests).toContain(
      "First run does not require choosing a template or design angle",
    );
  });

  it("infers dashboard prompts as rich glass dashboard products", () => {
    const blueprint = createMonsterBlueprint({
      project,
      chatRequest: "Create an analytics admin dashboard for operators with metrics and audit logs",
    });
    expect(blueprint.appType).toBe("saas-dashboard");
    expect(blueprint.design.mode).toBe("glass-dashboard");
    expect(blueprint.design.visualDensity).toBe("rich");
  });

  it("honors explicit design override but keeps production wiring expectations", () => {
    const blueprint = createMonsterBlueprint({
      project,
      chatRequest: "Build a marketplace for auction listings",
      requestedDesignMode: "neon-command",
    });
    expect(blueprint.appType).toBe("marketplace");
    expect(blueprint.design.mode).toBe("neon-command");
    expect(blueprint.integrations.find((i) => i.provider === "github")?.required).toBe(true);
    expect(blueprint.integrations.find((i) => i.provider === "supabase")?.required).toBe(true);
    expect(blueprint.integrations.find((i) => i.provider === "vercel")?.required).toBe(true);
  });
});
