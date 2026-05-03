// Workaround for a well-known Radix UI bug where Dialog / Sheet / Popover /
// AlertDialog occasionally leave `document.body { pointer-events: none }`
// after closing (especially when an Escape key, a route change, or a
// rapid open/close cycle happens during the closing animation). The result
// is a frozen UI: nothing reacts to mouse or touch, and the console stays
// silent. This guard observes inline body styles and clears the stuck rule
// as soon as no Radix overlay is actually open.
//
// References:
//   https://github.com/radix-ui/primitives/issues/1241
//   https://github.com/shadcn-ui/ui/issues/1582
import { useEffect } from "react";

export function BodyPointerEventsGuard() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;

    const hasOpenRadixOverlay = () =>
      document.querySelector(
        '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"], [data-radix-popper-content-wrapper]',
      ) !== null;

    const fix = () => {
      if (body.style.pointerEvents === "none" && !hasOpenRadixOverlay()) {
        body.style.pointerEvents = "";
      }
    };

    // Run once on mount in case we hydrated into a stuck state.
    fix();

    const mo = new MutationObserver(fix);
    mo.observe(body, { attributes: true, attributeFilter: ["style"] });

    // Belt-and-braces: clear on any pointer activity. If body is locked, the
    // event still fires on document while bubbling/capture, even though no
    // child receives it.
    const onAny = () => fix();
    document.addEventListener("pointerdown", onAny, true);
    document.addEventListener("touchstart", onAny, true);
    document.addEventListener("keydown", onAny, true);

    return () => {
      mo.disconnect();
      document.removeEventListener("pointerdown", onAny, true);
      document.removeEventListener("touchstart", onAny, true);
      document.removeEventListener("keydown", onAny, true);
    };
  }, []);

  return null;
}
