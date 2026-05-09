import { useEffect } from "react";

export function useProjectFavicon(faviconUrl?: string | null) {
  useEffect(() => {
    if (!faviconUrl || typeof document === "undefined") return;

    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }

    link.href = faviconUrl;
  }, [faviconUrl]);
}
