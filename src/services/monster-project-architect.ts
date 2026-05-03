import type { MonsterBlueprint } from "./monster-blueprint";

export interface MonsterArchitectFile {
  path: string;
  content: string;
  language: "tsx" | "ts" | "css" | "sql" | "markdown" | "json";
  kind: "source" | "asset";
  role: "route" | "component" | "lib" | "style" | "backend" | "doc" | "test";
}

export interface MonsterArchitectResult {
  generator: "monster-project-architect-v1";
  files: MonsterArchitectFile[];
  routes: string[];
  components: string[];
  backendArtifacts: string[];
  designCritique: string[];
}

function pascal(value: string): string {
  const clean = value.replace(/[^a-zA-Z0-9]+/g, " ").trim() || "MonsterApp";
  return clean
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "monster-app"
  );
}

function routeFileName(path: string): string {
  if (path === "/") return "index";
  return path.replace(/^\//, "").replace(/\//g, ".") || "index";
}

function routeComponentName(path: string): string {
  if (path === "/") return "HomeRoute";
  return `${pascal(path)}Route`;
}

function primaryNoun(blueprint: MonsterBlueprint): string {
  if (blueprint.appType.includes("legal") || blueprint.appType.includes("professional"))
    return "matter";
  if (blueprint.appType.includes("marketplace")) return "listing";
  if (blueprint.appType.includes("booking")) return "booking";
  if (blueprint.appType.includes("crm")) return "client";
  return "workspace";
}

function routeSource(blueprint: MonsterBlueprint, path: string): string {
  const component = routeComponentName(path);
  const noun = primaryNoun(blueprint);
  const title =
    path === "/" ? blueprint.appName : `${blueprint.appName} ${path.replace(/^\//, "")}`;
  const tone = blueprint.design.mode.replace(/-/g, " ");
  return `import { createFileRoute } from "@tanstack/react-router";
import { ${pascal(noun)}CommandCenter } from "@/components/monster/${pascal(noun)}CommandCenter";
import { MonsterProofRail } from "@/components/monster/MonsterProofRail";
import "@/styles/monster-app.css";

export const Route = createFileRoute("${path}")({
  component: ${component},
});

function ${component}() {
  return (
    <main className="monster-shell" data-yawb-design="${blueprint.design.mode}">
      <section className="monster-hero">
        <p className="monster-kicker">${blueprint.appType} · ${tone}</p>
        <h1>${title}</h1>
        <p className="monster-lede">${blueprint.summary}</p>
        <div className="monster-actions">
          <a href="/dashboard">Open command center</a>
          <a href="/admin" className="secondary">Review controls</a>
        </div>
      </section>
      <${pascal(noun)}CommandCenter appName="${blueprint.appName}" />
      <MonsterProofRail routes={${JSON.stringify(blueprint.routes.map((r) => r.path))}} tables={${JSON.stringify(blueprint.backend.tables.map((t) => t.table))}} />
    </main>
  );
}
`;
}

function commandCenterSource(blueprint: MonsterBlueprint): string {
  const noun = primaryNoun(blueprint);
  const name = `${pascal(noun)}CommandCenter`;
  const workflows = blueprint.workflows.slice(0, 4);
  const tables = blueprint.backend.tables.slice(0, 4);
  return `interface ${name}Props {
  appName: string;
}

const workflows = ${JSON.stringify(workflows, null, 2)};
const tables = ${JSON.stringify(
    tables.map((table) => ({ table: table.table, purpose: table.purpose })),
    null,
    2,
  )};

export function ${name}({ appName }: ${name}Props) {
  return (
    <section className="monster-grid" aria-label={appName + " command center"}>
      <article className="monster-card monster-card-large">
        <span className="monster-label">Live ${noun} operations</span>
        <h2>Custom workflows, not a recolored template.</h2>
        <p>yawB generated this structure from the product blueprint: routes, workflows, backend entities, and proof gates.</p>
        <ul>
          {workflows.map((workflow) => <li key={workflow}>{workflow}</li>)}
        </ul>
      </article>
      <article className="monster-card">
        <span className="monster-label">Data model</span>
        <h2>Backend-aware by default</h2>
        <div className="monster-stack">
          {tables.map((item) => (
            <div key={item.table} className="monster-row">
              <strong>{item.table}</strong>
              <span>{item.purpose}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
`;
}

function proofRailSource(blueprint: MonsterBlueprint): string {
  return `interface MonsterProofRailProps {
  routes: string[];
  tables: string[];
}

export function MonsterProofRail({ routes, tables }: MonsterProofRailProps) {
  return (
    <aside className="monster-proof-rail">
      <div>
        <span>Routes generated</span>
        <strong>{routes.length}</strong>
      </div>
      <div>
        <span>Tables planned</span>
        <strong>{tables.length}</strong>
      </div>
      <div>
        <span>Quality bar</span>
        <strong>${blueprint.qualityBar}</strong>
      </div>
    </aside>
  );
}
`;
}

function supabaseClientSource(): string {
  return `import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase env vars are not configured yet.");
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");
`;
}

function cssSource(blueprint: MonsterBlueprint): string {
  const luxury = blueprint.design.mode === "editorial-luxury";
  return `.monster-shell {
  min-height: 100vh;
  padding: clamp(24px, 4vw, 72px);
  color: ${luxury ? "#231914" : "#edf3ff"};
  background: ${luxury ? "#f7efe1" : "radial-gradient(circle at top left, #1d2b5f, #070a12 55%)"};
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

.monster-hero {
  display: grid;
  gap: 24px;
  max-width: 980px;
  padding: 44px 0 64px;
}

.monster-kicker,
.monster-label {
  text-transform: uppercase;
  letter-spacing: .22em;
  font-size: 12px;
  opacity: .72;
}

.monster-hero h1 {
  font-family: ${luxury ? "Georgia, serif" : "Inter, sans-serif"};
  font-size: clamp(54px, 11vw, 132px);
  line-height: .86;
  letter-spacing: -.07em;
  max-width: 11ch;
  margin: 0;
}

.monster-lede {
  max-width: 680px;
  font-size: clamp(18px, 2vw, 28px);
  line-height: 1.35;
  opacity: .74;
}

.monster-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.monster-actions a {
  border-radius: 999px;
  padding: 14px 20px;
  background: ${luxury ? "#b64a2f" : "#7dd3fc"};
  color: ${luxury ? "#fff7ed" : "#06111c"};
  text-decoration: none;
  font-weight: 800;
}

.monster-actions .secondary {
  background: transparent;
  color: inherit;
  border: 1px solid currentColor;
}

.monster-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr);
  gap: 18px;
}

.monster-card,
.monster-proof-rail {
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 28px;
  padding: clamp(20px, 3vw, 36px);
  background: color-mix(in srgb, white 52%, transparent);
  backdrop-filter: blur(18px);
  box-shadow: 0 24px 80px rgba(0,0,0,.08);
}

.monster-card h2 {
  font-size: clamp(28px, 4vw, 56px);
  letter-spacing: -.04em;
  margin: 12px 0;
}

.monster-card li,
.monster-row {
  margin-top: 12px;
}

.monster-stack {
  display: grid;
  gap: 12px;
}

.monster-row {
  display: grid;
  gap: 4px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(255,255,255,.35);
}

.monster-row span {
  opacity: .68;
  font-size: 13px;
}

.monster-proof-rail {
  margin-top: 18px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.monster-proof-rail div {
  min-width: 180px;
  display: grid;
  gap: 6px;
}

.monster-proof-rail span {
  text-transform: uppercase;
  letter-spacing: .16em;
  font-size: 11px;
  opacity: .58;
}

.monster-proof-rail strong {
  font-size: 28px;
}

@media (max-width: 800px) {
  .monster-grid { grid-template-columns: 1fr; }
}
`;
}

function readmeSource(blueprint: MonsterBlueprint): string {
  return `# ${blueprint.appName} — Monster Project Architecture

This is the project-writing layer generated from Monster Blueprint v1.

## App type

${blueprint.appType}

## Design

- Mode: ${blueprint.design.mode}
- Reason: ${blueprint.design.reason}
- Density: ${blueprint.design.visualDensity}

## Routes

${blueprint.routes.map((route) => `- \`${route.path}\` — ${route.purpose}`).join("\n")}

## Backend tables

${blueprint.backend.tables.map((table) => `- \`${table.table}\` — ${table.purpose}`).join("\n")}

## Monster critique

- Avoided a pure template/color swap by producing route files, components, style system, backend plan, and proof components.
- This is still deterministic v1; the next layer should replace/augment it with model-generated file plans.
`;
}

export function generateMonsterArchitectFiles(blueprint: MonsterBlueprint): MonsterArchitectResult {
  const noun = primaryNoun(blueprint);
  const routeFiles = blueprint.routes.slice(0, 8).map((route) => ({
    path: `src/routes/${routeFileName(route.path)}.tsx`,
    content: routeSource(blueprint, route.path),
    language: "tsx" as const,
    kind: "source" as const,
    role: "route" as const,
  }));

  const files: MonsterArchitectFile[] = [
    ...routeFiles,
    {
      path: `src/components/monster/${pascal(noun)}CommandCenter.tsx`,
      content: commandCenterSource(blueprint),
      language: "tsx",
      kind: "source",
      role: "component",
    },
    {
      path: "src/components/monster/MonsterProofRail.tsx",
      content: proofRailSource(blueprint),
      language: "tsx",
      kind: "source",
      role: "component",
    },
    {
      path: "src/lib/monster-supabase.ts",
      content: supabaseClientSource(),
      language: "ts",
      kind: "source",
      role: "lib",
    },
    {
      path: "src/styles/monster-app.css",
      content: cssSource(blueprint),
      language: "css",
      kind: "source",
      role: "style",
    },
    {
      path: `docs/generated/${slug(blueprint.appName)}_monster_architecture.md`,
      content: readmeSource(blueprint),
      language: "markdown",
      kind: "source",
      role: "doc",
    },
  ];

  return {
    generator: "monster-project-architect-v1",
    files,
    routes: routeFiles.map((file) => file.path),
    components: files.filter((file) => file.role === "component").map((file) => file.path),
    backendArtifacts: blueprint.backend.tables.map((table) => table.table),
    designCritique: [
      "Generated app-specific route files instead of only a static index.html; this is not a recolored template.",
      "Generated reusable components tied to the inferred domain noun.",
      "Generated a backend-aware data model surface from the blueprint.",
      "Still deterministic v1: next step is model-authored file plans and repair loops.",
    ],
  };
}
