// Inspector — reads minimal state needed for one decision.
//
// Does NOT fetch full project list. Does NOT mount preview iframe. Does NOT
// pull job step details unless the caller asks.

import { supabase } from "@/integrations/supabase/client";
import { listJobs, type Job } from "@/services/jobs";
import { listProjectFiles } from "@/services/project-files";
import { ACTIVE_JOB_STATUSES, getVisualQualityBlock } from "@/lib/job-guards";
import type { AgentState, ArtifactType } from "./types";

export interface InspectInput {
  projectId: string;
  workspaceId: string;
}

const STALE_MARKERS = [
  "Matter board command center",
  "Case cockpit",
  "Money operations",
  "Lex Scripta",
  "luxury editorial",
  "manifesto",
  "atelier",
];

export function detectArtifactTypeFromHtml(html: string | null): ArtifactType {
  if (!html) return "unknown";
  if (/yawb-artifact-type=["']homepage["']|<meta[^>]+name=["']yawb-artifact["'][^>]+content=["']homepage/i.test(html)) {
    return "homepage";
  }
  if (/Matter board|case cockpit|kpi grid|cockpit|dashboard/i.test(html)) {
    return "app_dashboard";
  }
  if (/article|publication|library|archive|journal|manifesto/i.test(html)) {
    // Treated as a blog/editorial artifact — not a category we plan, but
    // surfaced so the homepage gate can replace it.
    return "unknown";
  }
  if (/<nav[\s>]/i.test(html) && /practice areas|services|attorneys|consultation/i.test(html)) {
    return "homepage";
  }
  return "unknown";
}

export function findStaleTemplateMarkers(html: string | null): string[] {
  if (!html) return [];
  return STALE_MARKERS.filter((m) => new RegExp(m, "i").test(html));
}

export async function inspectAgentState(input: InspectInput): Promise<AgentState> {
  const { projectId } = input;

  // Project row (single, scoped). Avoid the full project list.
  const { data: projectRow } = await supabase
    .from("projects")
    .select("id, name, description")
    .eq("id", projectId)
    .maybeSingle();

  const filesResult = await listProjectFiles(projectId);
  const indexHtml = filesResult.files.find((f) => f.path === "index.html")?.content ?? null;
  const stylesCss = filesResult.files.find((f) => f.path === "styles.css")?.content ?? null;
  const appJs = filesResult.files.find((f) => f.path === "app.js")?.content ?? null;

  const jobsResult = await listJobs(projectId, 10);
  const latestJobs: Job[] = jobsResult.jobs ?? [];
  const activeJob = latestJobs.find((j) => ACTIVE_JOB_STATUSES.has(j.status)) ?? null;
  const failedVisualQuality = getVisualQualityBlock(latestJobs);

  const currentArtifactType = detectArtifactTypeFromHtml(indexHtml);
  const staleTemplateMarkers = findStaleTemplateMarkers(indexHtml);

  const blockers: string[] = [];
  if (activeJob) blockers.push(`active job ${activeJob.id} (${activeJob.status})`);
  if (failedVisualQuality) blockers.push(`visualQuality failed (${failedVisualQuality.jobId})`);

  return {
    project: projectRow
      ? { id: projectRow.id, name: projectRow.name, description: projectRow.description }
      : null,
    files: { indexHtml, stylesCss, appJs, raw: filesResult.files },
    latestJobs,
    activeJob,
    failedVisualQuality: failedVisualQuality
      ? {
          jobId: failedVisualQuality.jobId,
          failedGates: failedVisualQuality.failedGates,
          error: failedVisualQuality.error ?? null,
        }
      : null,
    currentArtifactType,
    staleTemplateMarkers,
    blockers,
  };
}
