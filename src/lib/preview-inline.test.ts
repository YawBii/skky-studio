import { describe, it, expect } from "vitest";
import { inlineLocalAssets } from "./preview-inline";

const HTML = `<!doctype html><html><head><link rel="stylesheet" href="./styles.css" /></head><body><h1>Hi</h1><script src="./app.js"></script></body></html>`;

describe("inlineLocalAssets", () => {
  it("inlines styles.css and app.js when present", () => {
    const out = inlineLocalAssets(HTML, {
      stylesCss: "body{color:red}",
      appJs: "console.log('ok')",
    });
    expect(out).toContain('<style data-yawb-inline="styles.css">body{color:red}</style>');
    expect(out).toContain('<script data-yawb-inline="app.js">console.log(\'ok\')</script>');
    expect(out).not.toContain('href="./styles.css"');
    expect(out).not.toContain('src="./app.js"');
  });

  it("neutralizes the unresolved link/script when assets are missing", () => {
    const out = inlineLocalAssets(HTML, {});
    expect(out).not.toContain('href="./styles.css"');
    expect(out).not.toContain('src="./app.js"');
    expect(out).toContain("removed unresolved styles.css link");
    expect(out).toContain("removed unresolved app.js script");
  });

  it("escapes embedded </style> and </script> sequences", () => {
    const out = inlineLocalAssets(HTML, {
      stylesCss: "a{}</style><script>x</script>",
      appJs: "var s='</script>'",
    });
    expect(out).not.toMatch(/<style data-yawb-inline="styles.css">[^]*<\/style><script>/);
    expect(out).toContain("<\\/script");
  });
});
