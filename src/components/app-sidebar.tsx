import { Link, useRouterState } from "@tanstack/react-router";
import {
  FolderKanban, AlertTriangle, Rocket, Plug, Settings, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/services/auth";

const nav = [
  { to: "/projects",   label: "Projects",     icon: FolderKanban },
  { to: "/health",     label: "Health",       icon: AlertTriangle },
  { to: "/deploys",    label: "Deploys",      icon: Rocket },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/settings",   label: "Settings",     icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const { session } = useAuth();

  const initials = session?.displayName
    ? session.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "y";

  async function handleSignOut() {
    try { await signOut(); } catch {}
    window.location.href = "/login";
  }

  return (
    <aside className="hidden md:flex w-[64px] shrink-0 flex-col items-center border-r border-white/5 bg-sidebar/70 backdrop-blur-xl py-3">
      {/* Workspace mark */}
      <Link
        to="/"
        title="yawB · Workspace"
        className="h-9 w-9 rounded-xl bg-gradient-to-br from-white/95 to-white/55 text-[oklch(0.16_0_0)] flex items-center justify-center font-display font-bold text-sm shadow-glow"
      >
        y
      </Link>

      <nav className="mt-5 flex-1 flex flex-col items-center gap-1">
        {nav.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              className={cn(
                "relative h-9 w-9 rounded-lg flex items-center justify-center transition",
                active
                  ? "bg-white/[0.08] text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
              )}
            >
              {active && <span className="absolute -left-[7px] top-2 bottom-2 w-0.5 rounded-r bg-foreground/80" />}
              <item.icon className="h-4 w-4" />
              {("badge" in item) && (item as { badge?: string }).badge && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-warning text-[9px] font-semibold text-background flex items-center justify-center">
                  {(item as { badge?: string }).badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleSignOut}
        title="Sign out"
        className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] inline-flex items-center justify-center mb-1"
      >
        <LogOut className="h-4 w-4" />
      </button>
      <div
        title={session?.email ?? "Not signed in"}
        className="h-8 w-8 rounded-full bg-gradient-to-br from-white/90 to-white/40 text-[oklch(0.16_0_0)] flex items-center justify-center text-[11px] font-bold"
      >
        {initials}
      </div>
    </aside>
  );
}
