// Resolves which preview to render in the Builder Preview tab.
// Live (Vercel deploy URL) is preferred when available. Otherwise we render
// a local preview — either a generated index.html via srcDoc, or an
// in-app /preview/$projectId route, or a friendly empty local state.

import type { ProjectConnection } from "@/services/project-connections";
import type { Project } from "@/services/projects";
import { resolveDeployUrl } from "@/lib/deploy-url";

export type PreviewKind = "live" | "local" | "empty";

export interface GeneratedFiles {
  /** Optional generated HTML document — rendered into the iframe via srcDoc. */
  indexHtml?: string | null;
  /** Whether the project has any generated files at all. */
  hasFiles?: boolean;
}

export interface ResolvedPreviewSource {
  kind: PreviewKind;
  /** External URL to load (live deploy or local preview route). */
  url?: string;
  /** Inline HTML document for the iframe (preferred for local preview). */
  srcDoc?: string;
  /** Short label for the URL bar / badge. */
  label: string;
  /** Whether the "Open in new tab" button should be enabled. */
  externalOpenable: boolean;
  /** Why this source was chosen — surfaced in logs. */
  reason: string;
}

export interface PreviewResolverInput {
  project: Pick<Project, "id" | "name"> | null | undefined;
  connections: ProjectConnection[] | null | undefined;
  generated?: GeneratedFiles | null;
  /** Force a particular kind when both are available (user toggle). */
  preferred?: "live" | "local";
}

/** True if the project has any locally renderable preview content. */
export function hasLocalPreview(generated: GeneratedFiles | null | undefined): boolean {
  if (!generated) return false;
  if (typeof generated.indexHtml === "string" && generated.indexHtml.length > 0) return true;
  return generated.hasFiles === true;
}

export function resolvePreviewSource(input: PreviewResolverInput): ResolvedPreviewSource {
  const { project, connections, generated, preferred } = input;
  const live = resolveDeployUrl(connections);
  const liveUrl = live.url;
  const local = hasLocalPreview(generated);

  // User explicitly picked local but it's not available -> fall through.
  if (preferred === "local" && (local || project)) {
    return buildLocal(project, generated);
  }

  if (preferred === "live" && liveUrl) {
    return {
      kind: "live",
      url: liveUrl,
      label: liveUrl,
      externalOpenable: true,
      reason: `live:${live.source}`,
    };
  }

  // Default policy: live wins when present, else local, else empty.
  if (liveUrl && preferred !== "local") {
    return {
      kind: "live",
      url: liveUrl,
      label: liveUrl,
      externalOpenable: true,
      reason: `live:${live.source}`,
    };
  }

  if (local || project) {
    return buildLocal(project, generated);
  }

  return {
    kind: "empty",
    label: "No preview yet",
    externalOpenable: false,
    reason: "no-project",
  };
}

function buildLocal(
  project: Pick<Project, "id" | "name"> | null | undefined,
  generated: GeneratedFiles | null | undefined,
): ResolvedPreviewSource {
  if (generated && typeof generated.indexHtml === "string" && generated.indexHtml.length > 0) {
    return {
      kind: "local",
      srcDoc: generated.indexHtml,
      label: "Local preview",
      externalOpenable: false,
      reason: "local:srcDoc",
    };
  }
  if (project) {
    return {
      kind: "local",
      url: `/preview/${project.id}?embed=1`,
      label: "Local preview",
      externalOpenable: false,
      reason: hasLocalPreview(generated) ? "local:route+files" : "local:route-empty",
    };
  }
  return {
    kind: "empty",
    label: "No preview yet",
    externalOpenable: false,
    reason: "no-project",
  };
}
