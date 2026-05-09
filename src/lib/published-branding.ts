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

  if (!/data-yawb-default-watermark/i.test(out)) {
    out = beforeHeadClose(
      out,
      `  <style data-yawb-default-watermark="true">body::after{content:"";position:fixed;right:24px;bottom:24px;width:min(220px,32vw);height:120px;background:url('${css(branding.watermarkUrl)}') center/contain no-repeat;opacity:.045;pointer-events:none;z-index:0}</style>`,
    );
  }

  return out;
}
