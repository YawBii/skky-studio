import { Outlet, createRootRoute, HeadContent, Link, Scripts, useRouterState } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AppSidebar } from "@/components/app-sidebar";
import { AssistantPanel } from "@/components/assistant-panel";
import { WorkspaceTopBar } from "@/components/workspace-top-bar";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

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

const COLLABORATORS = [
  { name: "Yaw",         initials: "YA", color: "bg-[oklch(0.72_0.18_240)]", role: "admin"  as const, status: "editing" as const },
  { name: "Builder Bot", initials: "BB", color: "bg-[oklch(0.74_0.16_150)]", role: "member" as const, status: "online"  as const },
  { name: "Reviewer",    initials: "RV", color: "bg-[oklch(0.72_0.16_30)]",  role: "viewer" as const, status: "viewing" as const },
];

function loadLayout(): [number, number] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem("yawb:workspace-split");
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 2) return parsed as [number, number];
  } catch {}
  return undefined;
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
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <WorkspaceTopBar
            projectName="Skky Customer Portal"
            workspaceName="Skky Group"
            environment="production"
            buildStatus="passing"
            connections={{ github: "connected", supabase: "connected", vercel: "disconnected" }}
            collaborators={COLLABORATORS}
          />
          <div className="flex-1 min-h-0">
            <ResizablePanelGroup
              orientation="horizontal"
              defaultLayout={loadLayout()}
              onLayoutChange={(layout) => {
                try { localStorage.setItem("yawb:workspace-split", JSON.stringify(layout)); } catch {}
              }}
              className="h-full"
            >
              <ResizablePanel defaultSize={70} minSize={45} className="min-w-0">
                <main className="h-full overflow-y-auto scrollbar-thin">
                  <Outlet />
                </main>
              </ResizablePanel>
              <ResizableHandle className="bg-white/5 hover:bg-white/15 transition-colors" />
              <ResizablePanel defaultSize={30} minSize={20} maxSize={55} className="min-w-[280px]">
                <AssistantPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>
      </div>
      <Toaster />
    </AuthProvider>
  );
}
