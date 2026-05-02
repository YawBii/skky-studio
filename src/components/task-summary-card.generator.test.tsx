import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskSummaryCard } from "./task-summary-card";
import type { Job, JobStep } from "@/services/jobs";

const baseJob: Job = {
  id: "job-1",
  projectId: "proj-1",
  type: "ai.generate_changes",
  status: "succeeded",
  title: "Regenerate design",
  createdAt: new Date(Date.now() - 1000).toISOString(),
  startedAt: new Date(Date.now() - 1000).toISOString(),
  finishedAt: new Date().toISOString(),
} as unknown as Job;

const stepWithGen: JobStep = {
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
    render(<TaskSummaryCard job={baseJob} steps={[stepWithGen]} />);
    expect(screen.getByText("Generator")).toBeInTheDocument();
    expect(screen.getByText("monster-brain-v1")).toBeInTheDocument();
    expect(screen.getByText("social-good")).toBeInTheDocument();
    expect(screen.getByText("sig-abc-123")).toBeInTheDocument();
    expect(screen.getByText("index.html, app.css, app.js")).toBeInTheDocument();
    expect(screen.getByText("✓ true")).toBeInTheDocument();
  });

  it("hides the Generator block when no generator metadata is reported", () => {
    const plainStep: JobStep = {
      id: "s",
      jobId: "job-1",
      title: "noop",
      status: "succeeded",
      output: { stdoutTail: "hello" },
    } as unknown as JobStep;
    render(<TaskSummaryCard job={baseJob} steps={[plainStep]} />);
    expect(screen.queryByText("Generator")).not.toBeInTheDocument();
  });
});
