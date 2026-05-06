import type { MonsterBlueprint } from "./monster-blueprint";
import type { GeneratedProjectFile } from "./monster-brain-generator";
import type { MonsterDesignBrief } from "./monster-design-brief";

function esc(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[ch] ?? ch,
  );
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "monster-app"
  );
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

function layoutFor(
  blueprint: MonsterBlueprint,
): "case-cockpit" | "trust-radar" | "ledger-room" | "market-map" | "ops-studio" {
  const text = `${blueprint.appType} ${blueprint.prompt} ${blueprint.summary}`.toLowerCase();
  if (/law|legal|firm|case|client|contract/.test(text)) return "case-cockpit";
  if (/identity|verify|trust|profile|kyc|compliance/.test(text)) return "trust-radar";
  if (/finance|payment|invoice|billing|ledger|money/.test(text)) return "ledger-room";
  if (/market|listing|seller|buyer|shop|commerce/.test(text)) return "market-map";
  return "ops-studio";
}

function paletteFor(layout: ReturnType<typeof layoutFor>) {
  switch (layout) {
    case "case-cockpit":
      return {
        bg: "#120f0a",
        paper: "#f4ebd8",
        ink: "#211814",
        muted: "#745f4f",
        accent: "#9b2f19",
        accent2: "#d7a84d",
      };
    case "trust-radar":
      return {
        bg: "#06131e",
        paper: "#e9f7ff",
        ink: "#06131e",
        muted: "#557083",
        accent: "#0ea5b7",
        accent2: "#6ee7b7",
      };
    case "ledger-room":
      return {
        bg: "#07110d",
        paper: "#ecfff6",
        ink: "#07110d",
        muted: "#4d6d5c",
        accent: "#0f9f6e",
        accent2: "#d7ff62",
      };
    case "market-map":
      return {
        bg: "#130d1d",
        paper: "#fff4e7",
        ink: "#281529",
        muted: "#7d5c78",
        accent: "#f97316",
        accent2: "#8b5cf6",
      };
    default:
      return {
        bg: "#080b12",
        paper: "#edf2ff",
        ink: "#0b1020",
        muted: "#5e6b86",
        accent: "#4f46e5",
        accent2: "#06b6d4",
      };
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

function html(blueprint: MonsterBlueprint, brief?: MonsterDesignBrief): string {
  const layout = layoutFor(blueprint);
  const p = brief
    ? {
        bg: brief.colorPalette.bg,
        paper: brief.colorPalette.surface,
        ink: brief.colorPalette.ink,
        muted: brief.colorPalette.ink,
        accent: brief.colorPalette.accent,
        accent2: brief.colorPalette.accent2,
      }
    : paletteFor(layout);
  void p;
  const s = sections(blueprint);
  const app = esc(blueprint.appName);
  const prompt = esc(blueprint.prompt || blueprint.summary);
  const category = esc(brief?.productCategory ?? blueprint.appType);
  const heroLine = esc(brief?.heroComposition ?? blueprint.summary);
  const targetUser = esc(brief?.targetUser ?? "operators");
  const screensList = (brief?.keyScreens ?? s.routes.map((r) => r.label))
    .slice(0, 6)
    .map((screen) => `<li>${esc(screen)}</li>`)
    .join("");
  const tableCards = s.tables
    .map(
      (table, index) =>
        `<article class="data-card" style="--i:${index}"><span>${esc(table.table)}</span><strong>${esc(table.purpose)}</strong><small>${table.rlsPolicies.length} RLS drafts</small></article>`,
    )
    .join("");
  const routeRail = s.routes
    .map((route) => `<li><b>${esc(route.path)}</b><span>${esc(route.purpose)}</span></li>`)
    .join("");
  const workflowList = s.workflows.map((workflow) => `<li>${esc(workflow)}</li>`).join("");
  const tests = s.tests.map((test) => `<li>${esc(test)}</li>`).join("");
  const navPattern = brief?.navigationPattern ?? "left-rail";
  const cardStyle = brief?.cardStyle ?? "glass";
  const spacing = brief?.spacingRhythm ?? "balanced";

<body data-layout="${layout}" data-nav="${navPattern}" data-cards="${cardStyle}" data-spacing="${spacing}">
  <button class="mobile-nav-toggle" aria-label="Open menu" aria-controls="left-rail" data-nav-toggle>
    <span></span><span></span><span></span>
  </button>
  <main class="shell">
    <aside class="left-rail" id="left-rail">
      <div class="mark">${app.slice(0, 2).toUpperCase()}</div>
      <nav>${s.routes.map((route) => `<a href="#${slug(route.label)}">${esc(route.label)}</a>`).join("")}</nav>
      <div class="proof-dot">${category}</div>
    </aside>

    <section class="hero-panel">
      <p class="kicker">${category} · for ${targetUser}</p>
      <h1>${headline(blueprint, layout)}</h1>
      <p class="lede">${heroLine || prompt}</p>
      <div class="actions"><button>${primaryCta(layout)}</button><button class="ghost">View workflow</button></div>
    </section>

    <section class="cockpit" id="cockpit">
      <div class="cockpit-head">
        <span>${esc(s.noun)} cockpit · workflow board</span>
        <b>${blueprint.backend.tables.length} tables · ${blueprint.routes.length} routes</b>
      </div>
      <div class="data-grid">${tableCards}</div>
    </section>

    <section class="intake-queue" id="intake">
      <div class="cockpit-head"><span>${intakeLabel(layout)} queue</span><b>4 pending</b></div>
      <table class="queue-table" role="grid">
        <thead><tr><th>Name</th><th>Stage</th><th>Owner</th><th>Updated</th></tr></thead>
        <tbody>${intakeRows(s.noun)}</tbody>
      </table>
      <form class="intake-form" aria-label="Quick intake">
        <input placeholder="Add new ${esc(s.noun)}…" />
        <button type="button">Add</button>
      </form>
    </section>

    <section class="billing-panel" id="billing">
      <div class="cockpit-head"><span>${billingLabel(layout)}</span><b>USD 12,480 outstanding</b></div>
      <ul class="billing-list">${billingRows(layout)}</ul>
    </section>

    <section class="admin-panel" id="admin">
      <div class="cockpit-head"><span>Admin · roles &amp; access</span><b>3 roles · 8 members</b></div>
      <ul class="role-list">
        <li><b>Owner</b><span>Full access · billing, members, exports</span></li>
        <li><b>Operator</b><span>Workflow access · no billing</span></li>
        <li><b>Viewer</b><span>Read-only timeline + reports</span></li>
      </ul>
    </section>

    <section class="data-model" id="data-model">
      <div class="cockpit-head"><span>Supabase data model</span><b>${blueprint.backend.tables.length} tables · RLS drafted</b></div>
      <ul class="schema-list">${blueprint.backend.tables
        .slice(0, 6)
        .map(
          (t) =>
            `<li><code>public.${esc(t.table)}</code><span>${esc(t.purpose)}</span><small>${t.rlsPolicies.length} RLS policies</small></li>`,
        )
        .join("")}</ul>
    </section>

    <section class="route-map" id="screens">
      <h2>Key screens</h2>
      <ul>${screensList}</ul>
    </section>

    <section class="workflow-board" id="workflows">
      <div><h2>Real workflows wired</h2><ol>${workflowList}</ol></div>
      <div><h2>Acceptance proof</h2><ol>${tests}</ol></div>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>`;
}

function intakeLabel(layout: ReturnType<typeof layoutFor>): string {
  switch (layout) {
    case "case-cockpit":
      return "Client intake";
    case "trust-radar":
      return "Verification";
    case "ledger-room":
      return "Approvals";
    case "market-map":
      return "Listing review";
    default:
      return "Intake";
  }
}

function billingLabel(layout: ReturnType<typeof layoutFor>): string {
  switch (layout) {
    case "case-cockpit":
      return "Invoices &amp; payments";
    case "ledger-room":
      return "Ledger &amp; payments";
    case "market-map":
      return "Payouts";
    case "trust-radar":
      return "Plan &amp; billing";
    default:
      return "Billing";
  }
}

function intakeRows(noun: string): string {
  const samples = [
    { name: `New ${noun} · Acme Co.`, stage: "Triage", owner: "AR", when: "2m ago" },
    { name: `Follow-up · J. Patel`, stage: "Awaiting docs", owner: "MK", when: "1h ago" },
    { name: `Conflict check · Hill Group`, stage: "In review", owner: "AR", when: "3h ago" },
    { name: `Onboarding · Vega LLC`, stage: "Signed", owner: "JS", when: "Yesterday" },
  ];
  return samples
    .map(
      (r) =>
        `<tr><td>${esc(r.name)}</td><td>${esc(r.stage)}</td><td>${esc(r.owner)}</td><td>${esc(r.when)}</td></tr>`,
    )
    .join("");
}

function billingRows(layout: ReturnType<typeof layoutFor>): string {
  const items =
    layout === "case-cockpit"
      ? [
          { ref: "INV-1041", who: "Acme Co.", amt: "$4,200", st: "Sent" },
          { ref: "INV-1040", who: "Hill Group", amt: "$2,180", st: "Paid" },
          { ref: "TIME-22", who: "J. Patel · 6.5h", amt: "$2,275", st: "Draft" },
        ]
      : [
          { ref: "INV-2008", who: "Customer 21", amt: "$890", st: "Sent" },
          { ref: "PAYOUT-12", who: "Seller 4", amt: "$1,200", st: "Pending" },
          { ref: "REFUND-3", who: "Order 91", amt: "-$120", st: "Issued" },
        ];
  return items
    .map(
      (i) =>
        `<li><b>${esc(i.ref)}</b><span>${esc(i.who)}</span><span>${esc(i.amt)}</span><em>${esc(i.st)}</em></li>`,
    )
    .join("");
}

function headline(blueprint: MonsterBlueprint, layout: ReturnType<typeof layoutFor>): string {
  const app = esc(blueprint.appName);
  switch (layout) {
    case "case-cockpit":
      return `${app} — legal operations with a case cockpit, not a brochure.`;
    case "trust-radar":
      return `${app} — verification radar for every profile and risk signal.`;
    case "ledger-room":
      return `${app} — a living ledger room for money, invoices, and proof.`;
    case "market-map":
      return `${app} — marketplace command map for supply, demand, and trust.`;
    default:
      return `${app} — custom product OS generated from the blueprint.`;
  }
}

function primaryCta(layout: ReturnType<typeof layoutFor>): string {
  switch (layout) {
    case "case-cockpit":
      return "Open case cockpit";
    case "trust-radar":
      return "Run verification";
    case "ledger-room":
      return "Open ledger";
    case "market-map":
      return "Map listings";
    default:
      return "Open dashboard";
  }
}

function css(blueprint: MonsterBlueprint, brief?: MonsterDesignBrief): string {
  const layout = layoutFor(blueprint);
  const fallback = paletteFor(layout);
  const p = brief
    ? {
        bg: brief.colorPalette.bg,
        paper: brief.colorPalette.surface,
        ink: brief.colorPalette.ink,
        muted: brief.colorPalette.ink,
        accent: brief.colorPalette.accent,
        accent2: brief.colorPalette.accent2,
      }
    : fallback;
  const display = brief?.typographyPairing.display ?? "Georgia,serif";
  const body = brief?.typographyPairing.body ?? "Inter,ui-sans-serif,system-ui";
  const gap =
    brief?.spacingRhythm === "tight" ? "12px" : brief?.spacingRhythm === "airy" ? "28px" : "18px";
  return `:root{--bg:${p.bg};--paper:${p.paper};--ink:${p.ink};--muted:${p.muted};--accent:${p.accent};--accent2:${p.accent2}}*{box-sizing:border-box}body{margin:0;background:var(--bg);font-family:${body};color:var(--paper)}.shell{min-height:100vh;display:grid;grid-template-columns:210px minmax(320px,1.05fr) minmax(340px,.95fr);grid-template-rows:auto auto;gap:${gap};padding:22px}.left-rail{grid-row:1/3;border:1px solid rgba(255,255,255,.12);border-radius:30px;padding:22px;display:flex;flex-direction:column;gap:28px;background:rgba(255,255,255,.05);position:sticky;top:22px;height:calc(100vh - 44px)}.mark{width:54px;height:54px;border-radius:18px;background:var(--paper);color:var(--ink);display:grid;place-items:center;font-weight:900}.left-rail nav{display:grid;gap:10px}.left-rail a{color:rgba(255,255,255,.72);text-decoration:none;font-size:13px}.proof-dot{margin-top:auto;color:var(--accent2);font-size:11px;text-transform:uppercase;letter-spacing:.16em}.hero-panel{background:var(--paper);color:var(--ink);border-radius:38px;padding:clamp(28px,4vw,70px);min-height:540px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}.hero-panel:after{content:"";position:absolute;inset:auto -12% -24% 42%;height:55%;border-radius:50%;background:radial-gradient(circle,var(--accent2),transparent 65%);opacity:.45}.kicker{font-size:12px;text-transform:uppercase;letter-spacing:.22em;color:var(--accent);font-weight:800}.hero-panel h1{font-family:${display};font-size:clamp(48px,7vw,104px);line-height:.9;letter-spacing:-.07em;max-width:10ch;margin:0;position:relative}.lede{font-size:clamp(17px,2vw,24px);line-height:1.35;max-width:680px;color:var(--muted);position:relative}.actions{display:flex;gap:12px;flex-wrap:wrap;position:relative}.actions button{border:0;border-radius:999px;padding:14px 20px;background:var(--accent);color:white;font-weight:900}.actions .ghost{background:transparent;color:var(--ink);border:1px solid rgba(0,0,0,.18)}.cockpit,.route-map,.workflow-board{border:1px solid rgba(255,255,255,.12);border-radius:32px;padding:28px;background:rgba(255,255,255,.07);backdrop-filter:blur(18px)}.cockpit-head{display:flex;justify-content:space-between;gap:18px;margin-bottom:20px}.cockpit-head span,.route-map h2,.workflow-board h2{text-transform:uppercase;letter-spacing:.16em;font-size:12px;color:var(--accent2)}.data-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.data-card{min-height:138px;border-radius:24px;padding:20px;background:linear-gradient(135deg,rgba(255,255,255,.16),rgba(255,255,255,.06));display:grid;gap:8px}.data-card span{font-size:12px;text-transform:uppercase;letter-spacing:.16em;color:var(--accent2)}.data-card strong{font-size:20px;line-height:1.1}.data-card small{color:rgba(255,255,255,.6)}.route-map ul{list-style:none;padding:0;margin:0;display:grid;gap:12px}.route-map li{padding:14px;border-radius:18px;background:rgba(255,255,255,.06)}.workflow-board{grid-column:2/4;display:grid;grid-template-columns:1fr 1fr;gap:18px}.workflow-board ol{padding-left:20px;color:rgba(255,255,255,.76);line-height:1.7}@media(max-width:1050px){.shell{grid-template-columns:1fr}.left-rail{position:relative;height:auto;grid-row:auto}.workflow-board{grid-column:auto;grid-template-columns:1fr}.hero-panel{min-height:460px}.data-grid{grid-template-columns:1fr}}`;
}

function js(blueprint: MonsterBlueprint, brief?: MonsterDesignBrief): string {
  return `window.__YAWB_MONSTER_PREVIEW__=${JSON.stringify({ generator: "monster-custom-preview-v1", appType: blueprint.appType, designMode: blueprint.design.mode, routes: blueprint.routes.map((r) => r.path), tables: blueprint.backend.tables.map((t) => t.table), brief: brief?.varianceSeed }, null, 2)};`;
}

export function generateMonsterCustomPreviewFiles(
  blueprint: MonsterBlueprint,
  brief?: MonsterDesignBrief,
): GeneratedProjectFile[] {
  return [
    { path: "index.html", content: html(blueprint, brief), language: "html", kind: "source" },
    { path: "styles.css", content: css(blueprint, brief), language: "css", kind: "source" },
    { path: "app.js", content: js(blueprint, brief), language: "javascript", kind: "source" },
  ];
}
