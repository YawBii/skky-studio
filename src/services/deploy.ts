// TODO(codex): orchestrate github → vercel deploy pipelines and stream logs back.
import { deploy as vercelDeploy, streamLogs as vercelLogs } from "./vercel";

export async function deployProject(projectId: string, opts?: { production?: boolean }) {
  return vercelDeploy(projectId, opts);
}
export async function tailDeployLogs(deploymentId: string) {
  return vercelLogs(deploymentId);
}
