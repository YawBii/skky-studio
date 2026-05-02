// TODO(codex): orchestrate github + vercel + supabase + cloud into a single report.
export type CheckStatus = "pass" | "warn" | "fail";
export interface HealthCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  canAutoRepair: boolean;
}
export interface HealthReport {
  score: number;
  ranAt: string;
  checks: HealthCheck[];
}

export async function runScan(_projectId: string): Promise<HealthReport> {
  return {
    score: 41,
    ranAt: new Date().toISOString(),
    checks: [
      {
        id: "build",
        label: "Build pipeline",
        status: "pass",
        detail: "Last build succeeded in 42s",
        canAutoRepair: false,
      },
      {
        id: "deps",
        label: "Dependencies",
        status: "warn",
        detail: "3 outdated packages, 0 critical CVEs",
        canAutoRepair: true,
      },
      {
        id: "db",
        label: "Supabase database",
        status: "fail",
        detail: "2 tables referenced in code are missing",
        canAutoRepair: true,
      },
      {
        id: "rls",
        label: "Row level security",
        status: "warn",
        detail: "1 table has RLS disabled",
        canAutoRepair: true,
      },
      {
        id: "env",
        label: "Environment variables",
        status: "pass",
        detail: "All required secrets present",
        canAutoRepair: false,
      },
      {
        id: "deploy",
        label: "Vercel deployment",
        status: "pass",
        detail: "Production reachable, p95 230ms",
        canAutoRepair: false,
      },
      {
        id: "seo",
        label: "SEO & meta",
        status: "warn",
        detail: "2 pages missing og:image",
        canAutoRepair: true,
      },
      {
        id: "a11y",
        label: "Accessibility",
        status: "pass",
        detail: "No critical issues detected",
        canAutoRepair: false,
      },
    ],
  };
}

export async function autoRepair(
  _projectId: string,
  _checkIds: string[],
): Promise<{ repaired: string[] }> {
  return { repaired: _checkIds };
}
