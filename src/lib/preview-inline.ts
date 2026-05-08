// Inlines local project_files assets (styles.css, app.js) into index.html so
// the iframe srcDoc renders fully without resolving relative ./ URLs against
// the parent document origin.

export interface InlineAssets {
  stylesCss?: string | null;
  appJs?: string | null;
}

const STYLES_HREF =
  /(<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["'](?:\.\/)?styles\.css["'][^>]*\/?>)/gi;
const SCRIPT_SRC = /(<script\b[^>]*\bsrc=["'](?:\.\/)?app\.js["'][^>]*><\/script>)/gi;

function escapeForStyle(css: string): string {
  // Prevent breaking out of the inline <style> tag.
  return css.replace(/<\/style/gi, "<\\/style");
}

function escapeForScript(js: string): string {
  return js.replace(/<\/script/gi, "<\\/script");
}

export function inlineLocalAssets(html: string, assets: InlineAssets): string {
  let out = html;
  const css = assets.stylesCss?.trim();
  const js = assets.appJs?.trim();

  if (css) {
    const styleTag = `<style data-yawb-inline="styles.css">${escapeForStyle(css)}</style>`;
    if (STYLES_HREF.test(out)) {
      STYLES_HREF.lastIndex = 0;
      out = out.replace(STYLES_HREF, styleTag);
    } else {
      // Inject into <head> if no link tag exists.
      out = out.replace(/<\/head>/i, `${styleTag}</head>`);
    }
  } else {
    // Neutralize broken external link to avoid failed fetch noise.
    STYLES_HREF.lastIndex = 0;
    out = out.replace(STYLES_HREF, "<!-- yawb: removed unresolved styles.css link -->");
  }

  if (js) {
    const scriptTag = `<script data-yawb-inline="app.js">${escapeForScript(js)}</script>`;
    if (SCRIPT_SRC.test(out)) {
      SCRIPT_SRC.lastIndex = 0;
      out = out.replace(SCRIPT_SRC, scriptTag);
    } else {
      out = out.replace(/<\/body>/i, `${scriptTag}</body>`);
    }
  } else {
    SCRIPT_SRC.lastIndex = 0;
    out = out.replace(SCRIPT_SRC, "<!-- yawb: removed unresolved app.js script -->");
  }

  return out;
}
