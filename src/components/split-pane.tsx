import { useEffect, useRef, useState, useCallback } from "react";
import { GripVertical, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  left: React.ReactNode;
  right: React.ReactNode;
  initialRightWidth?: number;
  minRightWidth?: number;
  maxRightWidth?: number;
  minLeftWidth?: number;
  onChange?: (rightWidth: number) => void;
}

/**
 * Responsive split. On desktop: resizable horizontal split with drag handle.
 * On mobile/tablet (<1024px): left fills the screen and right is shown as a
 * bottom-anchored chat drawer toggled via a floating action button — same
 * pattern Lovable uses on small screens.
 */
export function SplitPane({
  left, right,
  initialRightWidth = 460,
  minRightWidth = 320,
  maxRightWidth,
  minLeftWidth = 360,
  onChange,
}: Props) {
  const [rightWidth, setRightWidth] = useState(initialRightWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => { setRightWidth(initialRightWidth); }, [initialRightWidth]);

  // Track viewport for mobile/tablet vs desktop layout.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const fromRight = rect.right - e.clientX;
    // Allow chat to grow up to (container width - minLeftWidth) — i.e. nearly full width.
    const upper = maxRightWidth ?? Math.max(minRightWidth, rect.width - minLeftWidth);
    const next = Math.max(minRightWidth, Math.min(upper, fromRight));
    setRightWidth(next);
  }, [minRightWidth, maxRightWidth, minLeftWidth]);

  const stopDrag = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    onChange?.(rightWidth);
  }, [onChange, rightWidth]);

  if (isMobile) {
    return (
      <div ref={containerRef} className="relative h-full w-full">
        <div className="absolute inset-0">{left}</div>

        {/* Floating chat trigger */}
        {!chatOpen && (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="fixed bottom-5 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-brand px-4 py-3 text-[13px] font-medium text-primary-foreground shadow-glow"
            aria-label="Open yawB chat"
          >
            <MessageSquare className="h-4 w-4" /> Chat
          </button>
        )}

        {/* Bottom-sheet chat drawer */}
        {chatOpen && (
          <div className="fixed inset-0 z-50 flex flex-col">
            <button
              aria-label="Close chat"
              className="flex-1 bg-black/50 backdrop-blur-sm"
              onClick={() => setChatOpen(false)}
            />
            <div className="h-[85vh] w-full bg-sidebar border-t border-white/10 rounded-t-2xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 h-10 border-b border-white/5">
                <div className="mx-auto h-1 w-10 rounded-full bg-white/15" />
                <button
                  onClick={() => setChatOpen(false)}
                  className="absolute right-3 mt-0 text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0">{right}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full w-full min-w-0">
      <div className="flex-1 min-w-0 h-full">{left}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onDoubleClick={() => { setRightWidth(460); onChange?.(460); }}
        className={cn(
          "group relative w-2 shrink-0 cursor-col-resize bg-white/5 hover:bg-primary/40 active:bg-primary/60 transition-colors",
          "touch-none select-none",
        )}
        style={{ touchAction: "none" }}
        title="Drag to resize · double-click to reset"
      >
        {/* Larger invisible hit area for easier grabbing */}
        <div className="absolute inset-y-0 -left-2 -right-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex h-12 w-3.5 items-center justify-center rounded-md border border-white/15 bg-white/15 backdrop-blur-sm opacity-80 group-hover:opacity-100 group-active:bg-primary/40 pointer-events-none">
          <GripVertical className="h-3.5 w-3.5 text-foreground/90" />
        </div>
      </div>
      <div style={{ width: rightWidth }} className="shrink-0 h-full min-w-0">{right}</div>
    </div>
  );
}
