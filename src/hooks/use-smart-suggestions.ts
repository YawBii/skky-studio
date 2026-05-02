// Generates contextual, production-focused next-action suggestions for yawB.
// Suggestions are derived purely from app state — workspace, project, jobs,
// connections, diagnostics, current builder tab. Every suggestion ships with
// a real action (or an explicit `disabledReason` if it can't be performed).
import { useMemo } from "react";
import type { Job } from "@/services/jobs";
import type { ProjectConnection } from "@/services/project-connections";
import type { Workspace } from "@/services/workspaces";
import type { Project } from "@/services/projects";
import type { DiagState } from "@/lib/diagnostics";

export type SuggestionIntent =
  | "create_project"
  | "start_build"
  | "answer_question"
  | "retry_failed"
  | "open_jobs"
  | "open_diagnostics"
  | "connect_github"
  | "connect_vercel"
  | "run_sql_migration"
  | "audit_buttons";

export interface SmartSuggestion {
  id: string;
  label: string;
  intent: SuggestionIntent;
  priority: number; // higher = more urgent
  // The action is opaque to the hook; the consumer decides how to dispatch.
  action: SuggestionAction;
  disabledReason?: string;
}

export type SuggestionAction =
  | { kind: "navigate"; to: string }
  | { kind: "switch_tab"; tab: "preview" | "code" | "database" | "deploy" | "jobs" | "history" }
  | { kind: "enqueue_job"; jobType: string; title: string; input?: Record<string, unknown> }
  | { kind: "open_diagnostics" }
  | { kind: "open_dialog"; dialog: "create_project" | "audit_buttons" | "sql_migrations" }
  | { kind: "answer_question"; jobId: string }
  | { kind: "retry_job"; jobId: string }
  | { kind: "noop"; reason: string };

export interface SmartSuggestionsInput {
  workspace: Workspace | null | undefined;
  project: Project | null | undefined;
  jobs: Job[];
  connections: ProjectConnection[];
  connectionsSource?: string;
  jobsSource?: string;
  diagnostics: DiagState;
  currentTab?: "preview" | "code" | "database" | "deploy" | "jobs" | "history";
  hasDeployUrl?: boolean;
}

export function useSmartSuggestions(input: SmartSuggestionsInput): SmartSuggestion[] {
  const {
    workspace,
    project,
    jobs,
    connections,
    connectionsSource,
    jobsSource,
    diagnostics,
    currentTab,
    hasDeployUrl,
  } = input;

  return useMemo<SmartSuggestion[]>(() => {
    const out: SmartSuggestion[] = [];

    // 1. No project → highest priority
    if (!project) {
      out.push({
        id: "create-first-project",
        label: workspace ? "Create first project" : "Set up workspace & project",
        intent: "create_project",
        priority: 100,
        action: { kind: "navigate", to: "/projects" },
      });
      return sortAndDedupe(out);
    }

    // 2. Job tables missing → block other suggestions, surface SQL action
    if (jobsSource === "table-missing" || connectionsSource === "table-missing") {
      out.push({
        id: "run-sql-migrations",
        label: "Run SQL migration checklist",
        intent: "run_sql_migration",
        priority: 95,
        action: { kind: "open_dialog", dialog: "sql_migrations" },
      });
    }

    // 3. Waiting for input
    const waiting = jobs.find((j) => j.status === "waiting_for_input");
    if (waiting) {
      out.push({
        id: `answer-question-${waiting.id}`,
        label: "Answer pending question",
        intent: "answer_question",
        priority: 90,
        action: { kind: "answer_question", jobId: waiting.id },
      });
    }

    // 4. Failed job
    const failed = jobs.find((j) => j.status === "failed");
    if (failed) {
      out.push({
        id: `retry-failed-${failed.id}`,
        label: "Retry failed step",
        intent: "retry_failed",
        priority: 85,
        action: { kind: "retry_job", jobId: failed.id },
      });
    }

    // 5. No build started yet (no build.* jobs at all)
    const hasBuildJob = jobs.some((j) => j.type.startsWith("build."));
    if (!hasBuildJob) {
      out.push({
        id: "start-first-build",
        label: "Start first build",
        intent: "start_build",
        priority: 70,
        action: {
          kind: "enqueue_job",
          jobType: "build.production",
          title: "Start build",
          input: { source: "smart_suggestion" },
        },
      });
    }

    // 6. GitHub not connected
    const github = connections.find((c) => c.provider === "github" && c.status === "connected");
    if (!github) {
      out.push({
        id: "connect-github",
        label: "Connect GitHub repo",
        intent: "connect_github",
        priority: 60,
        action: { kind: "navigate", to: "/connectors" },
      });
    }

    // 7. No deploy URL (Vercel)
    const vercel = connections.find((c) => c.provider === "vercel" && c.status === "connected");
    if (!vercel || !hasDeployUrl) {
      out.push({
        id: "connect-vercel",
        label: vercel ? "Trigger preview deploy" : "Connect Vercel",
        intent: "connect_vercel",
        priority: 55,
        action: vercel
          ? {
              kind: "enqueue_job",
              jobType: "vercel.create_preview_deploy",
              title: "Create preview deploy",
            }
          : { kind: "navigate", to: "/connectors" },
      });
    }

    // 8. Diagnostics surfaced an error → offer to open diagnostics panel
    if (diagnostics.lastError) {
      out.push({
        id: "open-diagnostics",
        label: "Open diagnostics",
        intent: "open_diagnostics",
        priority: 50,
        action: { kind: "open_diagnostics" },
      });
    }

    // 9. If user is on a "Not connected yet" tab (database/deploy/code/history)
    //    offer the audit-buttons action so they can sanity-check what's wired.
    if (
      currentTab &&
      (currentTab === "database" ||
        currentTab === "deploy" ||
        currentTab === "code" ||
        currentTab === "history")
    ) {
      out.push({
        id: "audit-builder-buttons",
        label: "Audit builder buttons",
        intent: "audit_buttons",
        priority: 30,
        action: { kind: "open_dialog", dialog: "audit_buttons" },
      });
    }

    // 10. Quick "Open Jobs" if there are active jobs and we're not on it
    const active = jobs.find((j) => j.status === "queued" || j.status === "running");
    if (active && currentTab !== "jobs") {
      out.push({
        id: `open-jobs-${active.id}`,
        label: "Open Jobs panel",
        intent: "open_jobs",
        priority: 40,
        action: { kind: "switch_tab", tab: "jobs" },
      });
    }

    return sortAndDedupe(out);
  }, [
    workspace,
    project,
    jobs,
    connections,
    connectionsSource,
    jobsSource,
    diagnostics.lastError,
    currentTab,
    hasDeployUrl,
  ]);
}

function sortAndDedupe(list: SmartSuggestion[]): SmartSuggestion[] {
  const seen = new Set<string>();
  const sorted = [...list].sort((a, b) => b.priority - a.priority);
  return sorted.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true))).slice(0, 5);
}
