// Chrome-less local builder preview route.
//
// Rendered directly under <html> with no yawB sidebar / topbar / chat /
// diagnostics — the root layout (src/routes/__root.tsx) checks for a path
// starting with "/preview/" and returns a bare <Outlet />.
//
// PreviewPane embeds this route via /preview/$projectId?embed=1 so the user
// sees ONLY the project output (or a clean local-preview placeholder).

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/preview/$projectId")({
  head: ({ params }) => ({
    meta: [
      { title: `Local preview — ${params.projectId}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LocalPreview,
});

interface ProjectLite {
  id: string;
  name: string;
  description: string | null;
}

function LocalPreview() {
  const { projectId } = Route.useParams();
  const [project, setProject] = useState<ProjectLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasFiles, setHasFiles] = useState(false);

  // Make this route truly chrome-less and full-viewport. Strip any inherited
  // app background so the embedded iframe shows the preview document only.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlClass = html.className;
    const prevBodyClass = body.className;
    const prevBg = body.style.background;
    const prevMargin = body.style.margin;
    const prevMinH = body.style.minHeight;
    body.style.background = "#0b0f14";
    body.style.margin = "0";
    body.style.minHeight = "100%";
    body.setAttribute("data-yawb-preview-embed", "1");
    return () => {
      html.className = prevHtmlClass;
      body.className = prevBodyClass;
      body.style.background = prevBg;
      body.style.margin = prevMargin;
      body.style.minHeight = prevMinH;
      body.removeAttribute("data-yawb-preview-embed");
    };
  }, []);

  const [indexHtml, setIndexHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("projects")
        .select("id, name, description")
        .eq("id", projectId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setProject({ id: data.id, name: data.name, description: data.description });
      }
      // Try to load the latest generated index.html. Falls back to placeholder
      // when no project_files row exists.
      try {
        const { data: file } = await supabase
          .from("project_files")
          .select("content")
          .eq("project_id", projectId)
          .eq("path", "index.html")
          .maybeSingle();
        if (!cancelled && file && typeof file.content === "string" && file.content.length > 0) {
          setIndexHtml(file.content);
          setHasFiles(true);
        } else {
          setHasFiles(false);
        }
      } catch {
        setHasFiles(false);
      }
      setLoading(false);
      console.info("[yawb] preview.local.rendered", { projectId, hasFiles: !!indexHtml });
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const wrapperStyle: React.CSSProperties = {
    minHeight: "100vh",
    width: "100%",
    margin: 0,
    background: "#0b0f14",
    color: "#e6edf3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const projectName = project?.name ?? "Project";

  if (loading) {
    return (
      <div data-testid="preview-embed-root" style={wrapperStyle}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>Loading local preview…</div>
      </div>
    );
  }

  // If we have a saved index.html, render it inline as the page content via
  // an iframe srcDoc so the project's own CSS owns the viewport (no yawB chrome).
  if (indexHtml) {
    return (
      <iframe
        data-testid="preview-embed-root"
        title={`${projectName} local preview`}
        srcDoc={indexHtml}
        sandbox=""
        referrerPolicy="no-referrer"
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, background: "#0b0f14" }}
      />
    );
  }

  const projectName = project?.name ?? "Project";

  return (
    <div data-testid="preview-embed-root" style={wrapperStyle}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            opacity: 0.55,
          }}
        >
          Local preview
        </div>
        <h1
          style={{
            marginTop: 12,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          {projectName} local preview
        </h1>
        {hasFiles ? (
          <p style={{ marginTop: 10, fontSize: 14, opacity: 0.7 }}>
            Rendering generated files…
          </p>
        ) : (
          <p style={{ marginTop: 10, fontSize: 14, opacity: 0.7, lineHeight: 1.5 }}>
            No generated screen yet — ask yawB to build the first screen.
          </p>
        )}
      </div>
    </div>
  );
}
