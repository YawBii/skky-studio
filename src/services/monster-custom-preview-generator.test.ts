import { describe, expect, it } from "vitest";
import { createMonsterBlueprint } from "./monster-director";
import { generateMonsterCustomPreviewFiles } from "./monster-custom-preview-generator";

const project = { id: "p1", name: "LawForge", description: "AI law firm platform" };

describe("Monster custom preview generator", () => {
  it("generates law apps with case cockpit layout instead of editorial template shell", () => {
    const blueprint = createMonsterBlueprint({
      project,
      chatRequest:
        "Build a premium AI law firm app with auth, dashboard, admin panel, payments, and Supabase backend.",
    });
    const files = generateMonsterCustomPreviewFiles(blueprint);
    const index = files.find((file) => file.path === "index.html")?.content ?? "";
    expect(index).toContain('name="yawb-generator" content="monster-custom-preview-v1"');
    expect(index).toContain('name="yawb-layout" content="case-cockpit"');
    expect(index).toContain("legal operations with a case cockpit");
    expect(index).not.toContain("Money operations");
  });

  it("puts the required legal SaaS app surfaces in the first viewport without editorial artifacts", () => {
    const blueprint = createMonsterBlueprint({
      project,
      chatRequest:
        "Build a premium AI law firm app with auth, client intake, case cockpit, invoices, payments, admin panel, and Supabase backend.",
    });
    const files = generateMonsterCustomPreviewFiles(blueprint);
    const index = files.find((file) => file.path === "index.html")?.content ?? "";
    const styles = files.find((file) => file.path === "styles.css")?.content ?? "";
    const bodyStart = index.search(/<body[\s>]/i);
    const firstViewport = index.slice(bodyStart, bodyStart + 3000);
    const firstWorkflow = index.search(/Case cockpit|Matter board|Client intake/i);
    const firstImage = index.search(/<img[\s>]/i);

    expect(firstViewport).toMatch(/left|top|navigation|sidebar/i);
    expect(firstViewport).toMatch(/Case cockpit|Matter board/i);
    expect(firstViewport).toMatch(/Client intake/i);
    expect(firstViewport).toMatch(/Invoices|Payments/i);
    expect(firstViewport).toMatch(/Admin|Roles/i);
    expect(firstViewport).toMatch(/Supabase|RLS/i);
    expect(index).not.toMatch(
      /stock image|stock photo|article|briefing|library|publication|archive|manifesto|atelier|journal|sovereignty|luxury editorial|Lex Scripta|Private Tier/i,
    );
    expect(firstImage).toBe(-1);
    expect(firstWorkflow).toBeGreaterThan(-1);
    expect(styles).toMatch(/glass|backdrop-filter|grid|table/i);
  });

  it("generates identity prompts with trust radar layout", () => {
    const blueprint = createMonsterBlueprint({
      project: { id: "p2", name: "Proofly", description: "identity verification" },
      chatRequest:
        "Build an identity verification platform with profile trust graph, compliance and fraud signals.",
    });
    const index =
      generateMonsterCustomPreviewFiles(blueprint).find((file) => file.path === "index.html")
        ?.content ?? "";
    expect(index).toContain('name="yawb-layout" content="trust-radar"');
    expect(index).toContain("verification radar");
  });
});
