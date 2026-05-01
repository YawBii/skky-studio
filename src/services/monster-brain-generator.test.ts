import { describe, it, expect } from "vitest";
import {
  generateProjectFiles,
  inferProjectArchetype,
  designSignature,
} from "./monster-brain-generator";

const goodhand = { id: "p-goodhand", name: "Goodhand", description: "Discover and verify community contributors with praise." };
const skky     = { id: "p-skky",     name: "skkygroup", description: "A holding group of long-horizon ventures and infrastructure." };
const ujob     = { id: "p-ujob",     name: "uJob",      description: "Marketplace for hiring and getting hired — find roles and candidates." };

function html(p: typeof goodhand) {
  return generateProjectFiles(p).find((f) => f.path === "index.html")!.content;
}

describe("Monster Brain v1 — archetype detection", () => {
  it("Goodhand → social-good", () => {
    expect(inferProjectArchetype(goodhand)).toBe("social-good");
  });
  it("skkygroup → corporate", () => {
    expect(inferProjectArchetype(skky)).toBe("corporate");
  });
  it("ujob → jobs", () => {
    expect(inferProjectArchetype(ujob)).toBe("jobs");
  });
  it("fallback when nothing matches", () => {
    expect(inferProjectArchetype({ id: "x", name: "Quiver", description: "" })).toBe("default");
  });
});

describe("Monster Brain v1 — generated layouts are domain-specific", () => {
  it("Goodhand renders scanner / praise / impact concepts", () => {
    const h = html(goodhand);
    expect(h.toLowerCase()).toContain("scanner");
    expect(h.toLowerCase()).toContain("praise");
    expect(h.toLowerCase()).toContain("impact");
    expect(h).toContain("social-good");
  });
  it("skkygroup renders portfolio / regions / architecture / contact concepts", () => {
    const h = html(skky);
    expect(h.toLowerCase()).toContain("portfolio");
    expect(h.toLowerCase()).toContain("regions");
    expect(h.toLowerCase()).toContain("architecture");
    expect(h.toLowerCase()).toContain("contact");
    expect(h).toContain("corporate");
  });
  it("ujob renders search / roles / candidates / company concepts", () => {
    const h = html(ujob);
    expect(h.toLowerCase()).toContain("search");
    expect(h.toLowerCase()).toContain("roles");
    expect(h.toLowerCase()).toContain("candidates");
    expect(h.toLowerCase()).toContain("companies");
    expect(h).toContain("jobs");
  });
});

describe("Monster Brain v1 — outputs are visibly different", () => {
  it("Goodhand vs skkygroup vs ujob produce different index.html", () => {
    const a = html(goodhand);
    const b = html(skky);
    const c = html(ujob);
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
    expect(b).not.toEqual(c);
  });

  it("two projects of the same archetype still differ via design signature", () => {
    const a = generateProjectFiles({ id: "id-a", name: "Goodhand A", description: "discovery praise" });
    const b = generateProjectFiles({ id: "id-b", name: "Goodhand B", description: "discovery praise" });
    expect(a.find((f) => f.path === "index.html")!.content)
      .not.toEqual(b.find((f) => f.path === "index.html")!.content);
    expect(designSignature({ id: "id-a", name: "Goodhand A" }, "social-good"))
      .not.toEqual(designSignature({ id: "id-b", name: "Goodhand B" }, "social-good"));
  });
});

describe("Monster Brain v1 — file shape", () => {
  it("emits index.html, app.css and app.js", () => {
    const files = generateProjectFiles(goodhand);
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["app.css", "app.js", "index.html"]);
    expect(files.find((f) => f.path === "app.css")!.content.length).toBeGreaterThan(200);
    expect(files.find((f) => f.path === "app.js")!.content.length).toBeGreaterThan(40);
  });

  it("never falls back to the generic placeholder copy", () => {
    for (const p of [goodhand, skky, ujob, { id: "z", name: "Quiver", description: "" }]) {
      const h = html(p);
      expect(h).not.toContain("No generated screens yet");
      expect(h).not.toContain("Tell yawB to build");
      expect(h.toLowerCase()).not.toContain("lorem ipsum");
    }
  });

  it("escapes hostile name/description input", () => {
    const h = html({ id: "x", name: "<script>x</script>", description: "</style><img>" });
    expect(h).not.toContain("<script>x</script>");
    expect(h).not.toContain("</style><img>");
    expect(h).toContain("&lt;script&gt;");
  });
});
