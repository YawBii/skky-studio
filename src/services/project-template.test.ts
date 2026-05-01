import { describe, it, expect } from "vitest";
import {
  generateProjectFiles,
  detectCategory,
  inferProjectArchetype,
} from "./project-template";

describe("project-template (Monster Brain v1 shim)", () => {
  it("produces visibly different index.html for different projects", () => {
    const goodhand = generateProjectFiles({
      project: { id: "p-goodhand", name: "Goodhand", description: "Discover and verify community contributors." },
    });
    const skky = generateProjectFiles({
      project: { id: "p-skky", name: "skkygroup", description: "A holding group of long-horizon ventures." },
    });
    const ujob = generateProjectFiles({
      project: { id: "p-ujob", name: "uJob", description: "Marketplace for hiring and getting hired." },
    });

    const ghHtml = goodhand.find((f) => f.path === "index.html")!.content;
    const skHtml = skky.find((f) => f.path === "index.html")!.content;
    const ujHtml = ujob.find((f) => f.path === "index.html")!.content;

    expect(ghHtml).not.toEqual(skHtml);
    expect(ghHtml).not.toEqual(ujHtml);
    expect(skHtml).not.toEqual(ujHtml);

    expect(ghHtml).toContain("Goodhand");
    expect(skHtml).toContain("skkygroup");
    expect(ujHtml).toContain("uJob");

    // Archetype reflected in meta tag
    expect(ghHtml).toContain("social-good");
    expect(skHtml).toContain("corporate");
    expect(ujHtml).toContain("jobs");
  });

  it("infers archetypes from name + description", () => {
    expect(inferProjectArchetype({ id: "1", name: "Goodhand", description: "discovery" })).toBe("social-good");
    expect(inferProjectArchetype({ id: "2", name: "uJob", description: "" })).toBe("jobs");
    expect(inferProjectArchetype({ id: "3", name: "skkygroup", description: "holdings" })).toBe("corporate");
    expect(inferProjectArchetype({ id: "4", name: "PayFlow", description: "invoice payments" })).toBe("fintech");
    expect(inferProjectArchetype({ id: "5", name: "TrustID", description: "verification" })).toBe("identity");
    expect(inferProjectArchetype({ id: "6", name: "Arena", description: "multiplayer game" })).toBe("gaming");
    expect(inferProjectArchetype({ id: "7", name: "Random", description: "" })).toBe("default");
  });

  it("legacy detectCategory still maps correctly", () => {
    expect(detectCategory({ name: "Goodhand", description: "discovery" })).toBe("scanner");
    expect(detectCategory({ name: "uJob", description: "" })).toBe("marketplace");
    expect(detectCategory({ name: "skkygroup", description: "holdings" })).toBe("portfolio");
    expect(detectCategory({ name: "skkylab", description: "creative studio" })).toBe("studio");
    expect(detectCategory({ name: "si4", description: "ops dashboard" })).toBe("saas");
    expect(detectCategory({ name: "LastMan", description: "people directory" })).toBe("directory");
    expect(detectCategory({ name: "Random", description: "" })).toBe("generic");
  });

  it("returns index.html, app.css and app.js", () => {
    const files = generateProjectFiles({
      project: { id: "x", name: "X", description: "" },
    });
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["app.css", "app.js", "index.html"]);
  });

  it("emits valid HTML doctype", () => {
    const files = generateProjectFiles({ project: { id: "x", name: "X", description: "" } });
    expect(files.find((f) => f.path === "index.html")!.content.startsWith("<!doctype html>")).toBe(true);
  });

  it("escapes HTML-significant characters in project name and description", () => {
    const files = generateProjectFiles({
      project: { id: "x", name: "<script>alert(1)</script>", description: "</style><img src=x>" },
    });
    const html = files.find((f) => f.path === "index.html")!.content;
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("</style><img");
    expect(html).toContain("&lt;script&gt;");
  });
});
