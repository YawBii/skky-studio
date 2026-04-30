import { Outlet, createRootRoute, HeadContent, Link, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider } from "@/hooks/use-auth";

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
  return (
    <AuthProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </AuthProvider>
  );
}
