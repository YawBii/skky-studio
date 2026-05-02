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
  left,
  right,
  initialRightWidth = 380,
  minRightWidth = 280,
  maxRightWidth,
  minLeftWidth = 240,
  onChange,
}: Props) {
  const [rightWidth, setRightWidth] = useState(initialRightWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    setRightWidth(initialRightWidth);
  }, [initialRightWidth]);

  // Track viewport for mobile vs desktop layout. Lovable keeps chat + preview
  // side-by-side at narrow desktop widths (e.g. ~600px), only switching to a
  // bottom-sheet drawer on true phone widths. Match that behavior so users
  // don't lose the live preview when the window is narrow.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    const openChat = () => setChatOpen(true);
    window.addEventListener("yawb:open-chat", openChat as EventListener);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("yawb:open-chat", openChat as EventListener);
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const fromRight = rect.right - e.clientX;
      // Allow chat to grow up to (container width - minLeftWidth) — i.e. nearly full width.
      const upper = maxRightWidth ?? Math.max(minRightWidth, rect.width - minLeftWidth);
      const next = Math.max(minRightWidth, Math.min(upper, fromRight));
      setRightWidth(next);
    },
    [minRightWidth, maxRightWidth, minLeftWidth],
  );

  const stopDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      onChange?.(rightWidth);
    },
    [onChange, rightWidth],
  );

  if (isMobile) {
    return (
      <MobileChatLayout left={left} right={right} open={chatOpen} onOpenChange={setChatOpen} />
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
        onDoubleClick={() => {
          setRightWidth(380);
          onChange?.(380);
        }}
        className={cn(
          "group relative w-2 shrink-0 cursor-col-resize bg-white/5 hover:bg-primary/40 active:bg-primary/60 transition-colors",
          "touch-none select-none",
        )}
        style={{ touchAction: "none" }}
        title="Drag to resize · double-click to reset"
      >
        {/* Larger invisible hit area for easier grabbing — kept inside the
            separator only. Previously this overflowed -left-2 / -right-2 into
            both panes and swallowed taps near the divider on touch devices
            (Surface Pro, iPad). pointer-events-none keeps it visual-only;
            the parent separator div already handles pointer capture. */}
        <div className="absolute inset-0 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex h-12 w-3.5 items-center justify-center rounded-md border border-white/15 bg-white/15 backdrop-blur-sm opacity-80 group-hover:opacity-100 group-active:bg-primary/40 pointer-events-none">
          <GripVertical className="h-3.5 w-3.5 text-foreground/90" />
        </div>
      </div>
      <div style={{ width: rightWidth }} className="shrink-0 h-full min-w-0">
        {right}
      </div>
    </div>
  );
}

/* ----------------------------- Mobile layout ----------------------------- */

function MobileChatLayout({
  left,
  right,
  open,
  onOpenChange,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset drag offset when reopening.
  useEffect(() => {
    if (open) setDragY(0);
  }, [open]);

  const onDragStart = (e: React.PointerEvent) => {
    startYRef.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (startYRef.current == null) return;
    const dy = e.clientY - startYRef.current;
    setDragY(Math.max(0, dy));
  };
  const onDragEnd = (e: React.PointerEvent) => {
    if (startYRef.current == null) return;
    const dy = e.clientY - startYRef.current;
    startYRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    const sheetH = sheetRef.current?.offsetHeight ?? 600;
    // Dismiss if dragged > 30% of sheet height OR fast flick (>120px).
    if (dy > sheetH * 0.3 || dy > 120) {
      onOpenChange(false);
    }
    setDragY(0);
  };

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">{left}</div>

      {/* Persistent floating chat button — always visible on mobile/tablet.
          Hidden by default on the builder route, which renders its own bottom
          tab bar that includes a Chat tab. The builder dispatches the
          'yawb:open-chat' event to open this sheet. */}
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        data-testid="mobile-chat-fab"
        className={cn(
          "fixed right-4 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-brand px-4 py-3 text-[13px] font-medium text-primary-foreground shadow-glow transition-opacity",
          "bottom-[calc(env(safe-area-inset-bottom)+72px)]",
          open && "opacity-0 pointer-events-none",
        )}
        aria-label="Open yawB chat"
        aria-expanded={open}
      >
        <MessageSquare className="h-4 w-4" /> Chat
      </button>

      {/* Bottom-sheet chat drawer with swipe-to-dismiss */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="yawB chat"
        >
          <button
            aria-label="Close chat"
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <div
            ref={sheetRef}
            data-testid="mobile-chat-sheet"
            className="relative h-[88dvh] w-full bg-sidebar border-t border-white/10 rounded-t-2xl flex flex-col overflow-hidden shadow-elevated pb-[env(safe-area-inset-bottom)]"
            style={{
              transform: `translateY(${dragY}px)`,
              transition: dragY === 0 ? "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)" : "none",
            }}
          >
            {/* Drag handle area — large hit target for swipe-down */}
            <div
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              className="relative h-11 flex items-center justify-center border-b border-white/5 cursor-grab active:cursor-grabbing touch-none"
              style={{ touchAction: "none" }}
            >
              <div className="h-1 w-10 rounded-full bg-white/20" />
              <button
                onClick={() => onOpenChange(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-white/5"
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
