import type { MonsterBlueprint } from "./monster-blueprint";
import type { GeneratedProjectFile } from "./monster-brain-generator";

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[ch] ?? ch));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "monster-app";
}

function domainNoun(blueprint: MonsterBlueprint): string {
  const text = `${blueprint.appType} ${blueprint.prompt} ${blueprint.summary}`.toLowerCase();
  if (/law|legal|firm|case|client|contract/.test(text)) return "matter";
  if (/identity|verify|trust|profile|kyc/.test(text)) return "profile";
  if (/finance|payment|invoice|billing|ledger/.test(text)) return "ledger";
  if (/market|listing|seller|buyer|shop/.test(text)) return "listing";
  if (/booking|appointment|calendar/.test(text)) return "booking";
  if (/job|candidate|hiring|recruit/.test(text)) return "candidate";
  return "operation";
}

function layoutFor(blueprint: MonsterBlueprint): "case-cockpit" | "trust-radar" | "ledger-room" | "market-map" | "ops-studio" {
  const text = `${blueprint.appType} ${blueprint.prompt} ${blueprint.summary}`.toLowerCase();
  if (/law|legal|firm|case|client|contract/.test(text)) return "case-cockpit";
  if (/identity|verify|trust|profile|kyc|compliance/.test(text)) return "trust-radar";
  if (/finance|payment|invoice|billing|ledger|money/.test(text)) return "ledger-room";
  if (/market|listing|seller|buyer|shop|commerce/.test(text)) return "market-map";
  return "ops-studio";
}

function paletteFor(layout: ReturnType<typeof layoutFor>) {
  switch (layout) {
    case "case-cockpit": return { bg: "#120f0a", paper: "#f4ebd8", ink: "#211814", muted: "#745f4f", accent: "#9b2f19", accent2: "#d7a84d" };
    case "trust-radar": return { bg: "#06131e", paper: "#e9f7ff", ink: "#06131e", muted: "#557083", accent: "#0ea5b7", accent2: "#6ee7b7" };
    case "ledger-room": return { bg: "#07110d", paper: "#ecfff6", ink: "#07110d", muted: "#4d6d5c", accent: "#0f9f6e", accent2: "#d7ff62" };
    case "market-map": return { bg: "#130d1d", paper: "#fff4e7", ink: "#281529", muted: "#7d5c78", accent: "#f97316", accent2: "#8b5cf6" };
    default: return { bg: "#080b12", paper: "#edf2ff", ink: "#0b1020", muted: "#5e6b86", accent: "#4f46e5", accent2: "#06b6d4" };
  }
}

function sections(blueprint: MonsterBlueprint) {
  const noun = domainNoun(blueprint);
  return {
    noun,
    routes: blueprint.routes.slice(0, 5),
    tables: blueprint.backend.tables.slice(0, 5),
    workflows: blueprint.workflows.slice(0, 4),
    tests: blueprint.acceptanceTests.slice(0, 4),
  };
}

function html(blueprint: MonsterBlueprint): string {
  const layout = layoutFor(blueprint);
  const p = paletteFor(layout);
  const s = sections(blueprint);
  const app = esc(blueprint.appName);
  const prompt = esc(blueprint.prompt || blueprint.summary);
  const tableCards = s.tables.map((table, index) => `<article class="data-card" style="--i:${index}"><span>${esc(table.table)}</span><strong>${esc(table.purpose)}</strong><small>${table.rlsPolicies.length} RLS drafts</small></article>`).join("");
  const routeRail = s.routes.map((route) => `<li><b>${esc(route.path)}</b><span>${esc(route.purpose)}</span></li>`).join("");
  const workflowList = s.workflows.map((workflow) => `<li>${esc(workflow)}</li>`).join("");
  const tests = s.tests.map((test) => `<li>${esc(test)}</li>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="yawb-generator" content="monster-custom-preview-v1" />
  <meta name="yawb-design-mode" content="${esc(blueprint.design.mode)}" />
  <meta name="yawb-app-type" content="${esc(blueprint.appType)}" />
  <meta name="yawb-layout" content="${layout}" />
  <title>${app}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body data-layout="${layout}">
  <main class="shell">
    <aside class="left-rail">
      <div class="mark">${app.slice(0, 2).toUpperCase()}</div>
      <nav>${s.routes.map((route) => `<a href="#${slug(route.label)}">${esc(route.label)}</a>`).join("")}</nav>
      <div class="proof-dot">Monster Blueprint</div>
    </aside>

    <section class="hero-panel">
      <p class="kicker">${esc(blueprint.appType)} · ${layout.replace(/-/g, " ")}</p>
      <h1>${headline(blueprint, layout)}</h1>
      <p class="lede">${prompt}</p>
      <div class="actions"><button>${primaryCta(layout)}</button><button class="ghost">View proof</button></div>
    </section>

    <section class="cockpit">
      <div class="cockpit-head">
        <span>${esc(s.noun)} command center</span>
        <b>${blueprint.backend.tables.length} tables · ${blueprint.routes.length} routes</b>
      </div>
      <div class="data-grid">${tableCards}</div>
    </section>

    <section class="route-map">
      <h2>Product map</h2>
      <ul>${routeRail}</ul>
    </section>

    <section class="workflow-board">
      <div><h2>What yawB wired</h2><ol>${workflowList}</ol></div>
      <div><h2>Acceptance proof</h2><ol>${tests}</ol></div>
    </section>
  </main>
</body>
</html>`;
}

function headline(blueprint: MonsterBlueprint, layout: ReturnType<typeof layoutFor>): string {
  const app = esc(blueprint.appName);
  switch (layout) {
    case "case-cockpit": return `${app} — legal operations with a case cockpit, not a brochure.`;
    case "trust-radar": return `${app} — verification radar for every profile and risk signal.`;
    case "ledger-room": return `${app} — a living ledger room for money, invoices, and proof.`;
    case "market-map": return `${app} — marketplace command map for supply, demand, and trust.`;
    default: return `${app} — custom product OS generated from the blueprint.`;
  }
}

function primaryCta(layout: ReturnType<typeof layoutFor>): string {
  switch (layout) {
    case "case-cockpit": return "Open case cockpit";
    case "trust-radar": return "Run verification";
    case "ledger-room": return "Open ledger";
    case "market-map": return "Map listings";
    default: return "Open dashboard";
  }
}

function css(blueprint: MonsterBlueprint): string {
  const layout = layoutFor(blueprint);
  const p = paletteFor(layout);
  return `:root{--bg:${p.bg};--paper:${p.paper};--ink:${p.ink};--muted:${p.muted};--accent:${p.accent};--accent2:${p.accent2}}*{box-sizing:border-box}body{margin:0;background:var(--bg);font-family:Inter,ui-sans-serif,system-ui;color:var(--paper)}.shell{min-height:100vh;display:grid;grid-template-columns:210px minmax(320px,1.05fr) minmax(340px,.95fr);grid-template-rows:auto auto;gap:18px;padding:22px}.left-rail{grid-row:1/3;border:1px solid rgba(255,255,255,.12);border-radius:30px;padding:22px;display:flex;flex-direction:column;gap:28px;background:rgba(255,255,255,.05);position:sticky;top:22px;height:calc(100vh - 44px)}.mark{width:54px;height:54px;border-radius:18px;background:var(--paper);color:var(--ink);display:grid;place-items:center;font-weight:900}.left-rail nav{display:grid;gap:10px}.left-rail a{color:rgba(255,255,255,.72);text-decoration:none;font-size:13px}.proof-dot{margin-top:auto;color:var(--accent2);font-size:11px;text-transform:uppercase;letter-spacing:.16em}.hero-panel{background:var(--paper);color:var(--ink);border-radius:38px;padding:clamp(28px,4vw,70px);min-height:540px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}.hero-panel:after{content:"";position:absolute;inset:auto -12% -24% 42%;height:55%;border-radius:50%;background:radial-gradient(circle,var(--accent2),transparent 65%);opacity:.45}.kicker{font-size:12px;text-transform:uppercase;letter-spacing:.22em;color:var(--accent);font-weight:800}.hero-panel h1{font-family:Georgia,serif;font-size:clamp(48px,7vw,104px);line-height:.9;letter-spacing:-.07em;max-width:10ch;margin:0;position:relative}.lede{font-size:clamp(17px,2vw,24px);line-height:1.35;max-width:680px;color:var(--muted);position:relative}.actions{display:flex;gap:12px;flex-wrap:wrap;position:relative}.actions button{border:0;border-radius:999px;padding:14px 20px;background:var(--accent);color:white;font-weight:900}.actions .ghost{background:transparent;color:var(--ink);border:1px solid rgba(0,0,0,.18)}.cockpit,.route-map,.workflow-board{border:1px solid rgba(255,255,255,.12);border-radius:32px;padding:28px;background:rgba(255,255,255,.07);backdrop-filter:blur(18px)}.cockpit-head{display:flex;justify-content:space-between;gap:18px;margin-bottom:20px}.cockpit-head span,.route-map h2,.workflow-board h2{text-transform:uppercase;letter-spacing:.16em;font-size:12px;color:var(--accent2)}.data-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.data-card{min-height:138px;border-radius:24px;padding:20px;background:linear-gradient(135deg,rgba(255,255,255,.16),rgba(255,255,255,.06));display:grid;gap:8px}.data-card span{font-size:12px;text-transform:uppercase;letter-spacing:.16em;color:var(--accent2)}.data-card strong{font-size:20px;line-height:1.1}.data-card small{color:rgba(255,255,255,.6)}.route-map ul{list-style:none;padding:0;margin:0;display:grid;gap:12px}.route-map li{display:grid;grid-template-columns:90px 1fr;gap:12px;padding:14px;border-radius:18px;background:rgba(255,255,255,.06)}.route-map b{font-family:ui-monospace,monospace;color:var(--accent2)}.route-map span{color:rgba(255,255,255,.72)}.workflow-board{grid-column:2/4;display:grid;grid-template-columns:1fr 1fr;gap:18px}.workflow-board ol{padding-left:20px;color:rgba(255,255,255,.76);line-height:1.7}@media(max-width:1050px){.shell{grid-template-columns:1fr}.left-rail{position:relative;height:auto;grid-row:auto}.workflow-board{grid-column:auto;grid-template-columns:1fr}.hero-panel{min-height:460px}.data-grid{grid-template-columns:1fr}}`;
}

function js(blueprint: MonsterBlueprint): string {
  return `window.__YAWB_MONSTER_PREVIEW__=${JSON.stringify({ generator: "monster-custom-preview-v1", appType: blueprint.appType, designMode: blueprint.design.mode, routes: blueprint.routes.map((r) => r.path), tables: blueprint.backend.tables.map((t) => t.table) }, null, 2)};`;
}

export function generateMonsterCustomPreviewFiles(blueprint: MonsterBlueprint): GeneratedProjectFile[] {
  return [
    { path: "index.html", content: html(blueprint), language: "html", kind: "source" },
    { path: "styles.css", content: css(blueprint), language: "css", kind: "source" },
    { path: "app.js", content: js(blueprint), language: "javascript", kind: "source" },
  ];
}
