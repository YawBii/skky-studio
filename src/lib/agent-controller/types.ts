// Agent Controller v1 — shared types.

import type { Job } from "@/services/jobs";
import type { ProjectFile } from "@/services/project-files";
import type { Project } from "@/services/projects";

export type ArtifactType =
  | "homepage"
  | "app_dashboard"
  | "crm"
  | "marketplace"
  | "admin_panel"
  | "auth_flow"
  | "database_schema"
  | "deploy"
  | "fix_bug"
  | "plan_only"
  | "unknown";

export interface AgentIntent {
  artifactType: ArtifactType;
  confidence: number; // 0..1
  reason: string;
  /** Optional industry hint for content (e.g. "law-firm"). */
  domain?: string | null;
}

export interface AgentState {
  project: Pick<Project, "id" | "name" | "description"> | null;
  files: {
    indexHtml: string | null;
    stylesCss: string | null;
    appJs: string | null;
    raw: ProjectFile[];
  };
  latestJobs: Job[];
  activeJob: Job | null;
  failedVisualQuality: {
    jobId: string;
    failedGates: string[];
    error: string | null;
  } | null;
  currentArtifactType: ArtifactType;
  staleTemplateMarkers: string[];
  blockers: string[];
}

export type AgentActionKind =
  | "block_with_current_job"
  | "answer_plan_only"
  | "build_homepage"
  | "replace_target_file"
  | "repair_failed_preview"
  | "noop";

export interface AgentDecision {
  action: AgentActionKind;
  /** User-facing message to surface in chat. */
  message: string;
  /** Files the action will write, when known. */
  targetFiles?: string[];
  reason: string;
}

export interface VerificationCheck {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface VerificationResult {
  passed: boolean;
  gate: ArtifactType;
  checks: VerificationCheck[];
  failedGates: string[];
}

export interface AgentProof {
  controller: "agent-controller-v1";
  intent: AgentIntent;
  stateSummary: {
    artifactTypeBefore: ArtifactType;
    hasActiveJob: boolean;
    activeJobStatus: string | null;
    fileCount: number;
    failedGates: string[];
  };
  decision: AgentDecision;
  filesTouched: string[];
  verification: VerificationResult | null;
  repaired: boolean;
  canDeclareDone: boolean;
  blockedByActiveJob: boolean;
}
