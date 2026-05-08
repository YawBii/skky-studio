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

  it("routes homepage prompts through Agent Controller before legacy enqueue or model streaming", () => {
    const sendIdx = src.indexOf("const send = async () =>");
    const controllerIdx = src.indexOf("dispatchAgentRequest", sendIdx);
    const streamIdx = src.indexOf("streamModelReply", sendIdx);
    const legacyEnqueueIdx = src.indexOf("const r = await enqueueJob", sendIdx);
    expect(sendIdx).toBeGreaterThan(-1);
    expect(controllerIdx).toBeGreaterThan(sendIdx);
    expect(controllerIdx).toBeLessThan(streamIdx);
    expect(controllerIdx).toBeLessThan(legacyEnqueueIdx);
    expect(src.slice(controllerIdx, legacyEnqueueIdx)).toContain("return;");
    expect(src.slice(controllerIdx, legacyEnqueueIdx)).toContain("agent-controller-v1");
    expect(src.slice(controllerIdx, legacyEnqueueIdx)).toContain("legacyEnqueue: false");
  });
});
