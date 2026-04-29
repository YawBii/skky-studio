// TODO(codex): wire to project version history (git tags + Lovable snapshots).
export interface Version {
  id: string;
  message: string;
  author: string;
  at: string;
  current?: boolean;
  kind: "deploy" | "edit" | "import" | "repair";
}

export async function listVersions(_projectId: string): Promise<Version[]> {
  return [
    { id: "v_24", message: "Add billing tab to /settings",           author: "yawB",       at: "2h ago",  current: true, kind: "edit"   },
    { id: "v_23", message: "Deploy to production",                   author: "ana",        at: "3h ago",  kind: "deploy" },
    { id: "v_22", message: "Auto-repair: created feature_flags",     author: "yawB",       at: "1d ago",  kind: "repair" },
    { id: "v_21", message: "Refactor header navigation",             author: "yawB",       at: "2d ago",  kind: "edit"   },
    { id: "v_20", message: "Imported from skky-group/portal",        author: "ana",        at: "1w ago",  kind: "import" },
  ];
}

export async function rollbackTo(_projectId: string, _versionId: string): Promise<void> {}
