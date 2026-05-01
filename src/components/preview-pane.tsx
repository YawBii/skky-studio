import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, Monitor, Play, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Project } from "@/services/projects";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

export interface PreviewPaneProps {
  device: PreviewDevice;
  setDevice: (d: PreviewDevice) => void;
  project: Project;
  onStartBuild: () => void;
  starting: boolean;
  selectedPage: string;
  activeDeployUrl: string | null;
}

type IframeState = "idle" | "loading" | "loaded" | "failed";

const IFRAME_LOAD_TIMEOUT_MS = 8000;

export function PreviewPane({
  device,
  setDevice,
  project,
  onStartBuild,
  starting,
  selectedPage,
  activeDeployUrl,
}: PreviewPaneProps) {
  const widths: Record<PreviewDevice, string> = {
    desktop: "100%",
    tablet: "820px",
    mobile: "390px",
  };

  const iframeSrc = useMemo(() => {
    if (!activeDeployUrl) return null;
    try {
      const u = new URL(activeDeployUrl);
      if (selectedPage && selectedPage !== "/") u.pathname = selectedPage;
      return u.toString();
    } catch {
      return activeDeployUrl;
    }
  }, [activeDeployUrl, selectedPage]);

  const [iframeState, setIframeState] = useState<IframeState>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset + start the load timer whenever the iframe URL changes.
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (!iframeSrc) {
      setIframeState("idle");
      return;
    }
    setIframeState("loading");
    console.info("[yawb] preview.iframe.loading", { url: iframeSrc });
    timeoutRef.current = setTimeout(() => {
      // If still loading after the timeout, treat as failed (likely
      // X-Frame-Options/CSP block — do NOT mark deploy itself as failed).
      setIframeState((cur) => {
        if (cur === "loading") {
          console.info("[yawb] preview.iframe.failed", {
            url: iframeSrc,
            reason: "timeout",
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
    };
  }, [iframeSrc]);

  const onIframeLoad = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIframeState("loaded");
    console.info("[yawb] preview.iframe.loaded", { url: iframeSrc });
  };

  const onIframeError = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIframeState("failed");
    console.info("[yawb] preview.iframe.failed", {
      url: iframeSrc,
      reason: "error",
    });
  };

  const onExternalOpen = () => {
    if (!activeDeployUrl) return;
    console.info("[yawb] preview.external.open", { url: activeDeployUrl });
    window.open(activeDeployUrl, "_blank", "noopener");
  };

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
        <div
          data-testid="preview-url-bar"
          className="flex-1 mx-2 h-7 rounded-md bg-white/[0.04] border border-white/5 px-2.5 flex items-center text-[11.5px] text-muted-foreground gap-2 font-mono"
        >
          <ExternalLink className="h-3 w-3" />
          {activeDeployUrl ? (
            <>
              <span className="truncate text-foreground/80">{activeDeployUrl}</span>
              <span className="text-muted-foreground/50">{selectedPage}</span>
            </>
          ) : (
            <>
              <span className="truncate">{selectedPage}</span>
              <span className="ml-auto text-muted-foreground/60 text-[10.5px] non-italic">
                No deploy URL yet
              </span>
            </>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 touch-manipulation"
          onClick={onExternalOpen}
          disabled={!activeDeployUrl}
          aria-label="Open deploy URL in new tab"
          title={activeDeployUrl ? "Open in new tab" : "No deploy URL yet"}
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
      <div className="flex-1 overflow-auto p-8 grid place-items-start justify-center bg-[oklch(0.13_0_0)]">
        <div style={{ width: widths[device] }} className="transition-all w-full max-w-full">
          {iframeSrc && iframeState !== "failed" ? (
            <div className="rounded-2xl border border-white/10 bg-background shadow-elevated aspect-[16/10] overflow-hidden relative">
              <iframe
                title={`${project.name} preview`}
                src={iframeSrc}
                data-testid="preview-iframe"
                onLoad={onIframeLoad}
                onError={onIframeError}
                className="w-full h-full block bg-background"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
              {iframeState === "loading" && (
                <div
                  data-testid="preview-iframe-loading"
                  className="absolute inset-0 grid place-items-center bg-background/40 backdrop-blur-sm pointer-events-none"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          ) : iframeSrc && iframeState === "failed" ? (
            <div
              data-testid="preview-iframe-fallback"
              className="rounded-2xl border border-white/10 bg-gradient-card shadow-elevated aspect-[16/10] overflow-hidden"
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
            <div
              data-testid="preview-empty-state"
              className="rounded-2xl border border-white/10 bg-gradient-card shadow-elevated aspect-[16/10] overflow-hidden"
            >
              <div className="h-full flex flex-col items-center justify-center text-center p-10">
                <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                  Preview
                </div>
                <h2 className="mt-3 text-3xl md:text-4xl font-display font-bold tracking-tight text-balance">
                  {project.name}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-md text-pretty">
                  Tell yawB in the chat what to build. The first build will appear here.
                </p>
                <Button
                  type="button"
                  variant="hero"
                  className="mt-5 touch-manipulation"
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
