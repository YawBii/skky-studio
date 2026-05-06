import { describe, expect, it } from "vitest";
import { detectBuildIntent } from "./build-intent";

describe("detectBuildIntent", () => {
  it("flags law-firm build prompt as build", () => {
    const r = detectBuildIntent(
      "Build a premium AI law firm app with auth, client intake, case cockpit, invoices, payments, admin panel, and Supabase backend",
    );
    expect(r.isBuild).toBe(true);
  });

  it("treats explicit plan request as plan-only", () => {
    const r = detectBuildIntent("Give me an implementation plan for a CRM");
    expect(r.isBuild).toBe(false);
  });

  it("treats audit/review as plan-only", () => {
    expect(detectBuildIntent("audit the auth flow").isBuild).toBe(false);
  });

  it("ignores empty input", () => {
    expect(detectBuildIntent("").isBuild).toBe(false);
  });

  it("flags 'create dashboard with auth and supabase'", () => {
    expect(detectBuildIntent("Create a dashboard with auth and supabase").isBuild).toBe(true);
  });
});
