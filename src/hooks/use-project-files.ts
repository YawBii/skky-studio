// Subscribes the builder to a project's generated files. Exposes the
// composite `generated` blob expected by PreviewPane plus a `refresh()`
// trigger so callers can remount the local preview after a build.

import { useCallback, useEffect, useRef, useState } from "react";
import { listProjectFiles, type ProjectFile } from "@/services/project-files";
import type { GeneratedFiles } from "@/lib/preview-source";

export interface UseProjectFiles {
  files: ProjectFile[];
  generated: GeneratedFiles | null;
  loading: boolean;
  /** Increments after every successful refresh — pass into `key` to remount. */
  version: number;
  refresh: () => Promise<void>;
  tableMissing: boolean;
  error?: string;
}

export function useProjectFiles(projectId: string | null | undefined): UseProjectFiles {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const [tableMissing, setTableMissing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const cancelledRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setFiles([]);
      return;
    }
    setLoading(true);
    const r = await listProjectFiles(projectId);
    if (cancelledRef.current) return;
    setFiles(r.files);
    setTableMissing(Boolean(r.tableMissing));
    setError(r.error);
    setLoading(false);
    setVersion((v) => v + 1);
  }, [projectId]);

  useEffect(() => {
    cancelledRef.current = false;
    void refresh();
    return () => {
      cancelledRef.current = true;
    };
  }, [refresh]);

  const indexHtml = files.find((f) => f.path === "index.html")?.content ?? null;
  const generated: GeneratedFiles | null = files.length > 0
    ? { indexHtml, hasFiles: true }
    : null;

  return { files, generated, loading, version, refresh, tableMissing, error };
}
