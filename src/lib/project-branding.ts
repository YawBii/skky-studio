export interface ProjectBrandingSource {
  logo_url?: string | null;
  favicon_url?: string | null;
  watermark_url?: string | null;
}

export interface ResolvedProjectBranding {
  logoUrl: string;
  faviconUrl: string;
  watermarkUrl: string;
  usesDefaultLogo: boolean;
  usesDefaultFavicon: boolean;
  usesDefaultWatermark: boolean;
}

export const DEFAULT_PROJECT_BRANDING = Object.freeze({
  logoUrl: "/branding/skky-default-logo.svg",
  faviconUrl: "/branding/skky-default-favicon.svg",
  watermarkUrl: "/branding/skky-default-watermark.svg",
});

function clean(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveProjectBranding(
  project?: ProjectBrandingSource | null,
): ResolvedProjectBranding {
  const logo = clean(project?.logo_url);
  const favicon = clean(project?.favicon_url);
  const watermark = clean(project?.watermark_url);

  return {
    logoUrl: logo ?? DEFAULT_PROJECT_BRANDING.logoUrl,
    faviconUrl: favicon ?? DEFAULT_PROJECT_BRANDING.faviconUrl,
    watermarkUrl: watermark ?? DEFAULT_PROJECT_BRANDING.watermarkUrl,
    usesDefaultLogo: !logo,
    usesDefaultFavicon: !favicon,
    usesDefaultWatermark: !watermark,
  };
}
