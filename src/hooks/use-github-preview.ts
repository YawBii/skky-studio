// Fetch a static index.html from a GitHub-linked repo so the Preview tab can
// render the existing project as-is, instead of asking the user to "build"
// something that already exists in the repo.
//
// We try a small set of common entry-point paths on the default branch (or
// `main`/`master` fallback) using GitHub's raw.githubusercontent.com CDN.
// All requests are unauthenticated, public-only — private repos quietly fall
// through to the standard "linked to repo" empty state.

import { useEffect, useState } from "react";
import type { ProjectConnection } from "@/services/project-connections";

const CANDIDATE_PATHS = [
  "index.html",
  "public/index.html",
  "dist/index.html",
  "build/index.html",
  "docs/index.html",
];

export interface GitHubPreviewState {
  loading: boolean;
  indexHtml: string | null;
  source: string | null;
  error: string | null;
}

function parseFullName(conn: ProjectConnection | undefined): string | null {
  if (!conn) return null;
  if (conn.repoFullName) return conn.repoFullName;
  if (conn.repoUrl) {
    const m = conn.repoUrl.match(/github\.com\/([^/]+\/[^/?#]+)/i);
    if (m) return m[1].replace(/\.git$/i, "");
  }
  return null;
}

export function useGitHubPreview(
  connections: ProjectConnection[] | null | undefined,
): GitHubPreviewState {
  const conn = connections?.find((c) => c.provider === "github");
  const fullName = parseFullName(conn);
  const branch = conn?.defaultBranch ?? null;

  const [state, setState] = useState<GitHubPreviewState>({
    loading: false,
    indexHtml: null,
    source: null,
    error: null,
  });

  useEffect(() => {
    if (!fullName) {
      setState({ loading: false, indexHtml: null, source: null, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    const branches = [branch, "main", "master"].filter(
      (b, i, arr): b is string => !!b && arr.indexOf(b) === i,
    );
    (async () => {
      for (const br of branches) {
        for (const path of CANDIDATE_PATHS) {
          const url = `https://raw.githubusercontent.com/${fullName}/${br}/${path}`;
          try {
            const r = await fetch(url, { redirect: "follow" });
            if (!r.ok) continue;
            const text = await r.text();
            if (!text || !/<html[\s>]/i.test(text)) continue;
            if (cancelled) return;
            console.info("[yawb] github.preview.loaded", {
              repo: fullName,
              branch: br,
              path,
              bytes: text.length,
            });
            setState({
              loading: false,
              indexHtml: text,
              source: `github:${fullName}@${br}/${path}`,
              error: null,
            });
            return;
          } catch (e) {
            // Network / CORS — try next candidate.
            console.info("[yawb] github.preview.try.failed", {
              url,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }
      if (!cancelled) {
        setState({
          loading: false,
          indexHtml: null,
          source: null,
          error: "no-renderable-html-found",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fullName, branch]);

  return state;
}
