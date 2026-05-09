import { resolveProjectBranding, type ProjectBrandingSource } from "@/lib/project-branding";

function attr(value: string): string {
  return value.replace(/[&<>"]/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    return "&quot;";
  });
}

function css(value: string): string {
  return value.replace(/[\\"')]/g, "\\$&");
}

function beforeHeadClose(html: string, addition: string): string {
  const close = html.toLowerCase().lastIndexOf("</head>");
  if (close < 0) return `${addition}\n${html}`;
  return `${html.slice(0, close)}${addition}\n${html.slice(close)}`;
}

export function injectPublishedBranding(
  html: string,
  project?: ProjectBrandingSource | null,
): string {
  const branding = resolveProjectBranding(project);
  let out = html;

  if (!/<link[^>]+rel=["']icon["']/i.test(out)) {
    out = beforeHeadClose(out, `  <link rel="icon" href="${attr(branding.faviconUrl)}" />`);
  }

  if (!/name=["']yawb-branding-source["']/i.test(out)) {
    out = beforeHeadClose(
      out,
      [
        `  <meta name="yawb-branding-source" content="${branding.usesDefaultLogo ? "default" : "project"}" />`,
        `  <meta name="yawb-brand-logo" content="${attr(branding.logoUrl)}" />`,
        `  <meta name="yawb-brand-favicon" content="${attr(branding.faviconUrl)}" />`,
        `  <meta name="yawb-brand-watermark" content="${attr(branding.watermarkUrl)}" />`,
      ].join("\n"),
    );
  }

  if (!/data-yawb-default-brand-style/i.test(out)) {
    out = beforeHeadClose(
      out,
      `  <style data-yawb-default-brand-style="true">.brand-logo{object-fit:contain;display:block}.brand-logo-full,.brand-mark,.logo-mark{width:min(220px,42vw)!important;height:56px!important;border-radius:0!important;background-color:transparent!important;background-image:url('${css(branding.logoUrl)}')!important;background-position:left center!important;background-size:contain!important;background-repeat:no-repeat!important;color:transparent!important;text-indent:-9999px;overflow:hidden;box-shadow:none!important;object-fit:contain!important;object-position:left center!important}.brand-logo-full{background-image:none!important}@media(max-width:900px){.brand-logo-full,.brand-mark,.logo-mark{width:min(180px,70vw)!important;height:48px!important}}</style>`,
    );
  }

  if (!/data-yawb-default-watermark/i.test(out)) {
    out = beforeHeadClose(
      out,
      `  <style data-yawb-default-watermark="true">body::after{content:"";position:fixed;right:24px;bottom:24px;width:min(220px,32vw);height:120px;background:url('${css(branding.watermarkUrl)}') center/contain no-repeat;opacity:.045;pointer-events:none;z-index:0}</style>`,
    );
  }

  return out;
}
