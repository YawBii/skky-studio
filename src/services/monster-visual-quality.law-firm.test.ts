import { describe, expect, it } from "vitest";
import { evaluateVisualQuality } from "./monster-visual-quality";
import { createMonsterBlueprint } from "./monster-director";
import { generateMonsterCustomPreviewFiles } from "./monster-custom-preview-generator";
import { generateMonsterDesignBrief } from "./monster-design-brief";

const lawProject = { id: "law", name: "LawForge", description: "AI law firm platform" };
const lawRequest =
  "Build a premium AI law firm app with auth, client intake, case cockpit, invoices, payments, admin roles, and Supabase backend.";

describe("Visual quality gate — law firm above-fold tokens", () => {
  const blueprint = createMonsterBlueprint({ project: lawProject, chatRequest: lawRequest });
  const brief = generateMonsterDesignBrief(blueprint, lawRequest);
  const files = generateMonsterCustomPreviewFiles(blueprint, brief);

  it("generated law preview contains required app surfaces above the fold", () => {
    const index = files.find((f) => f.path === "index.html")!.content;
    const bodyMatch = index.match(/<body[\s\S]{0,3500}/i)!;
    const aboveFold = bodyMatch[0];
    expect(aboveFold).toMatch(/Client intake/i);
    expect(aboveFold).toMatch(/Case cockpit|Matter board/i);
  });

  it("evaluator passes law-firm-tokens-present and workflow-above-fold", () => {
    const report = evaluateVisualQuality({ files, brief });
    const findCheck = (id: string) => report.checks.find((c) => c.id === id);
    expect(findCheck("law-firm-tokens-present")?.passed).toBe(true);
    expect(findCheck("workflow-above-fold")?.passed).toBe(true);
    expect(findCheck("hero-not-oversized")?.passed).toBe(true);
  });

  it("fails when given an editorial/manifesto landing page only", () => {
    const editorial = `<!doctype html><html><head><meta name="viewport" content="width=device-width"/><style>h1{font-size:clamp(72px,9vw,128px)} @media(max-width:600px){body{padding:0}}</style></head><body><nav><a>Manifesto</a><a>Atelier</a><a>Journal</a></nav><h1>The Sovereignty of Law</h1><p>law firm legal matter</p></body></html>`;
    const report = evaluateVisualQuality({
      files: [{ path: "index.html", content: editorial, language: "html", kind: "source" }],
      brief,
    });
    expect(report.passed).toBe(false);
    expect(report.bannedHits).toContain("Manifesto");
    expect(report.bannedHits).toContain("Atelier");
    expect(report.bannedHits).toContain("Journal");
    const fold = report.checks.find((c) => c.id === "workflow-above-fold");
    expect(fold?.passed).toBe(false);
    const hero = report.checks.find((c) => c.id === "hero-not-oversized");
    expect(hero?.passed).toBe(false);
    const tokens = report.checks.find((c) => c.id === "law-firm-tokens-present");
    expect(tokens?.passed).toBe(false);
  });
});
