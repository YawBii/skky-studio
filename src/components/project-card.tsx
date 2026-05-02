import { Link } from "@tanstack/react-router";
import { ExternalLink, GitBranch, Activity } from "lucide-react";
import { StatusBadge } from "./status-badge";
import type { Project } from "@/lib/demo-data";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to="/builder/$projectId"
      params={{ projectId: project.id }}
      className="group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-card p-5 transition-all hover:border-white/10 hover:shadow-elevated"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/[0.02]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display font-semibold text-base tracking-tight">
                {project.name}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
          </div>
          <StatusBadge status={project.status} />
        </div>

        <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            {project.framework}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            {project.url}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Health</span>
            <span className="text-xs font-semibold tabular-nums">{project.health}%</span>
          </div>
          <div className="text-[11px] text-muted-foreground">Deployed {project.lastDeploy}</div>
        </div>

        <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-brand transition-all"
            style={{ width: `${project.health}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
