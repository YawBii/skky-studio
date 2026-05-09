import { listProjectFiles } from "@/services/project-files";
import { scanProjectSecurity, type ProjectSecurityReport } from "@/lib/project-security-monitor";

export async function scanProjectSecurityById(projectId: string): Promise<{
  report: ProjectSecurityReport;
  error?: string;
  tableMissing?: boolean;
}> {
  const result = await listProjectFiles(projectId);
  const files = result.files.map((file) => ({ path: file.path, content: file.content }));
  return {
    report: scanProjectSecurity(files),
    error: result.error,
    tableMissing: result.tableMissing,
  };
}
