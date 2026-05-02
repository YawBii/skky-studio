import { describe, it, expect } from "vitest";
import {
  generateProjectFiles,
  designSignature,
  inferProjectArchetype,
} from "./monster-brain-generator";

const project = { id: "p-x", name: "Goodhand", description: "scanner that praises kind humans" };

function indexHtml(p: typeof project, ctx?: Parameters<typeof generateProjectFiles>[1]) {
  return generateProjectFiles(p, ctx).find((f) => f.path === "index.html")!.content;
}

describe("Monster Brain v1 — regenerationSeed variance", () => {
  it("same project without regenerationSeed produces identical HTML", () => {
    const a = indexHtml(project);
    const b = indexHtml(project);
    expect(a).toEqual(b);
  });

  it("same project with different regenerationSeeds produces different HTML", () => {
    const a = indexHtml(project, { regenerationSeed: "seed-A" });
    const b = indexHtml(project, { regenerationSeed: "seed-B" });
    expect(a).not.toEqual(b);
  });

  it("designSignature differs when regenerationSeed differs", () => {
    const arch = inferProjectArchetype(project);
    const sigA = designSignature(project, arch, { regenerationSeed: "seed-A" });
    const sigB = designSignature(project, arch, { regenerationSeed: "seed-B" });
    expect(sigA).not.toEqual(sigB);
    expect(sigA).toContain("variant-");
    expect(sigA).toContain("seed");
  });

  it("designSignature without seed has no seed tag", () => {
    const arch = inferProjectArchetype(project);
    const sig = designSignature(project, arch);
    expect(sig).not.toContain(":seed");
    expect(sig).toContain("variant-");
  });

  it("forceVariant alone changes section order vs deterministic baseline", () => {
    const a = indexHtml(project);
    const b = indexHtml(project, { forceVariant: true, regenerationSeed: "alt" });
    expect(a).not.toEqual(b);
  });
});
