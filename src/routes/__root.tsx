import { Outlet, createRootRoute, HeadContent, Link, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import appCss from "../styles.css?url";
import { AppSidebar } from "@/components/app-sidebar";
import { AssistantPanel } from "@/components/assistant-panel";
import { WorkspaceTopBar } from "@/components/workspace-top-bar";
import { InviteSheet } from "@/components/invite-sheet";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { useProjectPresence, DEMO_PRESENCE } from "@/services/presence";
import { SplitPane } from "@/components/split-pane";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useProjects } from "@/hooks/use-projects";
import { CreateWorkspaceEmpty, CreateProjectEmpty } from "@/components/empty-states";

const BARE_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold text-gradient-brand">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "yawB — Production-first AI app builder | Skky Group" },
      { name: "description", content: "yawB by Skky Group: build, repair, and maintain production apps with AI. Import, scan, repair, and deploy projects from GitHub, Vercel, and Supabase." },
      { property: "og:title", content: "yawB — Production-first AI app builder | Skky Group" },
      { name: "twitter:title", content: "yawB — Production-first AI app builder | Skky Group" },
      { property: "og:description", content: "yawB by Skky Group: build, repair, and maintain production apps with AI. Import, scan, repair, and deploy projects from GitHub, Vercel, and Supabase." },
      { name: "twitter:description", content: "yawB by Skky Group: build, repair, and maintain production apps with AI. Import, scan, repair, and deploy projects from GitHub, Vercel, and Supabase." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/09c93461-caad-40d3-9cf7-f3a644f51a67/id-preview-9ef2faae--2ea374de-1fbe-4df1-a98f-4a6f64b99b62.lovable.app-1777477595751.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/09c93461-caad-40d3-9cf7-f3a644f51a67/id-preview-9ef2faae--2ea374de-1fbe-4df1-a98f-4a6f64b99b62.lovable.app-1777477595751.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isBare = BARE_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isBare) {
    return (
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <WorkspaceShell />
      <Toaster />
    </AuthProvider>
  );
}

function WorkspaceShell() {
  // One-time cleanup of legacy split key from earlier builds.
  useEffect(() => {
    try { window.localStorage.removeItem("yawb:workspace-split"); } catch {}
  }, []);
  const { prefs, loaded, update } = useUserPreferences();
  const {
    current: currentWorkspace,
    isReal: workspaceIsReal,
    isEmpty: workspaceEmpty,
    refresh: refreshWorkspaces,
    select: selectWorkspace,
  } = useWorkspaces();
  const {
    current: currentProject,
    isReal: projectIsReal,
    isEmpty: projectEmpty,
    refresh: refreshProjects,
    select: selectProject,
  } = useProjects(currentWorkspace?.id);
  const presenceProjectId = currentProject?.id ?? "demo-project";
  const { present, isLive } = useProjectPresence({ projectId: presenceProjectId });
  const [inviteOpen, setInviteOpen] = useState(false);

  // Persisted right (chat) width in pixels.
  const persistedWidth =
    typeof prefs.workspaceSplit === "object" && prefs.workspaceSplit
      ? (prefs.workspaceSplit as Record<string, number>)["chat-width-px"]
      : undefined;
  const initialRightWidth =
    typeof persistedWidth === "number" && persistedWidth >= 320 && persistedWidth <= 1600
      ? persistedWidth
      : 460;

  const [rightWidth, setRightWidth] = useState(initialRightWidth);
  useEffect(() => {
    if (loaded && typeof persistedWidth === "number" && persistedWidth >= 320 && persistedWidth <= 1600) {
      setRightWidth(persistedWidth);
    }
  }, [loaded, persistedWidth]);

  const collaborators = (isLive ? present : DEMO_PRESENCE).map((p) => ({
    name: p.name, initials: p.initials, color: p.color, role: p.role, status: p.status,
  }));

  const workspaceName = currentWorkspace?.name ?? "Skky Group";
  const projectName = currentProject?.name ?? "Skky Customer Portal";

  // Empty-state overlay: only when the real DB returned 0 rows. Query failures
  // fall back to demo so we never block on a missing migration.
  let mainContent: React.ReactNode;
  if (workspaceEmpty) {
    mainContent = (
      <CreateWorkspaceEmpty
        onCreated={async (w) => {
          await refreshWorkspaces();
          selectWorkspace(w.id);
        }}
      />
    );
  } else if (currentWorkspace && workspaceIsReal && projectEmpty) {
    mainContent = (
      <CreateProjectEmpty
        workspaceId={currentWorkspace.id}
        workspaceName={currentWorkspace.name}
        onCreated={async (p) => {
          await refreshProjects();
          selectProject(p.id);
        }}
      />
    );
  } else {
    mainContent = <Outlet />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <WorkspaceTopBar
          projectName={projectName}
          workspaceName={workspaceName}
          environment="production"
          buildStatus="passing"
          connections={{
            github: "connected",
            supabase: workspaceIsReal || projectIsReal ? "connected" : "connected",
            vercel: "disconnected",
          }}
          collaborators={collaborators}
          presenceLive={isLive}
          onShare={() => setInviteOpen(true)}
        />
        <div className="flex-1 min-h-0">
          <SplitPane
            initialRightWidth={rightWidth}
            minRightWidth={320}
            minLeftWidth={320}
            onChange={(w) => { setRightWidth(w); update({ workspaceSplit: { "chat-width-px": w } }); }}
            left={
              <main className="h-full overflow-y-auto scrollbar-thin">
                {mainContent}
              </main>
            }
            right={<AssistantPanel />}
          />
        </div>
      </div>
      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceId={workspaceIsReal ? currentWorkspace?.id : undefined}
        workspaceName={workspaceName}
      />
    </div>
  );
}
