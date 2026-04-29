import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Sparkles, GitBranch, Activity, Settings, LifeBuoy,
  FolderKanban, Database, Plug, Users, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/create", label: "Create New App", icon: Sparkles },
  { to: "/import", label: "Import Project", icon: GitBranch },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/health", label: "Health", icon: Activity },
];

const platformNav = [
  { to: "/cloud", label: "Cloud", icon: Database },
  { to: "/connectors", label: "Connectors", icon: Plug },
  { to: "/team", label: "Team", icon: Users },
  { to: "/billing", label: "Billing", icon: CreditCard },
];

const footerNav = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: LifeBuoy },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-white/5 bg-sidebar/70 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-white/5">
        <div className="relative h-9 w-9 rounded-xl bg-gradient-brand shadow-glow flex items-center justify-center font-display font-bold text-primary-foreground">
          y
        </div>
        <div className="leading-tight">
          <div className="font-display font-semibold tracking-tight">yawB</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Skky Group</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <SectionLabel>Workspace</SectionLabel>
        {nav.map((item) => <NavLink key={item.to} item={item} active={isActive(item.to)} />)}
        <div className="h-3" />
        <SectionLabel>Platform</SectionLabel>
        {platformNav.map((item) => <NavLink key={item.to} item={item} active={isActive(item.to)} />)}
      </nav>

      <div className="px-3 pb-5 space-y-1 border-t border-white/5 pt-4">
        {footerNav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
        <div className="mt-3 mx-1 rounded-xl glass p-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-semibold text-primary-foreground">
              SG
            </div>
            <div className="leading-tight">
              <div className="text-xs font-medium">Skky Group</div>
              <div className="text-[10px] text-muted-foreground">Pro plan</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  );
}

function NavLink({ item, active }: { item: { to: string; label: string; icon: any }; active: boolean }) {
  return (
    <Link
      to={item.to}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
        active
          ? "bg-white/[0.07] text-foreground shadow-inner"
          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
      )}
    >
      <item.icon className="h-4 w-4" />
      <span>{item.label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground/80" />}
    </Link>
  );
}
