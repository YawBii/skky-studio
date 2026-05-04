import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(process.cwd(), "src/components/assistant-panel.tsx"), "utf8");

describe("AssistantPanel freeze gate", () => {
  it("does not call useSelectedProject internally", () => {
    expect(src).not.toMatch(/useSelectedProject/);
  });

  it("is driven by project/workspace props", () => {
    expect(src).toMatch(/project:\s*Project\s*\|\s*null/);
    expect(src).toMatch(/workspace:\s*Workspace\s*\|\s*null/);
    expect(src).toMatch(/enabled\?:\s*boolean/);
  });

  it("keeps job and connection hooks disabled until chat is used", () => {
    expect(src).toMatch(/const \[liveEnabled, setLiveEnabled\] = useState\(false\)/);
    expect(src).toMatch(/enabled:\s*effectiveEnabled/);
    expect(src).toMatch(/setLiveEnabled\(true\)/);
  });
});
