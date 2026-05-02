import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, Monitor, Play, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Project } from "@/services/projects";
import type { ProjectConnection } from "@/services/project-connections";
import {
  resolvePreviewSource,
  hasLocalPreview,
  type GeneratedFiles,
  type ResolvedPreviewSource,
} from "@/lib/preview-source";

export type PreviewDevice = "desktop" | "tablet" | "mobile";
export type PreviewMode = "live" | "local";

export interface PreviewPaneProps {
  device: PreviewDevice;
  setDevice: (d: PreviewDevice) => void;
  project: Project;
  onStartBuild: () => void;
  starting: boolean;
  selectedPage: string;
  /** Live (Vercel) deploy URL when available. */
  activeDeployUrl: string | null;
  /** Project connections — used to resolve the preview source. */
  connections?: ProjectConnection[] | null;
  /** Optional generated-files blob for in-browser local preview via srcDoc. */
  generated?: GeneratedFiles | null;
  /** Optional handler for the "Regenerate design" toolbar action. */
  onRegenerateDesign?: () => void;
  regenerating?: boolean;
  /** Optional handler for the "Refresh local preview" toolbar action. */
  onRefreshLocalPreview?: () => void;
}

type IframeState = "idle" | "loading" | "loaded" | "failed";

const IFRAME_LOAD_TIMEOUT_MS = 8000;
const IFRAME_SOFT_HINT_MS = 3000;
const TOGGLE_KEY = (projectId: string) => `yawb:preview:mode:${projectId}`;

const DEVICE_VIEWPORTS: Record<
  PreviewDevice,
  { width: string; maxWidth: string; minWidth: number; minHeight: number; label: string }
> = {
  desktop: { width: "100%", maxWidth: "none", minWidth: 0, minHeight: 640, label: "Desktop 100%" },
  tablet: { width: "820px", maxWidth: "100%", minWidth: 0, minHeight: 640, label: "Tablet 820px" },
  mobile: { width: "390px", maxWidth: "100%", minWidth: 0, minHeight: 720, label: "Mobile 390px" },
};

/**
 * Strict HTML-text sanitizer for srcDoc interpolation.
 * - Strips ALL control characters (incl. NUL, TAB-less C0/C1) that can confuse
 *   the HTML parser or smuggle attribute breakouts.
 * - Strips Unicode bidi/format overrides used for spoofing.
 * - Encodes every HTML-significant character including `=`, `` ` ``, `/` so
 *   the value cannot escape an attribute, comment, or text node — even if the
 *   surrounding template is later changed to put it inside an attribute.
 * - Hard-caps length to avoid pathological inputs.
 */
function sanitizeText(value: unknown, maxLen = 500): string {
  const raw = typeof value === "string" ? value : "";
  // Drop C0 (except \n \r \t), C1, and Unicode bidi/format controls.
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "")
    .slice(0, maxLen);
  return cleaned.replace(/[&<>"'`/=]/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      case "`": return "&#96;";
      case "/": return "&#47;";
      case "=": return "&#61;";
      default: return c;
    }
  });
}

// Back-compat alias for any external imports.
const escapeHtml = (v: string) => sanitizeText(v);
void escapeHtml;

// Stable, content-based 32-bit hash for iframe keying. Same content => same
// key => no remount. Different content => exactly one remount.
function stableHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function makeLocalPreviewSrcDoc(project: Pick<Project, "name" | "description">): string {
  const name = sanitizeText(project.name, 200) || "Untitled project";
  const description = sanitizeText(project.description || "No description yet.", 500);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" />
    <meta name="referrer" content="no-referrer" />
    <title>${name}</title>
    <style>
      html, body { margin:0; min-height:100%; background:#0b0f14; color:#e6edf3; font-family:Inter, system-ui, sans-serif; }
      * { box-sizing:border-box; }
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:48px 24px; }
      .card { width:min(720px,100%); }
      .eyebrow { letter-spacing:.28em; text-transform:uppercase; color:#f5b84b; font-size:12px; margin-bottom:28px; }
      h1 { font-size:48px; line-height:1; margin:0 0 18px; }
      p { color:#9aa4b2; font-size:18px; line-height:1.55; margin:0 0 28px; }
      .empty { border:1px solid rgba(255,255,255,.12); border-radius:24px; padding:28px; background:rgba(255,255,255,.03); }
      .empty strong { display:block; color:#fff; margin-bottom:10px; font-size:18px; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="card">
        <div class="eyebrow">Local preview</div>
        <h1>${name}</h1>
        <p>${description}</p>
        <div class="empty">
          <strong>No generated screens yet</strong>
          Ask yawB in the chat to build the first screen. Once a build runs, the local preview will render it here — no Vercel deploy required.
        </div>
      </section>
    </main>
  </body>
</html>`;
}

export function PreviewPane({
  device,
  setDevice,
  project,
  onStartBuild,
  starting,
  selectedPage,
  activeDeployUrl,
  connections,
  generated,
  onRegenerateDesign,
  regenerating,
  onRefreshLocalPreview,
}: PreviewPaneProps) {
  const viewport = DEVICE_VIEWPORTS[device];

  // Effective connection list — synthesize a vercel row if the parent only
  // passed activeDeployUrl (back-compat with existing tests/callers).
  const effectiveConnections: ProjectConnection[] = useMemo(() => {
    if (connections && connections.length > 0) return connections;
    if (activeDeployUrl) {
      return [
        {
          id: "synthetic-vercel",
          projectId: project.id,
          provider: "vercel",
          status: "connected",
          repoFullName: null,
          repoUrl: null,
          defaultBranch: null,
          metadata: { lastPreviewDeployment: { url: activeDeployUrl } },
          createdBy: "",
          createdAt: "",
          updatedAt: "",
          workspaceId: null,
          externalId: null,
          url: activeDeployUrl,
          tokenOwnerType: null,
          providerAccountId: null,
        },
      ];
    }
    return [];
  }, [connections, activeDeployUrl, project.id]);

  const liveAvailable = !!activeDeployUrl;
  const localAvailable = !!project; // route always works; srcDoc is bonus
  const generatedHasContent = hasLocalPreview(generated ?? null);

  // Persisted toggle. If live is unavailable, default to local. If local is
  // unavailable, default to live.
  const [mode, setMode] = useState<PreviewMode>(() => {
    try {
      const stored = window.localStorage.getItem(TOGGLE_KEY(project.id)) as PreviewMode | null;
      if (stored === "live" && liveAvailable) return "live";
      if (stored === "local" && localAvailable) return "local";
    } catch {
      /* ignore */
    }
    return liveAvailable ? "live" : "local";
  });

  // Auto-switch when availability changes (e.g. preview deploy lands).
  useEffect(() => {
    if (mode === "live" && !liveAvailable) setMode("local");
    if (mode === "local" && !localAvailable && liveAvailable) setMode("live");
  }, [mode, liveAvailable, localAvailable]);

  useEffect(() => {
    try {
      window.localStorage.setItem(TOGGLE_KEY(project.id), mode);
    } catch {
      /* ignore */
    }
  }, [mode, project.id]);

  const resolved: ResolvedPreviewSource = useMemo(
    () =>
      resolvePreviewSource({
        project,
        connections: effectiveConnections,
        generated: generated ?? null,
        preferred: mode,
      }),
    [project, effectiveConnections, generated, mode],
  );

  const localSrcDoc = useMemo(() => {
    if (resolved.kind !== "local") return undefined;
    return resolved.srcDoc ?? makeLocalPreviewSrcDoc(project);
  }, [resolved.kind, resolved.srcDoc, project]);

  useEffect(() => {
    console.info("[yawb] preview.source.resolved", {
      kind: resolved.kind,
      source: resolved.source ?? (resolved.kind === "local" && resolved.srcDoc ? "project_files/index.html" : resolved.url ?? "fallback:placeholder"),
      mode,
      reason: resolved.reason,
      url: resolved.url,
      hasSrcDoc: !!resolved.srcDoc,
    });
  }, [resolved, mode]);

  // Compute the iframe's effective src URL (with selectedPage overlay for live).
  const iframeSrc = useMemo(() => {
    if (!resolved.url) return null;
    if (resolved.kind === "live") {
      try {
        const u = new URL(resolved.url);
        if (selectedPage && selectedPage !== "/") u.pathname = selectedPage;
        return u.toString();
      } catch {
        return resolved.url;
      }
    }
    return resolved.url;
  }, [resolved, selectedPage]);

  // Compute the iframe key the same way as the JSX so we can log remounts.
  const iframeKey = useMemo(
    () =>
      resolved.kind === "local"
        ? `local:${project.id}:${stableHash(localSrcDoc ?? "")}`
        : `live:${iframeSrc ?? ""}`,
    [resolved.kind, project.id, localSrcDoc, iframeSrc],
  );
  useEffect(() => {
    console.info("[yawb] preview.iframe.remount", { key: iframeKey });
  }, [iframeKey]);

  const [iframeState, setIframeState] = useState<IframeState>("idle");
  const [softHintVisible, setSoftHintVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const softHintRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Local previews render statically — no loading state, no overlay, no
  // raf/timeout machinery. The loading overlay applies ONLY to live iframes
  // (cross-origin, may be blocked by CSP). This effect short-circuits early
  // for local so it cannot trigger remount/loading loops on file refresh.
  useEffect(() => {
    if (resolved.kind === "local") {
      // Cancel any in-flight live timers (mode switch live → local).
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (softHintRef.current) {
        clearTimeout(softHintRef.current);
        softHintRef.current = null;
      }
      setSoftHintVisible(false);
      // Static render — never set "loading" for local.
      console.info("[yawb] preview.local.render.static", {
        source: resolved.source,
        hasSrcDoc: Boolean(localSrcDoc || resolved.srcDoc),
      });
      return;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (softHintRef.current) {
      clearTimeout(softHintRef.current);
      softHintRef.current = null;
    }
    setSoftHintVisible(false);
    if (!iframeSrc) {
      setIframeState("idle");
      return;
    }
    setIframeState("loading");
    console.info("[yawb] preview.iframe.loading", {
      kind: resolved.kind,
      url: iframeSrc,
    });
    if (resolved.kind !== "live") return; // skip CSP timeout for non-live
    softHintRef.current = setTimeout(() => {
      setSoftHintVisible(true);
      console.info("[yawb] preview.fallback.visible", {
        url: iframeSrc,
        reason: "soft-hint-3s",
      });
    }, IFRAME_SOFT_HINT_MS);
    timeoutRef.current = setTimeout(() => {
      setIframeState((cur) => {
        if (cur === "loading") {
          console.info("[yawb] preview.iframe.failed", { url: iframeSrc, reason: "timeout" });
          console.info("[yawb] preview.fallback.visible", {
            url: iframeSrc,
            reason: "iframe-timeout",
          });
          return "failed";
        }
        return cur;
      });
    }, IFRAME_LOAD_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (softHintRef.current) {
        clearTimeout(softHintRef.current);
        softHintRef.current = null;
      }
    };
  }, [iframeSrc, localSrcDoc, resolved.srcDoc, resolved.kind]);

  const onIframeLoad = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIframeState("loaded");
    console.info("[yawb] preview.iframe.loaded", { url: iframeSrc, kind: resolved.kind });
    if (resolved.kind === "live") {
      console.info("[yawb] preview.iframe.loaded_unverified", { url: iframeSrc });
    }
  };

  const onIframeError = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIframeState("failed");
    console.info("[yawb] preview.iframe.failed", { url: iframeSrc, reason: "error" });
  };

  const onExternalOpen = () => {
    if (!resolved.externalOpenable || !activeDeployUrl) return;
    console.info("[yawb] preview.external.open", { url: activeDeployUrl });
    window.open(activeDeployUrl, "_blank", "noopener");
  };

  const onCreatePreviewDeploy = () => {
    console.info("[yawb] preview.createDeploy.clicked", { projectId: project.id });
    window.dispatchEvent(
      new CustomEvent("yawb:switch-tab", { detail: { tab: "deploy" } }),
    );
  };

  const onModeChange = (next: PreviewMode) => {
    if (next === mode) return;
    if (next === "live" && !liveAvailable) return;
    console.info("[yawb] preview.mode.toggled", { from: mode, to: next });
    setMode(next);
  };

  const showFallbackCard =
    resolved.kind === "live" && iframeSrc && iframeState === "failed";
  const showLocalEmpty =
    resolved.kind === "local" && !generatedHasContent && !iframeSrc && !localSrcDoc;

  return (
    <div className="h-full flex flex-col">
      <div className="h-11 border-b border-white/5 px-4 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 touch-manipulation"
          onClick={() => {
            console.info("[yawb] preview.refresh.clicked");
            toast("Refreshing preview…");
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        {onRegenerateDesign && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] uppercase tracking-[0.14em] touch-manipulation"
            data-testid="preview-regenerate-design"
            onClick={() => {
              console.info("[yawb] preview.regenerate.clicked", { projectId: project.id });
              onRegenerateDesign();
            }}
            disabled={regenerating}
            title="Rewrite project_files with a fresh design"
          >
            {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Regenerate design
          </Button>
        )}
        {onRefreshLocalPreview && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] uppercase tracking-[0.14em] touch-manipulation"
            data-testid="preview-refresh-local"
            onClick={() => {
              console.info("[yawb] preview.refreshLocal.clicked", { projectId: project.id });
              onRefreshLocalPreview();
            }}
            title="Reload project_files into the local preview"
          >
            Refresh local preview
          </Button>
        )}

        {/* Local | Live toggle */}
        <div
          className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5"
          data-testid="preview-mode-toggle"
        >
          <button
            type="button"
            onClick={() => onModeChange("local")}
            disabled={!localAvailable}
            data-testid="preview-mode-local"
            aria-pressed={mode === "local"}
            className={cn(
              "h-6 px-2 rounded text-[11px] uppercase tracking-[0.14em] transition touch-manipulation",
              mode === "local"
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:text-foreground",
              !localAvailable && "opacity-40 cursor-not-allowed",
            )}
          >
            Local
          </button>
          <button
            type="button"
            onClick={() => onModeChange("live")}
            disabled={!liveAvailable}
            data-testid="preview-mode-live"
            aria-pressed={mode === "live"}
            title={liveAvailable ? "Show live deploy" : "No live deploy yet"}
            className={cn(
              "h-6 px-2 rounded text-[11px] uppercase tracking-[0.14em] transition touch-manipulation",
              mode === "live"
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:text-foreground",
              !liveAvailable && "opacity-40 cursor-not-allowed",
            )}
          >
            Live
          </button>
        </div>

        <div
          data-testid="preview-url-bar"
          className="flex-1 mx-2 h-7 rounded-md bg-white/[0.04] border border-white/5 px-2.5 flex items-center text-[11.5px] text-muted-foreground gap-2 font-mono"
        >
          <ExternalLink className="h-3 w-3" />
          {resolved.kind === "live" && activeDeployUrl ? (
            <>
              <span className="truncate text-foreground/80">{activeDeployUrl}</span>
              <span className="text-muted-foreground/50">{selectedPage}</span>
            </>
          ) : resolved.kind === "local" ? (
            <>
              <span
                data-testid="preview-local-badge"
                className="px-1.5 py-0.5 rounded bg-warning/15 text-warning text-[10px] uppercase tracking-[0.16em] font-sans"
              >
                Local preview
              </span>
              <span className="truncate">{resolved.source ?? resolved.url ?? "fallback:placeholder"}</span>
            </>
          ) : (
            <span className="truncate">No preview yet</span>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 touch-manipulation"
          onClick={onExternalOpen}
          disabled={!resolved.externalOpenable || !activeDeployUrl}
          aria-label="Open deploy URL in new tab"
          title={
            resolved.externalOpenable && activeDeployUrl
              ? "Open in new tab"
              : "External open is only available for live deploys"
          }
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>

        <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
          {(
            [
              { k: "desktop", I: Monitor },
              { k: "tablet", I: Tablet },
              { k: "mobile", I: Smartphone },
            ] as const
          ).map(({ k, I }) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                console.info("[yawb] preview.device.clicked", { device: k });
                setDevice(k);
              }}
              data-testid={`preview-device-${k}`}
              aria-label={DEVICE_VIEWPORTS[k].label}
              title={DEVICE_VIEWPORTS[k].label}
              className={cn(
                "h-6 w-6 rounded grid place-items-center transition touch-manipulation",
                device === k
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <I className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "flex-1 min-h-0 bg-[oklch(0.13_0_0)]",
          device === "desktop"
            ? "overflow-hidden"
            : "overflow-auto p-8 grid place-items-start justify-center",
        )}
      >
        <div
          data-testid="preview-device-frame"
          data-device={device}
          style={{
            width: viewport.width,
            maxWidth: viewport.maxWidth,
            minWidth: viewport.minWidth,
            minHeight: viewport.minHeight,
            height: "100%",
            ...(device === "desktop" ? {} : { margin: "0 auto" }),
          }}
          className={cn(
            "transition-all overflow-hidden",
            device === "desktop" && "w-full h-full",
          )}
        >
          {(iframeSrc || localSrcDoc || resolved.srcDoc) && !showFallbackCard && !showLocalEmpty ? (
            <div
              className={cn(
                "bg-background h-full overflow-hidden relative",
                device === "desktop"
                  ? "w-full"
                  : "min-h-[inherit] rounded-2xl border border-white/10 shadow-elevated",
              )}
            >
              <iframe
                key={iframeKey}
                title={`${sanitizeText(project.name, 200) || "Project"} preview`}
                src={resolved.kind === "live" ? (iframeSrc ?? undefined) : undefined}
                srcDoc={resolved.kind === "local" ? localSrcDoc : undefined}
                data-testid="preview-iframe"
                data-preview-kind={resolved.kind}
                data-scroll="auto"
                onLoad={onIframeLoad}
                onError={onIframeError}
                referrerPolicy="no-referrer"
                scrolling="auto"
                className="h-full w-full border-0 block bg-background"
                sandbox={
                  resolved.kind === "local"
                    ? "" /* CSP-locked srcDoc, no scripts/forms needed */
                    : "allow-scripts allow-same-origin allow-forms allow-popups"
                }
              />
              {iframeState === "loading" && resolved.kind === "live" && (
                <div
                  data-testid="preview-iframe-loading"
                  className="absolute inset-0 grid place-items-center bg-background/40 backdrop-blur-sm pointer-events-none"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {/* Open-live overlay only for live deploys (external openable). */}
              {resolved.kind === "live" && activeDeployUrl && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid="preview-open-live-overlay"
                  aria-label="Open live preview"
                  onClick={onExternalOpen}
                  className="absolute top-3 right-3 h-7 px-2.5 text-[11px] gap-1 shadow-elevated"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open live preview
                </Button>
              )}
              {/* Soft hint: only for live (cross-origin embed risk). */}
              {softHintVisible && resolved.kind === "live" && activeDeployUrl && (
                <div
                  data-testid="preview-iframe-soft-hint"
                  className="absolute bottom-3 left-3 right-3 mx-auto max-w-md rounded-md border border-white/10 bg-background/80 backdrop-blur px-3 py-2 text-[11.5px] text-muted-foreground flex items-center gap-2 shadow-elevated"
                >
                  <span className="flex-1">
                    If preview looks blank or blocked, open live preview.
                  </span>
                  <button
                    type="button"
                    onClick={onExternalOpen}
                    className="text-foreground hover:underline font-medium whitespace-nowrap"
                  >
                    Open ↗
                  </button>
                </div>
              )}
              {/* Subtle "Local preview" pill on local */}
              {resolved.kind === "local" && (
                <div
                  data-testid="preview-local-corner-badge"
                  className="absolute top-3 left-3 rounded-md bg-background/80 backdrop-blur px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-warning border border-warning/20"
                >
                  Local preview
                </div>
              )}
            </div>
          ) : showFallbackCard ? (
            <div
              data-testid="preview-iframe-fallback"
              className="rounded-2xl border border-white/10 bg-gradient-card shadow-elevated h-full min-h-[inherit] overflow-hidden"
            >
              <div className="h-full flex flex-col items-center justify-center text-center p-10">
                <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                  Embedded preview blocked
                </div>
                <h2 className="mt-3 text-2xl md:text-3xl font-display font-bold tracking-tight text-balance">
                  This app may block embedded preview.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-md text-pretty">
                  The deploy succeeded, but this site can't be shown inside an iframe.
                  Open it in a new tab to verify it's live.
                </p>
                <Button
                  type="button"
                  variant="hero"
                  className="mt-5 touch-manipulation"
                  onClick={onExternalOpen}
                  aria-label="Open live preview"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open live preview
                </Button>
              </div>
            </div>
          ) : (
            // Empty local state — only when user picked Local and there's nothing to render.
            <div
              data-testid="preview-empty-state"
              className="rounded-2xl border border-white/10 bg-gradient-card shadow-elevated h-full min-h-[inherit] overflow-hidden"
            >
              <div className="h-full flex flex-col items-center justify-center text-center p-10">
                <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                  {resolved.kind === "local" ? "Local preview" : "Preview"}
                </div>
                <h2 className="mt-3 text-2xl md:text-3xl font-display font-bold tracking-tight text-balance">
                  {resolved.kind === "local"
                    ? "No local preview yet"
                    : project.name}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-md text-pretty">
                  {resolved.kind === "local"
                    ? "Ask yawB in the chat to build the first screen — it will render here without needing a deploy."
                    : "Tell yawB in the chat what to build. The first build will appear here."}
                </p>
                <div className="mt-5 flex items-center gap-2 flex-wrap justify-center">
                  <Button
                    type="button"
                    variant="hero"
                    className="touch-manipulation"
                    onClick={onStartBuild}
                    disabled={starting}
                  >
                    {starting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    {starting ? "Queuing…" : "Start a build"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onCreatePreviewDeploy}
                    data-testid="preview-create-deploy-cta"
                  >
                    Create preview deploy
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
