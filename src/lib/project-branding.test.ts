import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_BRANDING, resolveProjectBranding } from "./project-branding";
import { injectPublishedBranding } from "./published-branding";

describe("project branding", () => {
  it("uses SKKY defaults when a project has no overrides", () => {
    const branding = resolveProjectBranding({});
    expect(branding.logoUrl).toBe(DEFAULT_PROJECT_BRANDING.logoUrl);
    expect(branding.faviconUrl).toBe(DEFAULT_PROJECT_BRANDING.faviconUrl);
    expect(branding.watermarkUrl).toBe(DEFAULT_PROJECT_BRANDING.watermarkUrl);
    expect(branding.usesDefaultLogo).toBe(true);
    expect(branding.usesDefaultFavicon).toBe(true);
    expect(branding.usesDefaultWatermark).toBe(true);
  });

  it("allows per-project overrides", () => {
    const branding = resolveProjectBranding({
      logo_url: "https://example.com/logo.svg",
      favicon_url: "https://example.com/favicon.svg",
      watermark_url: "https://example.com/watermark.svg",
    });
    expect(branding.logoUrl).toBe("https://example.com/logo.svg");
    expect(branding.faviconUrl).toBe("https://example.com/favicon.svg");
    expect(branding.watermarkUrl).toBe("https://example.com/watermark.svg");
    expect(branding.usesDefaultLogo).toBe(false);
    expect(branding.usesDefaultFavicon).toBe(false);
    expect(branding.usesDefaultWatermark).toBe(false);
  });

  it("injects default favicon and watermark into legacy published HTML", () => {
    const html = injectPublishedBranding("<!doctype html><html><head><title>x</title></head><body>Hello</body></html>", {});
    expect(html).toContain(DEFAULT_PROJECT_BRANDING.faviconUrl);
    expect(html).toContain(DEFAULT_PROJECT_BRANDING.logoUrl);
    expect(html).toContain(DEFAULT_PROJECT_BRANDING.watermarkUrl);
    expect(html).toContain('name="yawb-branding-source" content="default"');
    expect(html).toContain("data-yawb-default-watermark");
  });
});
