import { useEffect, useRef, useState, useCallback } from "react";
import { GripVertical } from "lucide-react";
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
 * Simple, robust horizontal split. Right pane has a pixel width; left fills
 * the rest. Drag handle in between. SSR-safe: layout works without JS.
 */
export function SplitPane({
  left, right,
  initialRightWidth = 420,
  minRightWidth = 320,
  maxRightWidth = 720,
  minLeftWidth = 360,
  onChange,
}: Props) {
  const [rightWidth, setRightWidth] = useState(initialRightWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => { setRightWidth(initialRightWidth); }, [initialRightWidth]);

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
    const maxByContainer = rect.width - minLeftWidth;
    const next = Math.max(minRightWidth, Math.min(maxRightWidth, Math.min(fromRight, maxByContainer)));
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
        className={cn(
          "group relative w-1.5 shrink-0 cursor-col-resize bg-white/5 hover:bg-primary/40 active:bg-primary/60 transition-colors",
        )}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex h-10 w-3 items-center justify-center rounded-sm border border-white/10 bg-white/10 backdrop-blur-sm opacity-70 group-hover:opacity-100">
          <GripVertical className="h-3 w-3 text-foreground/80" />
        </div>
      </div>
      <div style={{ width: rightWidth }} className="shrink-0 h-full min-w-0">{right}</div>
    </div>
  );
}
