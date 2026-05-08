// Preview mismatch guard — detects when the rendered/written homepage HTML
// still contains stale dashboard/cockpit/LexOS tokens. Used by the chat
// handler to refuse "Done" and surface a visible warning.

import type { ArtifactType } from "./types";
import {
  FORBIDDEN_DASHBOARD_TOKENS,
  findForbiddenDashboardTokens,
} from "./forbidden-dashboard-tokens";

export { FORBIDDEN_DASHBOARD_TOKENS };

export interface PreviewMismatchInput {
  expectedArtifact: ArtifactType;
  html: string | null | undefined;
  css?: string | null | undefined;
}

export interface PreviewMismatchResult {
  expectedArtifact: ArtifactType;
  previewMismatch: boolean;
  forbiddenTokensFound: string[];
}

export function detectPreviewMismatch(input: PreviewMismatchInput): PreviewMismatchResult {
  const output = `${input.html ?? ""}\n${input.css ?? ""}`;
  if (input.expectedArtifact !== "homepage" || !output.trim()) {
    return {
      expectedArtifact: input.expectedArtifact,
      previewMismatch: false,
      forbiddenTokensFound: [],
    };
  }
  const found = findForbiddenDashboardTokens(output);
  return {
    expectedArtifact: input.expectedArtifact,
    previewMismatch: found.length > 0,
    forbiddenTokensFound: found,
  };
}
