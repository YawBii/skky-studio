// Preview mismatch guard — detects when the rendered/written homepage HTML
// still contains stale dashboard/cockpit/LexOS tokens. Used by the chat
// handler to refuse "Done" and surface a visible warning.

import type { ArtifactType } from "./types";

export const FORBIDDEN_DASHBOARD_TOKENS: Array<{ id: string; re: RegExp }> = [
  { id: "Matter board", re: /matter[-\s]*board/i },
  { id: "Case cockpit", re: /case[-\s]*cockpit/i },
  { id: "Active matters", re: /active[-\s]*matters/i },
  { id: "RLS policies", re: /\brls\s*polic(?:y|ies)/i },
  { id: "Supabase locked", re: /supabase[-\s]*locked/i },
  { id: "Admin panel", re: /\badmin[-\s]*panel\b/i },
  { id: "KPI grid", re: /\bkpi[-\s]*grid\b/i },
  { id: "LexOS", re: /\blex\s*os\b/i },
  { id: "Client intake queue", re: /client[-\s]*intake[-\s]*queue/i },
  { id: "Invoices dashboard", re: /invoices[-\s]*dashboard/i },
  { id: "Roles & access", re: /roles\s*(?:&|and)\s*access/i },
  { id: "Schema / RLS", re: /schema\s*\/\s*rls/i },
  { id: "app dashboard shell", re: /\bapp[-\s]*dashboard\s*shell\b/i },
];

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
  const found: string[] = [];
  for (const t of FORBIDDEN_DASHBOARD_TOKENS) {
    if (t.re.test(output)) found.push(t.id);
  }
  return {
    expectedArtifact: input.expectedArtifact,
    previewMismatch: found.length > 0,
    forbiddenTokensFound: found,
  };
}
