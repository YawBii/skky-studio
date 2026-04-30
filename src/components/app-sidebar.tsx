import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Sparkles, GitBranch, AlertTriangle, Rocket,
  Plug, KeyRound, CreditCard, Settings, LifeBuoy, ChevronsUpDown,
  LogOut, FolderKanban, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/services/auth";

const workspaceNav = [
  { to: "/", label: "Workspace", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/health", label: "Issues", icon: AlertTriangle, badge: "3" },
  { to: "/deploys", label: "Deploys", icon: Rocket },
];

const platformNav = [
  { to: "/connectors", label: "Integrations", icon: Plug },
  { to: "/cloud", label: "Secrets", icon: KeyRound },
  { to: "/billing", label: "Billing", icon: CreditCard },
];

const buildNav = [
  { to: "/create", label: "Create new app", icon: Sparkles },
  { to: "/import", label: "Import from GitHub", icon: GitBranch },
];

const footerNav = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help & docs", icon: LifeBuoy },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const { session } = useAuth();

  const initials = session?.displayName
    ? session.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "SG";
  const name = session?.displayName ?? "Skky Group";
  const email = session?.email ?? "workspace@skky.group";

  async function handleSignOut() {
    try {
      await signOut();
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  return (
    <aside className="hidden md:flex w-[244px] shrink-0 flex-col border-r border-white/5 bg-sidebar/70 backdrop-blur-xl">
      {/* Workspace switcher */}
      <button
        type="button"
        className="m-3 mb-2 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-left hover:bg-white/[0.05] transition"
      >
        <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-white/95 to-white/60 text-[oklch(0.16_0_0)] flex items-center justify-center font-display font-bold text-sm shadow-glow">
          y
        </div>
        <div className="leading-tight min-w-0 flex-1">
          <div className="font-display font-semibold tracking-tight text-sm truncate">yawB · Skky</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground truncate">Pro workspace</div>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <nav className="flex-1 px-3 pt-3 pb-3 space-y-1 overflow-y-auto scrollbar-thin">
        <SectionLabel>Workspace</SectionLabel>
        {workspaceNav.map((item) => <NavLink key={item.to} item={item} active={isActive(item.to)} />)}

        <div className="h-3" />
        <SectionLabel>Build</SectionLabel>
        {buildNav.map((item) => <NavLink key={item.to} item={item} active={isActive(item.to)} />)}

        <div className="h-3" />
        <SectionLabel>Platform</SectionLabel>
        {platformNav.map((item) => <NavLink key={item.to} item={item} active={isActive(item.to)} />)}
      </nav>

      <div className="px-3 pt-2 pb-3 border-t border-white/5 space-y-0.5">
        {footerNav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
        <div className="mt-3 rounded-xl glass p-2.5 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-white/90 to-white/40 text-[oklch(0.16_0_0)] flex items-center justify-center text-[11px] font-bold">
            {initials}
          </div>
          <div className="leading-tight min-w-0 flex-1">
            <div className="text-[12px] font-medium truncate">{name}</div>
            <div className="text-[10px] text-muted-foreground truncate">{email}</div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] inline-flex items-center justify-center"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2 px-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Build pipeline online
          </span>
          <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> 99.98%</span>
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
      {children}
    </div>
  );
}

function NavLink({
  item,
  active,
}: {
  item: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string };
  active: boolean;
}) {
  return (
    <Link
      to={item.to}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all",
        active
          ? "bg-white/[0.07] text-foreground ring-hairline"
          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
      )}
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-foreground/80" />}
      <item.icon className="h-4 w-4" />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-warning/20 text-warning">
          {item.badge}
        </span>
      )}
    </Link>
  );
}
