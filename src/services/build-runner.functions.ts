// Returns presence-only booleans for the server-side build runner env.
// Never returns secret values. Used by the UI's runner diagnostics block.
import { createServerFn } from "@tanstack/react-start";

export interface BuildRunnerConfigSnapshot {
  mode: "external" | "local" | "none";
  hasBuildRunnerUrl: boolean;
  hasBuildRunnerToken: boolean;
  hasBuildRunnerMode: boolean;
  hasBuildCommand: boolean;
  hasTypecheckCommand: boolean;
  hasBuildPreviewCommand: boolean;
  reason: string;
}

export const getBuildRunnerConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<BuildRunnerConfigSnapshot> => {
    const { getBuildRunnerConfigServer } = await import("../server/jobs-runner.server");
    return getBuildRunnerConfigServer();
  },
);
