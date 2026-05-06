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

function lawAppShellHtml(blueprint: MonsterBlueprint, brief?: MonsterDesignBrief): string {
  const app = esc(blueprint.appName || "LexOS");
  const category = esc(brief?.productCategory ?? "professional services");
  const accent = esc(brief?.colorPalette.accent ?? "#34d399");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="yawb-generator" content="monster-custom-preview-v1" />
  <meta name="yawb-design-mode" content="glass-dashboard" />
  <meta name="yawb-app-type" content="professional-services" />
  <meta name="yawb-layout" content="case-cockpit" />
  <meta name="yawb-category" content="${category}" />
  <meta name="yawb-accent" content="${accent}" />
  <title>${app} · LexOS</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body data-layout="case-cockpit" data-app-shell="legal-saas">
  <div class="app-shell" data-app-surface="dashboard">
    <aside class="sidebar" aria-label="Primary navigation">
      <div class="brand"><span class="brand-mark">LX</span><strong>LexOS</strong></div>
      <nav>
        <a href="#dashboard" class="active">Dashboard</a>
        <a href="#intake">Intake</a>
        <a href="#matters">Matters</a>
        <a href="#documents">Documents</a>
        <a href="#billing">Billing</a>
        <a href="#admin">Admin</a>
      </nav>
      <div class="rls-mini"><span>Supabase</span><b>RLS enforced</b></div>
    </aside>
    <main class="workspace" id="dashboard">
      <header class="topbar">
        <div><p>Case cockpit</p><h1>Matter board command center</h1></div>
        <label class="search"><span>Search</span><input aria-label="Search matters" value="Acme discovery" /></label>
        <button type="button">New matter</button>
        <div class="user">AR</div>
      </header>
      <section class="kpis" aria-label="KPI cards">
        <div><span>Active matters</span><strong>48</strong><em>+6 this week</em></div>
        <div><span>Client intake</span><strong>17</strong><em>5 urgent reviews</em></div>
        <div><span>Outstanding invoices</span><strong>$82.4k</strong><em>Payments tracked</em></div>
        <div><span>RLS policies</span><strong>24</strong><em>Supabase locked</em></div>
      </section>
      <section class="matter-board workflow-board" id="matters" aria-label="Case cockpit matter board">
        <div class="section-head"><div><p>Case cockpit</p><h2>Matter board</h2></div><span>Live workflow</span></div>
        <div class="board-grid" role="grid">
          <div><h3>New</h3><div class="matter-card"><b>Acme employment claim</b><span>Client intake complete</span><i>Owner Mina</i></div><div class="matter-card"><b>Vega contract review</b><span>Conflict check</span><i>Owner Amir</i></div></div>
          <div><h3>In review</h3><div class="matter-card violet"><b>Patel data request</b><span>Documents pending</span><i>Owner Sara</i></div></div>
          <div><h3>Discovery</h3><div class="matter-card amber"><b>Hill Group dispute</b><span>Evidence timeline</span><i>Owner Jonas</i></div></div>
          <div><h3>Billing</h3><div class="matter-card emerald"><b>Northstar closing</b><span>Invoices ready</span><i>Payments due Friday</i></div></div>
        </div>
      </section>
      <section class="lower-grid">
        <section class="panel intake" id="intake">
          <div class="section-head"><div><p>Client intake</p><h2>Queue</h2></div><span>7 new</span></div>
          <table role="grid"><thead><tr><th>Client</th><th>Status</th><th>Owner</th></tr></thead><tbody><tr><td>Acme Co.</td><td><span class="pill emerald">Qualified</span></td><td>Mina</td></tr><tr><td>J. Patel</td><td><span class="pill amber">Docs needed</span></td><td>Sara</td></tr><tr><td>Vega LLC</td><td><span class="pill violet">Conflict check</span></td><td>Amir</td></tr></tbody></table>
        </section>
        <section class="panel billing" id="billing">
          <div class="section-head"><div><p>Invoices &amp; Payments</p><h2>Billing status</h2></div><span>$82.4k</span></div>
          <ul><li><b>INV-1048</b><span>Acme Co.</span><em>Sent</em></li><li><b>INV-1044</b><span>Hill Group</span><em>Paid</em></li><li><b>TIME-330</b><span>Northstar</span><em>Draft</em></li></ul>
        </section>
        <section class="panel admin" id="admin">
          <div class="section-head"><div><p>Admin</p><h2>Roles &amp; access</h2></div><span>3 roles</span></div>
          <div class="role-stack"><div><b>Partner</b><span>All matters, billing, users</span></div><div><b>Associate</b><span>Assigned matters and documents</span></div><div><b>Client</b><span>Portal-only document access</span></div></div>
        </section>
        <section class="panel schema">
          <div class="section-head"><div><p>Supabase</p><h2>Schema / RLS</h2></div><span>Protected</span></div>
          <code>matters · client_intakes · invoices · payments · user_roles</code>
          <p>RLS policies isolate firm workspaces and admin role access.</p>
        </section>
      </section>
    </main>
  </div>
  <script src="app.js"></script>
</body>
</html>`;
}

function html(blueprint: MonsterBlueprint, brief?: MonsterDesignBrief): string {
  const layout = layoutFor(blueprint);
  if (layout === "case-cockpit") return lawAppShellHtml(blueprint, brief);
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

  const cockpitTitle = `${esc(s.noun)} cockpit · workflow board`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="yawb-generator" content="monster-custom-preview-v1" />
  <meta name="yawb-design-mode" content="${esc(blueprint.design.mode)}" />
  <meta name="yawb-app-type" content="${esc(blueprint.appType)}" />
  <meta name="yawb-layout" content="${layout}" />
  <meta name="yawb-category" content="${category}" />
  <meta name="yawb-nav-pattern" content="${navPattern}" />
  <meta name="yawb-card-style" content="${cardStyle}" />
  <meta name="yawb-spacing" content="${spacing}" />
  <title>${app}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
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

    <section class="cockpit" id="cockpit" data-app-surface="cockpit">
      <div class="cockpit-head">
        <span>${cockpitTitle}</span>
        <b>${blueprint.backend.tables.length} tables · ${blueprint.routes.length} routes</b>
      </div>
      <div class="data-grid">${tableCards}</div>
    </section>

    <section class="hero-panel hero-compact">
      <div class="hero-text">
        <p class="kicker">${category} · for ${targetUser}</p>
        <h1>${headline(blueprint, layout)}</h1>
        <p class="lede">${heroLine || prompt}</p>
      </div>
      <div class="actions"><button>${primaryCta(layout)}</button><button class="ghost">View workflow</button></div>
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

function lawAppShellCss(): string {
  return `:root{--bg:#08111f;--panel:rgba(15,23,42,.72);--panel-strong:rgba(15,23,42,.92);--line:rgba(148,163,184,.18);--text:#e5eefc;--muted:#94a3b8;--emerald:#34d399;--amber:#fbbf24;--violet:#a78bfa;--cyan:#67e8f9}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 12% 0%,rgba(52,211,153,.14),transparent 32%),radial-gradient(circle at 88% 12%,rgba(167,139,250,.16),transparent 34%),linear-gradient(135deg,#08111f,#0f172a 52%,#111827);color:var(--text);font-family:Manrope,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.app-shell{min-height:100vh;display:grid;grid-template-columns:232px minmax(0,1fr);gap:18px;padding:18px}.sidebar{border:1px solid var(--line);border-radius:24px;background:rgba(2,6,23,.52);backdrop-filter:blur(22px);padding:18px;display:flex;flex-direction:column;gap:22px}.brand{display:flex;align-items:center;gap:10px}.brand-mark,.user{display:grid;place-items:center;border-radius:16px;background:linear-gradient(135deg,var(--emerald),var(--cyan));color:#062019;font-weight:900}.brand-mark{width:42px;height:42px}.user{width:38px;height:38px}.sidebar nav{display:grid;gap:8px}.sidebar a{color:var(--muted);text-decoration:none;padding:10px 12px;border-radius:14px;font-size:14px}.sidebar a.active,.sidebar a:hover{background:rgba(148,163,184,.12);color:var(--text)}.rls-mini{margin-top:auto;border:1px solid rgba(52,211,153,.28);border-radius:18px;padding:14px;background:rgba(52,211,153,.08);display:grid;gap:4px}.rls-mini span,.topbar p,.section-head p,.kpis span{margin:0;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.12em}.rls-mini b{color:var(--emerald);font-size:14px}.workspace{min-width:0;display:grid;gap:16px}.topbar,.kpis>div,.matter-board,.panel{border:1px solid var(--line);background:var(--panel);box-shadow:0 24px 80px rgba(0,0,0,.28);backdrop-filter:blur(18px)}.topbar{min-height:76px;border-radius:24px;padding:14px 16px;display:grid;grid-template-columns:minmax(220px,1fr) minmax(180px,330px) auto auto;gap:12px;align-items:center}.topbar h1,.section-head h2{margin:2px 0 0;font-size:22px;line-height:1.1;letter-spacing:0}.search{height:42px;border:1px solid var(--line);border-radius:14px;padding:6px 10px;display:flex;align-items:center;gap:8px;background:rgba(15,23,42,.68)}.search span{color:var(--muted);font-size:12px}.search input{min-width:0;width:100%;border:0;outline:0;background:transparent;color:var(--text);font:inherit}.topbar button{height:42px;border:0;border-radius:14px;background:var(--emerald);color:#062019;font-weight:900;padding:0 16px}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.kpis>div{border-radius:20px;padding:16px;display:grid;gap:6px}.kpis strong{font-size:28px;line-height:1}.kpis em,.matter-card i,.panel em{color:var(--muted);font-style:normal;font-size:12px}.matter-board{border-radius:26px;padding:16px}.section-head{display:flex;justify-content:space-between;gap:12px;align-items:start;margin-bottom:14px}.section-head>span{border:1px solid var(--line);border-radius:999px;padding:6px 10px;color:var(--emerald);font-size:12px;background:rgba(52,211,153,.08)}.board-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.board-grid>div{min-height:190px;border:1px solid var(--line);border-radius:20px;background:rgba(2,6,23,.34);padding:12px}.board-grid h3{margin:0 0 10px;font-size:13px;color:var(--muted)}.matter-card{border:1px solid rgba(52,211,153,.22);border-radius:16px;padding:12px;margin-bottom:10px;background:rgba(52,211,153,.08);display:grid;gap:6px}.matter-card.violet{border-color:rgba(167,139,250,.28);background:rgba(167,139,250,.1)}.matter-card.amber{border-color:rgba(251,191,36,.3);background:rgba(251,191,36,.1)}.matter-card.emerald{border-color:rgba(52,211,153,.35);background:rgba(52,211,153,.12)}.matter-card span{color:#cbd5e1;font-size:13px}.lower-grid{display:grid;grid-template-columns:1.2fr .9fr;gap:12px}.panel{border-radius:24px;padding:16px;min-width:0}.panel table{width:100%;border-collapse:collapse}.panel th,.panel td{padding:10px 8px;text-align:left;border-bottom:1px solid var(--line);font-size:13px}.panel th{color:var(--muted);font-weight:700}.pill{display:inline-flex;border-radius:999px;padding:4px 8px;font-size:12px}.pill.emerald{background:rgba(52,211,153,.12);color:var(--emerald)}.pill.amber{background:rgba(251,191,36,.13);color:var(--amber)}.pill.violet{background:rgba(167,139,250,.13);color:var(--violet)}.billing ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}.billing li,.role-stack>div{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:14px;padding:10px;background:rgba(2,6,23,.28);font-size:13px}.role-stack{display:grid;gap:8px}.role-stack>div{grid-template-columns:110px 1fr}.schema code{display:block;border:1px solid rgba(103,232,249,.24);border-radius:16px;padding:14px;background:rgba(103,232,249,.08);color:#bae6fd;white-space:normal}.schema p{color:var(--muted);line-height:1.5}@media(max-width:980px){.app-shell{grid-template-columns:1fr}.sidebar{position:relative}.sidebar nav{grid-template-columns:repeat(3,minmax(0,1fr))}.topbar{grid-template-columns:1fr auto}.search{grid-column:1/-1}.kpis,.board-grid,.lower-grid{grid-template-columns:1fr 1fr}}@media(max-width:680px){.app-shell{padding:10px}.sidebar nav,.kpis,.board-grid,.lower-grid{grid-template-columns:1fr}.topbar{grid-template-columns:1fr}.topbar button{width:100%}}`;
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
  if (layout === "case-cockpit") return lawAppShellCss();
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
  return `:root{--bg:${p.bg};--paper:${p.paper};--ink:${p.ink};--muted:${p.muted};--accent:${p.accent};--accent2:${p.accent2}}*{box-sizing:border-box}body{margin:0;background:var(--bg);font-family:${body};color:var(--paper)}.shell{min-height:100vh;display:grid;grid-template-columns:210px minmax(320px,1.05fr) minmax(340px,.95fr);grid-template-rows:auto auto;gap:${gap};padding:22px}.left-rail{grid-row:1/3;border:1px solid rgba(255,255,255,.12);border-radius:30px;padding:22px;display:flex;flex-direction:column;gap:28px;background:rgba(255,255,255,.05);position:sticky;top:22px;height:calc(100vh - 44px)}.mark{width:54px;height:54px;border-radius:18px;background:var(--paper);color:var(--ink);display:grid;place-items:center;font-weight:900}.left-rail nav{display:grid;gap:10px}.left-rail a{color:rgba(255,255,255,.72);text-decoration:none;font-size:13px}.proof-dot{margin-top:auto;color:var(--accent2);font-size:11px;text-transform:uppercase;letter-spacing:.16em}.hero-panel{background:var(--paper);color:var(--ink);border-radius:24px;padding:18px 22px;display:flex;flex-direction:row;justify-content:space-between;align-items:center;gap:18px;position:relative;overflow:hidden;order:2}.hero-panel.hero-compact h1{font-family:${display};font-size:clamp(18px,2.2vw,26px);line-height:1.15;letter-spacing:-.02em;margin:6px 0 4px}.hero-panel.hero-compact .lede{font-size:13px;line-height:1.4;max-width:560px;color:var(--muted)}.hero-panel.hero-compact .kicker{font-size:10px;letter-spacing:.18em}.kicker{font-size:12px;text-transform:uppercase;letter-spacing:.22em;color:var(--accent);font-weight:800}.lede{font-size:14px;line-height:1.4;color:var(--muted)}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions button{border:0;border-radius:999px;padding:8px 14px;background:var(--accent);color:white;font-weight:700;font-size:12px}.actions .ghost{background:transparent;color:var(--ink);border:1px solid rgba(0,0,0,.18)}.cockpit{order:1}.cockpit,.route-map,.workflow-board,.intake-queue,.billing-panel,.admin-panel,.data-model{border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:22px;background:rgba(255,255,255,.07);backdrop-filter:blur(18px)}.cockpit-head{display:flex;justify-content:space-between;gap:18px;margin-bottom:16px}.cockpit-head span,.route-map h2,.workflow-board h2{text-transform:uppercase;letter-spacing:.16em;font-size:12px;color:var(--accent2)}.data-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.data-card{min-height:110px;border-radius:18px;padding:16px;background:linear-gradient(135deg,rgba(255,255,255,.16),rgba(255,255,255,.06));display:grid;gap:6px}.data-card span{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:var(--accent2)}.data-card strong{font-size:16px;line-height:1.15}.data-card small{color:rgba(255,255,255,.6)}.queue-table{width:100%;border-collapse:collapse;font-size:13px}.queue-table th,.queue-table td{padding:8px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08)}.intake-form{display:flex;gap:8px;margin-top:10px}.intake-form input{flex:1;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);color:inherit}.billing-list,.role-list,.schema-list{list-style:none;padding:0;margin:0;display:grid;gap:8px;font-size:13px}.billing-list li,.role-list li,.schema-list li{display:flex;gap:10px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.05);align-items:center;justify-content:space-between}.route-map ul{list-style:none;padding:0;margin:0;display:grid;gap:12px}.route-map li{padding:14px;border-radius:18px;background:rgba(255,255,255,.06)}.workflow-board{grid-column:2/4;display:grid;grid-template-columns:1fr 1fr;gap:18px}.workflow-board ol{padding-left:20px;color:rgba(255,255,255,.76);line-height:1.7}@media(max-width:1050px){.shell{grid-template-columns:1fr}.left-rail{position:relative;height:auto;grid-row:auto}.workflow-board{grid-column:auto;grid-template-columns:1fr}.data-grid{grid-template-columns:1fr}.hero-panel{flex-direction:column;align-items:flex-start}}`;
}

function js(blueprint: MonsterBlueprint, brief?: MonsterDesignBrief): string {
  return `window.__YAWB_MONSTER_PREVIEW__=${JSON.stringify({ generator: "monster-custom-preview-v1", appType: blueprint.appType, designMode: blueprint.design.mode, routes: blueprint.routes.map((r) => r.path), tables: blueprint.backend.tables.map((t) => t.table), brief: brief?.varianceSeed }, null, 2)};
(function(){var b=document.body;var t=document.querySelector('[data-nav-toggle]');if(window.matchMedia&&window.matchMedia('(max-width:1050px)').matches){b.setAttribute('data-nav-open','false');}if(t){t.addEventListener('click',function(){var open=b.getAttribute('data-nav-open')==='true';b.setAttribute('data-nav-open',open?'false':'true');});}})();`;
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
