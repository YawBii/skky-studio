import { describe, expect, it } from "vitest";
import fs from "node:fs";

const src = fs.readFileSync("src/components/assistant-panel.tsx", "utf8");

describe("AssistantPanel direct build routing", () => {
  it("routes generic build prompts through direct-build-controller before streaming or legacy enqueue", () => {
    const sendIdx = src.indexOf("const send = async () =>");
    const directIdx = src.indexOf("runDirectBuildController", sendIdx);
    const streamIdx = src.indexOf("streamModelReply", sendIdx);
    const enqueueIdx = src.indexOf("enqueueJob", sendIdx);

    expect(sendIdx).toBeGreaterThan(-1);
    expect(directIdx).toBeGreaterThan(sendIdx);
    expect(directIdx).toBeLessThan(streamIdx);
    expect(directIdx).toBeLessThan(enqueueIdx);

    const directBlock = src.slice(directIdx, Math.min(streamIdx, enqueueIdx));
    expect(directBlock).toContain("direct-build-controller-v1");
    expect(directBlock).toContain("legacyEnqueue: false");
    expect(directBlock).toContain("aiGenerateChanges: false");
    expect(directBlock).toContain("return;");
  });

  it("does not allow build prompts to rely on ai.generate_changes first", () => {
    const sendIdx = src.indexOf("const send = async () =>");
    const directIdx = src.indexOf("runDirectBuildController", sendIdx);
    const aiGenerateIdx = src.indexOf("ai.generate_changes", sendIdx);

    expect(directIdx).toBeGreaterThan(sendIdx);
    if (aiGenerateIdx !== -1) {
      expect(directIdx).toBeLessThan(aiGenerateIdx);
    }
  });
});
