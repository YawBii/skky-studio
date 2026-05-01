import { useMemo } from "react";
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
          {iframeSrc ? (
            <div className="rounded-2xl border border-white/10 bg-background shadow-elevated aspect-[16/10] overflow-hidden">
              <iframe
                title={`${project.name} preview`}
                src={iframeSrc}
                data-testid="preview-iframe"
                className="w-full h-full block bg-background"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
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
