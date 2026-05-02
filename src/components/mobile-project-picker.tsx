// Full-screen project picker for phones — opened from the top-bar switcher
// when isMobile is true. Single-tap selection navigates straight into the
// builder for that project. Keeps the popover behavior on desktop.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, FolderKanban, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/services/projects";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  currentProjectId: string | null | undefined;
  onSelect: (id: string) => void;
}

export function MobileProjectPicker({ open, onOpenChange, projects, currentProjectId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
  }, [projects, query]);

  if (!open) return null;

  const pick = (id: string) => {
    console.info("[yawb] mobile.projectPicker.pick", { id });
    onSelect(id);
    onOpenChange(false);
    void navigate({ to: "/builder/$projectId", params: { projectId: id } });
  };

  return (
    <div
      data-testid="mobile-project-picker"
      role="dialog"
      aria-modal="true"
      aria-label="Switch project"
      className="fixed inset-0 z-[60] flex flex-col bg-background"
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 h-14 border-b border-white/5"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close project picker"
          data-testid="mobile-project-picker-close"
          className="h-10 w-10 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-white/[0.05] touch-manipulation"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-[15px] font-display font-semibold tracking-tight">Switch project</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">{projects.length}</span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-white/5">
        <label className="flex items-center gap-2 h-11 rounded-md bg-white/[0.04] border border-white/5 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            data-testid="mobile-project-picker-search"
            autoFocus
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/70"
          />
        </label>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pb-[env(safe-area-inset-bottom)]">
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px] text-muted-foreground">
            {projects.length === 0 ? "No projects yet." : "No matches."}
          </div>
        ) : (
          <ul>
            {filtered.map((p) => {
              const isCurrent = p.id === currentProjectId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p.id)}
                    data-testid={`mobile-project-picker-item-${p.id}`}
                    className={cn(
                      "w-full text-left flex items-center gap-3 px-4 py-3 min-h-14 border-b border-white/[0.04] hover:bg-white/[0.04] active:bg-white/[0.07] touch-manipulation",
                      isCurrent && "bg-white/[0.05]",
                    )}
                  >
                    <FolderKanban className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium truncate">{p.name}</div>
                      {p.description && (
                        <div className="text-[12px] text-muted-foreground truncate">{p.description}</div>
                      )}
                    </div>
                    {isCurrent && <Check className="h-4 w-4 text-success shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
