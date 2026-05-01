import { describe, it, expect } from "vitest";
import {
  generateProjectFiles,
  detectCategory,
} from "./project-template";

describe("project-template generator", () => {
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

    // Project name must appear in each
    expect(ghHtml).toContain("Goodhand");
    expect(skHtml).toContain("skkygroup");
    expect(ujHtml).toContain("uJob");

    // Category must be reflected in the generator meta tag
    expect(ghHtml).toContain("scanner");
    expect(skHtml).toContain("portfolio");
    expect(ujHtml).toContain("marketplace");
  });

  it("detects categories from name + description + chat", () => {
    expect(detectCategory({ name: "Goodhand", description: "discovery" })).toBe("scanner");
    expect(detectCategory({ name: "uJob", description: "" })).toBe("marketplace");
    expect(detectCategory({ name: "skkygroup", description: "holdings" })).toBe("portfolio");
    expect(detectCategory({ name: "skkylab", description: "creative studio" })).toBe("studio");
    expect(detectCategory({ name: "si4", description: "ops dashboard" })).toBe("saas");
    expect(detectCategory({ name: "LastMan", description: "people directory" })).toBe("directory");
    expect(detectCategory({ name: "Random", description: "" })).toBe("generic");
  });

  it("returns at least index.html and app.css", () => {
    const files = generateProjectFiles({
      project: { id: "x", name: "X", description: "" },
    });
    const paths = files.map((f) => f.path).sort();
    expect(paths).toContain("index.html");
    expect(paths).toContain("app.css");
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
