import { describe, it, expect } from "vitest";
import { generateProjectFiles, inferProjectArchetype } from "./monster-brain-generator";

const goodhand = { id: "p-good", name: "Goodhand", description: "Praise + scanner." };
const skky = { id: "p-skky", name: "skkygroup", description: "Holding group." };
const ujob = { id: "p-ujob", name: "uJob", description: "Hire and get hired." };
const lastman = {
  id: "p-lastman",
  name: "LastMan",
  description: "Identity verification + trust graph.",
};

function html(p: { id: string; name: string; description?: string | null }) {
  return generateProjectFiles(p).find((f) => f.path === "index.html")!.content;
}

describe("Monster Brain v1 — variance + LastMan", () => {
  it("LastMan resolves to identity archetype", () => {
    expect(inferProjectArchetype(lastman)).toBe("identity");
  });

  it("Goodhand, skkygroup, ujob, LastMan all render different HTML", () => {
    const a = html(goodhand);
    const b = html(skky);
    const c = html(ujob);
    const d = html(lastman);
    const set = new Set([a, b, c, d]);
    expect(set.size).toBe(4);
    expect(d.toLowerCase()).toContain("trust graph");
    expect(d).toContain("identity");
  });

  it("two ujob-shaped projects with different ids produce different HTML (per-project variance)", () => {
    const a = html({ id: "p-jobs-a", name: "uJob A", description: "hire" });
    const b = html({ id: "p-jobs-b", name: "uJob B", description: "hire" });
    expect(a).not.toEqual(b);
  });

  it("each main archetype renders at least 6 sections", () => {
    for (const p of [goodhand, skky, ujob, lastman]) {
      const h = html(p);
      const sections = (h.match(/<section\b/g) || []).length;
      expect(sections).toBeGreaterThanOrEqual(6);
    }
  });
});
