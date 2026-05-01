// Resolves the active deploy URL for a project from project_connections rows
// and (optionally) from project metadata.
import type { ProjectConnection } from "@/services/project-connections";

export type DeployUrlSource =
  | "vercel.lastPreviewDeployment"
  | "vercel.connection.url"
  | "project.metadata.previewUrl"
  | "project.metadata.deployUrl"
  | "none";

export interface ResolvedDeployUrl {
  url: string | null;
  source: DeployUrlSource;
  connectionId: string | null;
}

function pickStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function resolveDeployUrl(
  connections: ProjectConnection[] | null | undefined,
  projectMetadata?: Record<string, unknown> | null,
): ResolvedDeployUrl {
  const vercel = (connections ?? []).find(
    (c) => c.provider === "vercel" && c.status === "connected",
  );

  if (vercel) {
    const meta = (vercel.metadata ?? {}) as Record<string, unknown>;
    const last = (meta.lastPreviewDeployment ?? null) as Record<string, unknown> | null;
    const lastUrl = last ? pickStr(last.url) : null;
    if (lastUrl) {
      return {
        url: lastUrl.startsWith("http") ? lastUrl : `https://${lastUrl}`,
        source: "vercel.lastPreviewDeployment",
        connectionId: vercel.id,
      };
    }
    const connUrl = pickStr(vercel.url);
    if (connUrl) {
      return {
        url: connUrl.startsWith("http") ? connUrl : `https://${connUrl}`,
        source: "vercel.connection.url",
        connectionId: vercel.id,
      };
    }
  }

  if (projectMetadata) {
    const previewUrl = pickStr(projectMetadata.previewUrl);
    if (previewUrl) {
      return { url: previewUrl, source: "project.metadata.previewUrl", connectionId: null };
    }
    const deployUrl = pickStr(projectMetadata.deployUrl);
    if (deployUrl) {
      return { url: deployUrl, source: "project.metadata.deployUrl", connectionId: null };
    }
  }

  return { url: null, source: "none", connectionId: null };
}
