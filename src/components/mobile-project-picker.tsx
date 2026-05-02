// Full-screen project picker for phones — opened from the top-bar switcher
// when isMobile is true. Single-tap selection navigates straight into the
// builder for that project. Portal-mounted with max z-index so it sits
// above the builder tabs, preview iframe, bottom nav, and chat FAB.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Check, FolderKanban, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/services/projects";
import { MobileBootstrapPanel } from "@/components/mobile-bootstrap-panel";

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

  const hasProjects = projects.length > 0;
  const isSearchEmpty = hasProjects && filtered.length === 0;

  const node = (
    <div
      data-testid="mobile-project-picker"
      role="dialog"
      aria-modal="true"
      aria-label="Switch project"
      className="fixed inset-0 z-[9999] flex flex-col bg-background"
      style={{ height: "100dvh" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 h-14 border-b border-white/5 shrink-0"
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
      <div className="px-3 py-2 border-b border-white/5 shrink-0">
        <label className="flex items-center gap-2 h-11 rounded-md bg-white/[0.04] border border-white/5 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            data-testid="mobile-project-picker-search"
            inputMode="search"
            autoComplete="off"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/70"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      </div>

      {/* List */}
      <ul
        data-testid="mobile-project-picker-list"
        className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]"
      >
        {hasProjects ? (
          <>
            {filtered.map((p) => {
              const isCurrent = p.id === currentProjectId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p.id)}
                    data-testid={`mobile-project-picker-item-${p.id}`}
                    className={cn(
                      "w-full text-left flex items-center gap-3 px-4 py-3 min-h-[56px] border-b border-white/[0.04] hover:bg-white/[0.04] active:bg-white/[0.07] touch-manipulation",
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
            {isSearchEmpty && (
              <li className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                <div>No matches.</div>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-foreground text-[13px] touch-manipulation"
                >
                  Clear search
                </button>
              </li>
            )}
          </>
        ) : (
          <li className="px-4 py-12 text-center text-[13px] text-muted-foreground">
            <div>No projects returned.</div>
            <div className="mt-4 text-left">
              <MobileBootstrapPanel projectsCount={0} />
            </div>
          </li>
        )}
      </ul>
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
