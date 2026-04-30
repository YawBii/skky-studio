import { Link } from "@tanstack/react-router";
import { Sparkles, AlertCircle, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProjectScopedEmptyProps {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  hint: string;
  cta?: { label: string; to: string; params?: Record<string, string> };
  secondary?: React.ReactNode;
}

/**
 * Generic empty-state used across authenticated routes when the selected
 * project has no real data for that surface yet. Never shows fake numbers.
 */
export function ProjectScopedEmpty({
  icon: Icon = Sparkles,
  eyebrow,
  title,
  hint,
  cta,
  secondary,
}: ProjectScopedEmptyProps) {
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-white/5 border border-white/10 grid place-items-center">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        {eyebrow && (
          <div className="mt-4 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</div>
        )}
        <h1 className="mt-2 text-[22px] font-display font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">{hint}</p>
        {cta && (
          <div className="mt-5">
            <Button variant="hero" asChild>
              {cta.params
                ? <Link to={cta.to as never} params={cta.params as never}><Plus className="h-3.5 w-3.5" /> {cta.label}</Link>
                : <Link to={cta.to as never}><Plus className="h-3.5 w-3.5" /> {cta.label}</Link>}
            </Button>
          </div>
        )}
        {secondary && <div className="mt-4">{secondary}</div>}
      </div>
    </div>
  );
}

export function NoProjectSelected({
  hint = "Create a project from the home screen to use this surface.",
}: { hint?: string } = {}) {
  return (
    <ProjectScopedEmpty
      icon={Sparkles}
      eyebrow="No project"
      title="Select or create a project"
      hint={hint}
      cta={{ label: "Go home", to: "/" }}
    />
  );
}

export function ProjectSurfaceError({ message, sqlFile }: { message?: string; sqlFile?: string }) {
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="text-[12.5px]">
            <div className="font-medium text-destructive">Couldn't read from Lovable Cloud</div>
            {message && <div className="mt-1 text-muted-foreground break-words">{message}</div>}
            {sqlFile && (
              <div className="mt-2 text-muted-foreground">
                Run <code className="font-mono text-foreground/80">{sqlFile}</code> in the Cloud SQL editor and reload.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
