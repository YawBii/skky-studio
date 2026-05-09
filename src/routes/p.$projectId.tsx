// yawB Native Publish route.
//
// This is the built-in hosted/public view for project_files. It does not use
// Vercel and does not queue a deploy job. Publish can point users here
// immediately: /p/$projectId.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inlineLocalAssets } from "@/lib/preview-inline";

export const Route = createFileRoute("/p/$projectId")({
  head: ({ params }) => ({
    meta: [
      { title: `Published site — ${params.projectId}` },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: NativePublishedSite,
});

interface PublishedProjectFile {
  path: string;
  content: string;
}

async function loadProjectFiles(projectId: string): Promise<{
  indexHtml: string | null;
  stylesCss: string | null;
  appJs: string | null;
  error?: string;
}> {
  const { data, error } = await supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", projectId)
    .in("path", ["index.html", "styles.css", "app.js"]);

  if (error) return { indexHtml: null, stylesCss: null, appJs: null, error: error.message };

  const files = ((data ?? []) as PublishedProjectFile[]).filter(
    (file) => typeof file.content === "string",
  );
  const rawIndex = files.find((file) => file.path === "index.html")?.content ?? null;
  const stylesCss = files.find((file) => file.path === "styles.css")?.content ?? null;
  const appJs = files.find((file) => file.path === "app.js")?.content ?? null;
  const indexHtml = rawIndex ? inlineLocalAssets(rawIndex, { stylesCss, appJs }) : null;

  return { indexHtml, stylesCss, appJs };
}

function NativePublishedSite() {
  const { projectId } = Route.useParams();
  const [indexHtml, setIndexHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlClass = html.className;
    const previousBodyClass = body.className;
    const previousBackground = body.style.background;
    const previousMargin = body.style.margin;
    const previousMinHeight = body.style.minHeight;

    html.className = "";
    body.className = "";
    body.style.background = "#0b0f14";
    body.style.margin = "0";
    body.style.minHeight = "100%";
    body.setAttribute("data-yawb-native-published-site", "1");

    return () => {
      html.className = previousHtmlClass;
      body.className = previousBodyClass;
      body.style.background = previousBackground;
      body.style.margin = previousMargin;
      body.style.minHeight = previousMinHeight;
      body.removeAttribute("data-yawb-native-published-site");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const result = await loadProjectFiles(projectId);
      if (cancelled) return;
      setIndexHtml(result.indexHtml);
      setError(result.error ?? null);
      setLoading(false);
      console.info("[yawb] native_publish.route.loaded", {
        projectId,
        hasIndexHtml: Boolean(result.indexHtml),
        error: result.error ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return <NativeMessage title="Loading published site…" body="yawB Native Hosting is loading project files." />;
  }

  if (!indexHtml) {
    return (
      <NativeMessage
        title="Published site is not ready"
        body={
          error
            ? `Could not load project files: ${error}`
            : "No index.html has been generated for this project yet. Build the homepage first, then publish again."
        }
      />
    );
  }

  return (
    <iframe
      data-testid="native-published-site-frame"
      title={`yawB published site ${projectId}`}
      srcDoc={indexHtml}
      sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin"
      referrerPolicy="no-referrer"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: 0,
        background: "#fff",
      }}
    />
  );
}

function NativeMessage({ title, body }: { title: string; body: string }) {
  return (
    <main
      data-testid="native-publish-message"
      style={{
        minHeight: "100vh",
        width: "100%",
        margin: 0,
        background: "#0b0f14",
        color: "#e6edf3",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <section style={{ maxWidth: 520, textAlign: "center" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#9aa4b2",
            marginBottom: 12,
          }}
        >
          yawB Native Hosting
        </div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>{title}</h1>
        <p style={{ marginTop: 12, color: "#9aa4b2", lineHeight: 1.55 }}>{body}</p>
      </section>
    </main>
  );
}
