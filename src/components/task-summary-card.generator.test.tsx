// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskSummaryCard } from "./task-summary-card";
import type { Job, JobStep } from "@/services/jobs";

const baseJob = {
  id: "job-1",
  projectId: "proj-1",
  type: "ai.generate_changes",
  status: "succeeded",
  title: "Regenerate design",
  createdAt: new Date(Date.now() - 1000).toISOString(),
  startedAt: new Date(Date.now() - 1000).toISOString(),
  finishedAt: new Date().toISOString(),
} as unknown as Job;

const stepWithGen = {
  id: "step-1",
  jobId: "job-1",
  title: "build.production",
  status: "succeeded",
  output: {
    generator: "monster-brain-v1",
    archetype: "social-good",
    designSignature: "sig-abc-123",
    filesWritten: ["index.html", "app.css", "app.js"],
    previewReady: true,
  },
} as unknown as JobStep;

describe("TaskSummaryCard — generator proof block", () => {
  it("renders generator, archetype, designSignature, filesWritten and previewReady when present", () => {
    const html = renderToStaticMarkup(<TaskSummaryCard job={baseJob} steps={[stepWithGen]} />);
    expect(html).toContain("Generator");
    expect(html).toContain("monster-brain-v1");
    expect(html).toContain("social-good");
    expect(html).toContain("sig-abc-123");
    expect(html).toContain("index.html, app.css, app.js");
    expect(html).toContain("✓ true");
  });

  it("hides the Generator block when no generator metadata is reported", () => {
    const plainStep = {
      id: "s",
      jobId: "job-1",
      title: "noop",
      status: "succeeded",
      output: { stdoutTail: "hello" },
    } as unknown as JobStep;
    const html = renderToStaticMarkup(<TaskSummaryCard job={baseJob} steps={[plainStep]} />);
    // The "Generator" header should not appear (the proof block shows job/type/etc., not "Generator")
    expect(html).not.toContain(">Generator<");
  });
});
