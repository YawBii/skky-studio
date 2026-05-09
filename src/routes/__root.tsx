import {
  Outlet,
  createRootRoute,
  HeadContent,
  Link,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import appCss from "../styles.css?url";
import { AppSidebar } from "@/components/app-sidebar";
import { AssistantPanel } from "@/components/assistant-panel";
import { WorkspaceTopBar } from "@/components/workspace-top-bar";
import { InviteSheet } from "@/components/invite-sheet";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { useProjectPresence } from "@/services/presence";
import { SplitPane } from "@/components/split-pane";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useProjects } from "@/hooks/use-projects";
import { useProjectConnections } from "@/hooks/use-project-connections";
import { SelectedProjectProvider } from "@/hooks/use-selected-project";
import { CreateWorkspaceEmpty, CreateProjectEmpty } from "@/components/empty-states";
import { DiagnosticsPanel } from "@/components/diagnostics-panel";
import { setDiag } from "@/lib/diagnostics";
import { useAuth } from "@/hooks/use-auth";
import { MobileBootstrapPanel } from "@/components/mobile-bootstrap-panel";
import { Button } from "@/components/ui/button";
import { BodyPointerEventsGuard } from "@/components/body-pointer-events-guard";
import { initClientTelemetry } from "@/lib/client-telemetry";

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
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow"
          >
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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "yawB — Production-first AI app builder | Skky Group" },
      {
        name: "description",
        content:
          "yawB by Skky Group: build, repair, and maintain production apps with AI. Import, scan, repair, and deploy projects from GitHub, Vercel, and Supabase.",
      },
      { property: "og:title", content: "yawB — Production-first AI app builder | Skky Group" },
      { name: "twitter:title", content: "yawB — Production-first AI app builder | Skky Group" },
      {
        property: "og:description",
        content:
          "yawB by Skky Group: build, repair, and maintain production apps with AI. Import, scan, repair, and deploy projects from GitHub, Vercel, and Supabase.",
      },
      {
        name: "twitter:description",
        content:
          "yawB by Skky Group: build, repair, and maintain production apps with AI. Import, scan, repair, and deploy projects from GitHub, Vercel, and Supabase.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/09c93461-caad-40d3-9cf7-f3a644f51a67/id-preview-9ef2faae--2ea374de-1fbe-4df1-a98f-4a6f64b99b62.lovable.app-1777477595751.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/09c93461-caad-40d3-9cf7-f3a644f51a67/id-preview-9ef2faae--2ea374de-1fbe-4df1-a98f-4a6f64b99b62.lovable.app-1777477595751.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    initClientTelemetry();
  }, []);
  const { pathname, routeIds } = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      routeIds: s.matches.map((m) => m.routeId),
    }),
  });
  const isBare =
    BARE_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    routeIds.some((id) => BARE_ROUTES.includes(id));
  const isProjectOutputRoute =
    pathname.startsWith("/preview/") ||
    pathname.startsWith("/p/") ||
    routeIds.includes("/preview/$projectId") ||
    routeIds.includes("/p/$projectId");

  if (isProjectOutputRoute) {
    return (
      <AuthProvider>
        <BodyPointerEventsGuard />
        <Outlet />
      </AuthProvider>
    );
  }

  if (isBare) {
    return (
      <AuthProvider>
        <BodyPointerEventsGuard />
        <Outlet />
        <Toaster />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <BodyPointerEventsGuard />
      <AuthGate />
      <Toaster />
    </AuthProvider>
  );
}

function AuthGate() {
  const { session, loading: authLoading } = useAuth();
  if (authLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!session) {
    return <MobileSignedOutEmpty />;
  }
  return <WorkspaceShell />;
}

function WorkspaceShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    try {
      window.localStorage.removeItem("yawb:workspace-split");
    } catch {
      /* ignore */
    }
  }, []);
  const { prefs, loaded, update } = useUserPreferences();
  const {
    current: currentWorkspace,
    isReal: workspaceIsReal,
    isEmpty: workspaceEmpty,
    isError: workspaceError,
    error: workspaceErrorMessage,
    loading: workspaceLoading,
    refresh: refreshWorkspaces,
    select: selectWorkspace,
  } = useWorkspaces();
  const {
    current: currentProject,
    projects,
    isReal: projectIsReal,
    isEmpty: projectEmpty,
    isError: projectError,
    error: projectErrorMessage,
    loading: projectsLoading,
    source: projectsSource,
    refresh: refreshProjects,
    select: selectProject,
  } = useProjects(currentWorkspace?.id);
  const presenceProjectId = currentProject?.id ?? null;
  const { present, isLive } = useProjectPresence({ projectId: presenceProjectId });
  const { connections } = useProjectConnections(currentProject?.id ?? null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [nativePublishedUrl, setNativePublishedUrl] = useState<string | null>(null);

  useEffect(() => {
    setNativePublishedUrl(null);
  }, [currentProject?.id]);

  const persistedWidth =
    typeof prefs.workspaceSplit === "object" && prefs.workspaceSplit
      ? (prefs.workspaceSplit as Record<string, number>)["chat-width-px"]
      : undefined;
  const initialRightWidth =
    typeof persistedWidth === "number" && persistedWidth >= 280 && persistedWidth <= 1600
      ? persistedWidth
      : 380;

  const [rightWidth, setRightWidth] = useState(initialRightWidth);
  useEffect(() => {
    if (
      loaded &&
      typeof persistedWidth === "number" &&
      persistedWidth >= 280 &&
      persistedWidth <= 1600
    ) {
      setRightWidth(persistedWidth);
    }
  }, [loaded, persistedWidth]);

  const collaborators = present.map((p) => ({
    name: p.name,
    initials: p.initials,
    color: p.color,
    role: p.role,
    status: p.status,
  }));

  const workspaceName = workspaceIsReal && currentWorkspace ? currentWorkspace.name : "yawB";
  const projectName = projectIsReal && currentProject ? currentProject.name : "No project selected";

  const selectedProjectState = useMemo(
    () => ({
      workspace: currentWorkspace,
      workspaceIsReal,
      workspaceLoading,
      project: currentProject,
      projects,
      projectIsReal,
      projectsEmpty: projectEmpty,
      projectsError: projectError,
      projectsErrorMessage: projectErrorMessage,
      projectsLoading,
      projectsSource,
      refreshProjects,
      selectProject,
    }),
    [
      currentWorkspace,
      workspaceIsReal,
      workspaceLoading,
      currentProject,
      projects,
      projectIsReal,
      projectEmpty,
      projectError,
      projectErrorMessage,
      projectsLoading,
      projectsSource,
      refreshProjects,
      selectProject,
    ],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDiag({
      workspaceId: currentWorkspace?.id ?? null,
      projectId: currentProject?.id ?? null,
    });

    console.info("[yawb] selection:", {
      selectedWorkspaceId: currentWorkspace?.id ?? null,
      selectedProjectId: currentProject?.id ?? null,
      projectConnectionsCount: connections.length,
    });
  }, [currentWorkspace?.id, currentProject?.id, connections.length]);

  const isHomeRoute = pathname === "/" || pathname === "/projects";
  let mainContent: React.ReactNode;
  if (isHomeRoute && workspaceEmpty) {
    mainContent = (
      <CreateWorkspaceEmpty
        errorMessage={workspaceError ? workspaceErrorMessage : undefined}
        onCreated={async (w) => {
          await refreshWorkspaces();
          selectWorkspace(w.id);
        }}
      />
    );
  } else if (isHomeRoute && currentWorkspace && workspaceIsReal && projectEmpty) {
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

  const onNativePublish = async () => {
    if (!currentProject?.id) {
      toast("Select a project first");
      return;
    }
    const path = `/p/${currentProject.id}`;
    const url = new URL(path, window.location.origin).toString();
    setNativePublishedUrl(url);
    console.info("[yawb] native_publish.open", {
      projectId: currentProject.id,
      url,
      provider: "yawb-native",
      vercelRequired: false,
    });

    try {
      await navigator.clipboard?.writeText(url);
      toast.success("Published with yawB Native Hosting — link copied");
    } catch {
      toast.success("Published with yawB Native Hosting");
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden">
      <AppSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <WorkspaceTopBar
          projectName={projectName}
          workspaceName={workspaceName}
          environment="production"
          buildStatus="unknown"
          connections={connections}
          collaborators={collaborators}
          presenceLive={isLive}
          onDeploy={onNativePublish}
          onShare={() => setInviteOpen(true)}
          projects={projects}
          currentProject={currentProject}
          selectProject={selectProject}
        />
        {nativePublishedUrl && (
          <PublishedUrlPanel url={nativePublishedUrl} onDismiss={() => setNativePublishedUrl(null)} />
        )}
        <div className="flex-1 min-h-0">
          <SplitPane
            initialRightWidth={rightWidth}
            minRightWidth={280}
            minLeftWidth={240}
            onChange={(w) => {
              setRightWidth(w);
              update({ workspaceSplit: { "chat-width-px": w } });
            }}
            left={
              <SelectedProjectProvider value={selectedProjectState}>
                <main className="h-full overflow-y-auto scrollbar-thin">{mainContent}</main>
              </SelectedProjectProvider>
            }
            right={
              <AssistantPanel
                project={projectIsReal ? currentProject : null}
                workspace={workspaceIsReal ? currentWorkspace : null}
                enabled={projectIsReal && workspaceIsReal}
              />
            }
          />
        </div>
      </div>
      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceId={workspaceIsReal ? currentWorkspace?.id : undefined}
        workspaceName={workspaceName}
      />
      <DiagnosticsPanel />
    </div>
  );
}

function PublishedUrlPanel({ url, onDismiss }: { url: string; onDismiss: () => void }) {
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(url);
      toast.success("Published URL copied");
    } catch {
      toast("Copy failed — open the link and copy from the address bar");
    }
  };

  return (
    <div
      data-testid="native-published-url-panel"
      className="border-b border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-50"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="font-medium">Published with yawB Native Hosting</div>
          <div className="truncate font-mono text-[11px] text-emerald-100/80">{url}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" onClick={copy} className="h-7 text-[11px]">
            Copy link
          </Button>
          <Button size="sm" variant="secondary" asChild className="h-7 text-[11px]">
            <a href={url} target="_blank" rel="noreferrer">
              Open site
            </a>
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss} className="h-7 px-2 text-[11px]">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

function MobileSignedOutEmpty() {
  return (
    <div className="min-h-full grid place-items-center px-5 py-10">
      <div className="w-full max-w-md text-center">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Mobile session
        </div>
        <h1 className="mt-2 text-2xl font-display font-semibold tracking-tight">
          Not signed in on this device
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to load your workspace and projects on this phone.
        </p>
        <Button asChild variant="hero" className="mt-5">
          <Link to="/login">Sign in</Link>
        </Button>
        <div className="mt-6 text-left">
          <MobileBootstrapPanel projectsCount={0} workspacesCount={0} />
        </div>
      </div>
    </div>
  );
}
