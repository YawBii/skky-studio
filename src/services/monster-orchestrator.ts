import type { Project } from "@/services/projects";
import type { DesignMode } from "./monster-brain-generator";
import { createMonsterBlueprint } from "./monster-director";
import {
  generateMonsterBackendFiles,
  type MonsterBackendGenerationResult,
} from "./monster-backend-generator";
import {
  createMonsterProofReport,
  type MonsterProofReport,
  type MonsterQualityGate,
} from "./monster-quality-gates";
import {
  generateMonsterArchitectFiles,
  type MonsterArchitectResult,
} from "./monster-project-architect";
import { generateMonsterCustomPreviewFiles } from "./monster-custom-preview-generator";
import { summarizeMonsterBlueprint, type MonsterBlueprint } from "./monster-blueprint";
import {
  generateMonsterDesignBrief,
  summarizeDesignBrief,
  type MonsterDesignBrief,
} from "./monster-design-brief";
import {
  evaluateVisualQuality,
  critiqueGeneratedDesign,
  type VisualQualityReport,
  type DesignSelfCritique,
} from "./monster-visual-quality";
import { buildLawFirmHomepage } from "@/lib/agent-controller/homepage-builder";
import { findForbiddenDashboardTokens } from "@/lib/agent-controller/forbidden-dashboard-tokens";

export interface MonsterOrchestratorInput {
  project: Pick<Project, "id" | "name"> & { description?: string | null };
  chatRequest?: string | null;
  connectedProviders?: string[] | null;
  requestedDesignMode?: DesignMode | null;
  previousIndexHtml?: string | null;
  regenerationSeed?: string | null;
  forceVariant?: boolean;
  production?: boolean;
}

export interface MonsterGeneratedFile {
  path: string;
  content: string;
  language: string;
  kind: "source" | "asset";
}

export interface MonsterGenerationResult {
  generator: "monster-orchestrator-v1";
  blueprint: MonsterBlueprint;
  designBrief: MonsterDesignBrief;
  frontendFiles: MonsterGeneratedFile[];
  backend: MonsterBackendGenerationResult;
  architect: MonsterArchitectResult;
  files: MonsterGeneratedFile[];
  visualQuality: VisualQualityReport;
  critique: DesignSelfCritique;
  repairAttempts: number;
  proof: MonsterProofReport;
  output: {
    blueprintSummary: string;
    designBriefSummary: string;
    designMode: string;
    appType: string;
    previewGenerator: string;
    generator: "monster-orchestrator-v1";
    frontendFileCount: number;
    backendFileCount: number;
    architectFileCount: number;
    fileCount: number;
    tableCount: number;
    policyCount: number;
    previewReady: boolean;
    canDeclareDone: boolean;
    written: string[];
    filesTouched: string[];
    changedFiles: string[];
    fileList: string[];
    previewProof: {
      generator: string;
      expectedMeta: string;
      indexPath: "index.html";
    };
    designCritique: string[];
    visualVerdict: DesignSelfCritique["verdict"];
    visualPassed: boolean;
    repairAttempts: number;
  };
}

function passed(id: string, label: string, proof: string): MonsterQualityGate {
  return { id, label, required: true, status: "passed", proof };
}

function failed(id: string, label: string, error: string): MonsterQualityGate {
  return { id, label, required: true, status: "failed", error };
}

function pending(id: string, label: string, command?: string, required = true): MonsterQualityGate {
  return { id, label, command, required, status: "pending" };
}

const MAX_REPAIRS = 1;

function combinedPrompt(input: MonsterOrchestratorInput, blueprint: MonsterBlueprint): string {
  return `${input.chatRequest ?? ""} ${blueprint.prompt ?? ""} ${blueprint.summary ?? ""} ${blueprint.appType ?? ""} ${input.project.name ?? ""} ${input.project.description ?? ""}`.toLowerCase();
}

function shouldUseLawFirmFallback(input: MonsterOrchestratorInput, blueprint: MonsterBlueprint): boolean {
  const text = combinedPrompt(input, blueprint);
  return /\b(law firm|legal|attorney|lawyer|counsel|practice areas?)\b/.test(text);
}

function isFintechTransferApp(input: MonsterOrchestratorInput, blueprint: MonsterBlueprint): boolean {
  const text = combinedPrompt(input, blueprint);
  return /\b(send money|money transfer|mobile money|bank transfer|remittance|payout|wallet|fintech|iban|recipient|kyc)\b/.test(text);
}

function collectForbiddenFrontendTokens(files: MonsterGeneratedFile[]): string[] {
  const joined = files
    .filter(
      (file) => file.path === "index.html" || file.path === "styles.css" || file.path === "app.js",
    )
    .map((file) => file.content)
    .join("\n");
  return findForbiddenDashboardTokens(joined);
}

function cleanLawFirmFrontend(input: MonsterOrchestratorInput): MonsterGeneratedFile[] {
  const built = buildLawFirmHomepage({
    project: {
      id: input.project.id,
      name: input.project.name,
      description: input.project.description ?? null,
    },
    domain: "law-firm",
  });
  return [
    { path: "index.html", content: built.indexHtml, language: "html", kind: "source" },
    { path: "styles.css", content: built.stylesCss, language: "css", kind: "source" },
    {
      path: "app.js",
      content:
        "document.documentElement.dataset.yawbPreview='clean-law-firm-fallback';\nconsole.info('[yawb] clean law firm fallback active');\n",
      language: "javascript",
      kind: "source",
    },
  ];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function cleanFintechTransferFrontend(input: MonsterOrchestratorInput): MonsterGeneratedFile[] {
  const appName = escapeHtml(input.project.name || "Mo-Send");
  const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="yawb-generator" content="direct-build-controller-v1" />
  <title>${appName} — Send money fast</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="app-shell">
    <nav class="topbar" aria-label="Main navigation">
      <div class="brand"><img src="/branding/skky-default-favicon.svg" alt="" /><span>${appName}</span></div>
      <div class="nav-links"><a href="#send">Send</a><a href="#recipients">Recipients</a><a href="#activity">Activity</a></div>
      <button class="secondary">Sign in</button>
    </nav>

    <section class="hero">
      <div>
        <p class="eyebrow">Global transfers</p>
        <h1>Send money to mobile phones and bank accounts in minutes.</h1>
        <p class="lede">A secure transfer workspace for mobile money, bank payouts, recipient verification, and transparent delivery tracking.</p>
        <div class="actions"><a class="primary" href="#send">Start a transfer</a><a class="ghost" href="#activity">View activity</a></div>
      </div>
      <aside class="transfer-card" id="send" aria-label="Send money form preview">
        <div class="card-head"><span>New transfer</span><strong>$250.00</strong></div>
        <label>Recipient phone or IBAN<input value="+233 24 000 0000" aria-label="Recipient" /></label>
        <label>Destination<select aria-label="Destination"><option>Mobile money wallet</option><option>Bank transfer</option></select></label>
        <label>Amount<input value="250.00" aria-label="Amount" /></label>
        <div class="quote"><span>Fee</span><strong>$3.20</strong></div>
        <div class="quote"><span>Arrives</span><strong>~ 10 minutes</strong></div>
        <button class="primary full">Review transfer</button>
      </aside>
    </section>

    <section class="benefits" aria-label="Benefits">
      <article><strong>Verified recipients</strong><p>Confirm phone, wallet, or bank details before payout.</p></article>
      <article><strong>Live status</strong><p>Track pending, processing, completed, and failed transfers.</p></article>
      <article><strong>Compliance-ready</strong><p>KYC, limits, audit logs, and risk checks built into the flow.</p></article>
    </section>

    <section class="surface">
      <div class="panel" id="recipients">
        <div class="panel-title"><span>Saved recipients</span><button>Add recipient</button></div>
        <div class="recipient"><span>Akua Mensah</span><em>MTN Mobile Money · Ghana</em><strong>Ready</strong></div>
        <div class="recipient"><span>Nordic Supplies AB</span><em>SEPA bank transfer · Sweden</em><strong>Verified</strong></div>
        <div class="recipient"><span>Kwame Boateng</span><em>Vodafone Cash · Ghana</em><strong>Review</strong></div>
      </div>
      <div class="panel" id="activity">
        <div class="panel-title"><span>Transfer activity</span><button>Export</button></div>
        <div class="timeline"><b>Completed</b><span>$120 to Akua · Mobile money</span></div>
        <div class="timeline"><b>Processing</b><span>$480 to Nordic Supplies · Bank transfer</span></div>
        <div class="timeline"><b>Needs review</b><span>$1,200 to new recipient · KYC limit</span></div>
      </div>
    </section>

    <footer>Prototype only — connect licensed payout, KYC, sanctions screening, and ledger providers before real-money use.</footer>
  </main>
  <script src="app.js"></script>
</body>
</html>`;

  const stylesCss = `:root{--bg:#08131f;--panel:#101c2b;--panel2:#132439;--text:#f7fbff;--muted:#9fb1c7;--line:rgba(255,255,255,.12);--brand:#36d399;--brand2:#5bbcff;--warn:#f6b44b;--radius:24px}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0%,#163b4b,transparent 35%),linear-gradient(135deg,#07111c,#0b1624 55%,#10182f);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.app-shell{min-height:100vh;padding:24px;max-width:1240px;margin:0 auto}.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 16px;border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.05);backdrop-filter:blur(20px)}.brand{display:flex;align-items:center;gap:12px;font-weight:900}.brand img{width:38px;height:38px}.nav-links{display:flex;gap:18px;color:var(--muted)}a{color:inherit;text-decoration:none}button,.primary,.ghost,.secondary{border:0;border-radius:999px;padding:12px 18px;font-weight:800;cursor:pointer}.primary{display:inline-flex;background:linear-gradient(135deg,var(--brand),var(--brand2));color:#06111c}.ghost,.secondary{background:rgba(255,255,255,.08);color:var(--text);border:1px solid var(--line)}.hero{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:40px;align-items:center;padding:70px 10px}.eyebrow{color:var(--brand);letter-spacing:.24em;text-transform:uppercase;font-size:12px;font-weight:900}h1{font-size:clamp(44px,7vw,82px);line-height:.93;margin:12px 0 20px;letter-spacing:-.06em}.lede{font-size:20px;color:var(--muted);max-width:660px;line-height:1.6}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.transfer-card,.panel,.benefits article{border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.045));box-shadow:0 24px 80px rgba(0,0,0,.28);border-radius:var(--radius)}.transfer-card{padding:24px;display:grid;gap:14px}.card-head{display:flex;justify-content:space-between;align-items:center}.card-head strong{font-size:32px}label{display:grid;gap:8px;color:var(--muted);font-size:13px;font-weight:800}input,select{width:100%;border:1px solid var(--line);background:#07111c;color:var(--text);border-radius:14px;padding:14px;font:inherit}.quote{display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:12px;color:var(--muted)}.full{justify-content:center}.benefits{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.benefits article{padding:22px}.benefits strong{font-size:20px}.benefits p{color:var(--muted);line-height:1.55}.surface{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}.panel{padding:22px}.panel-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-weight:900}.panel-title button{padding:8px 12px;background:rgba(54,211,153,.12);color:var(--brand)}.recipient,.timeline{display:grid;grid-template-columns:1fr auto;gap:6px;padding:14px;border-top:1px solid var(--line)}.recipient em,.timeline span{grid-column:1/-1;color:var(--muted);font-style:normal}.recipient strong,.timeline b{color:var(--brand)}footer{color:var(--muted);text-align:center;padding:36px 0 12px}@media(max-width:880px){.hero,.surface{grid-template-columns:1fr}.nav-links{display:none}.benefits{grid-template-columns:1fr}h1{font-size:46px}.app-shell{padding:14px}}`;

  const appJs = `document.documentElement.dataset.yawbPreview='fintech-transfer-app';
console.info('[yawb] fintech transfer preview active');
`;

  return [
    { path: "index.html", content: indexHtml, language: "html", kind: "source" },
    { path: "styles.css", content: stylesCss, language: "css", kind: "source" },
    { path: "app.js", content: appJs, language: "javascript", kind: "source" },
  ];
}

function cleanGenericAppFrontend(input: MonsterOrchestratorInput): MonsterGeneratedFile[] {
  const appName = escapeHtml(input.project.name || "yawB App");
  const indexHtml = `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><meta name="yawb-generator" content="direct-build-controller-v1"/><title>${appName}</title><link rel="stylesheet" href="styles.css"/></head><body><main class="shell"><nav><strong>${appName}</strong><a href="#preview">Preview</a><a href="#features">Features</a><button>Get started</button></nav><section class="hero"><p class="eyebrow">Built by yawB</p><h1>A focused product preview generated from your prompt.</h1><p>Use this starter surface to validate layout, flows, and content before connecting production services.</p><div><button>Start workflow</button><button class="ghost">View details</button></div></section><section id="features" class="grid"><article><strong>Primary workflow</strong><span>Clear first action for users.</span></article><article><strong>Data surface</strong><span>Useful cards and status areas.</span></article><article><strong>Ready to extend</strong><span>Connect auth, database, and APIs next.</span></article></section><section id="preview" class="panel"><h2>Product surface</h2><p>Generated app preview is ready for iteration.</p></section></main><script src="app.js"></script></body></html>`;
  const stylesCss = `body{margin:0;background:#0b1020;color:#f8fbff;font-family:Inter,system-ui,sans-serif}.shell{max-width:1120px;margin:auto;padding:24px}nav{display:flex;align-items:center;justify-content:space-between;gap:16px}a{color:#aebbd0;text-decoration:none}button{border:0;border-radius:999px;padding:12px 18px;background:#7dd3fc;color:#06111f;font-weight:800}.ghost{background:transparent;color:#f8fbff;border:1px solid rgba(255,255,255,.2)}.hero{padding:90px 0}.eyebrow{color:#7dd3fc;text-transform:uppercase;letter-spacing:.2em;font-size:12px}h1{font-size:clamp(44px,7vw,78px);line-height:.95;max-width:820px}.hero p{color:#aebbd0;font-size:20px;max-width:640px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.grid article,.panel{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);border-radius:24px;padding:24px}.grid span,.panel p{color:#aebbd0;display:block;margin-top:8px}@media(max-width:760px){.grid{grid-template-columns:1fr}nav{flex-wrap:wrap}}`;
  const appJs = "document.documentElement.dataset.yawbPreview='generic-app-fallback';\n";
  return [
    { path: "index.html", content: indexHtml, language: "html", kind: "source" },
    { path: "styles.css", content: stylesCss, language: "css", kind: "source" },
    { path: "app.js", content: appJs, language: "javascript", kind: "source" },
  ];
}

function cleanFallbackFrontend(
  input: MonsterOrchestratorInput,
  blueprint: MonsterBlueprint,
): { files: MonsterGeneratedFile[]; fallbackName: string } {
  if (shouldUseLawFirmFallback(input, blueprint)) {
    return { files: cleanLawFirmFrontend(input), fallbackName: "law-firm-homepage" };
  }
  if (isFintechTransferApp(input, blueprint)) {
    return { files: cleanFintechTransferFrontend(input), fallbackName: "fintech-transfer-app" };
  }
  return { files: cleanGenericAppFrontend(input), fallbackName: "generic-app" };
}

function sanitizeFrontendFiles(
  input: MonsterOrchestratorInput,
  blueprint: MonsterBlueprint,
  files: MonsterGeneratedFile[],
): { files: MonsterGeneratedFile[]; replaced: boolean; forbiddenTokens: string[]; fallbackName: string } {
  const forbiddenTokens = collectForbiddenFrontendTokens(files);
  if (forbiddenTokens.length > 0) {
    const fallback = cleanFallbackFrontend(input, blueprint);
    return {
      files: fallback.files,
      replaced: true,
      forbiddenTokens,
      fallbackName: fallback.fallbackName,
    };
  }
  return { files, replaced: false, forbiddenTokens, fallbackName: "none" };
}

export function generateMonsterProject(input: MonsterOrchestratorInput): MonsterGenerationResult {
  const blueprint = createMonsterBlueprint({
    project: input.project,
    chatRequest: input.chatRequest,
    connectedProviders: input.connectedProviders,
    requestedDesignMode: input.requestedDesignMode,
    production: input.production,
  });

  let brief = generateMonsterDesignBrief(blueprint, input.regenerationSeed ?? "");
  let frontendFiles = generateMonsterCustomPreviewFiles(blueprint, brief);
  let dashboardBleed = sanitizeFrontendFiles(input, blueprint, frontendFiles);
  frontendFiles = dashboardBleed.files;
  const backend = generateMonsterBackendFiles(blueprint);
  const architect = generateMonsterArchitectFiles(blueprint);

  const buildAll = () =>
    [...frontendFiles, ...backend.files, ...architect.files] as MonsterGeneratedFile[];
  let files = buildAll();
  let visual = evaluateVisualQuality({
    files,
    brief,
    previousIndexHtml: input.previousIndexHtml ?? null,
  });

  let repairAttempts = 0;
  while (!visual.passed && repairAttempts < MAX_REPAIRS) {
    repairAttempts += 1;
    brief = generateMonsterDesignBrief(
      blueprint,
      `${input.regenerationSeed ?? ""}|repair-${repairAttempts}-${Date.now()}`,
    );
    frontendFiles = generateMonsterCustomPreviewFiles(blueprint, brief);
    dashboardBleed = sanitizeFrontendFiles(input, blueprint, frontendFiles);
    frontendFiles = dashboardBleed.files;
    files = buildAll();
    visual = evaluateVisualQuality({
      files,
      brief,
      previousIndexHtml: input.previousIndexHtml ?? null,
    });
  }

  const critique = critiqueGeneratedDesign({ brief, visual });
  const written = files.map((file) => file.path).sort();
  const previewReady = files.some((file) => file.path === "index.html");
  const blueprintSummary = summarizeMonsterBlueprint(blueprint);
  const designBriefSummary = summarizeDesignBrief(brief);
  const designCritique = [
    "Design brief generated before files (category, user, palette, typography, nav, cards).",
    `Brief: ${designBriefSummary}`,
    ...(dashboardBleed.replaced
      ? [
          `Dashboard bleed rejected: ${dashboardBleed.forbiddenTokens.length ? dashboardBleed.forbiddenTokens.join(", ") : "app request requires clean product surface"}.`,
          `Fallback: ${dashboardBleed.fallbackName} preview written to index.html/styles.css/app.js.`,
        ]
      : []),
    ...critique.beautiful.map((line) => `Beautiful: ${line}`),
    ...critique.appSpecific.map((line) => `App-specific: ${line}`),
    ...critique.improvements.map((line) => `Improve: ${line}`),
    `Verdict: ${critique.verdict} (visualPassed=${critique.passedVisualQuality}, repairs=${repairAttempts})`,
    ...architect.designCritique,
  ];

  const visualGate: MonsterQualityGate = visual.passed
    ? passed(
        "visual-quality",
        "Visual quality gate",
        `${visual.checks.filter((c) => c.passed).length}/${visual.checks.length} checks passed`,
      )
    : failed(
        "visual-quality",
        "Visual quality gate",
        visual.checks
          .filter((c) => !c.passed)
          .map((c) => `${c.label}: ${c.detail}`)
          .join("; "),
      );

  const proof = createMonsterProofReport({
    projectId: input.project.id,
    blueprintSummary,
    gates: [
      passed("blueprint", "Monster Blueprint produced", blueprintSummary),
      passed("design-brief", "Design brief produced", designBriefSummary),
      passed(
        "design",
        "Custom blueprint-driven preview generated",
        dashboardBleed.replaced
          ? `Dashboard/app shell output rejected and replaced with ${dashboardBleed.fallbackName} fallback`
          : `${blueprint.design.mode}: custom preview from ${blueprint.appType}`,
      ),
      passed(
        "architect",
        "Project architecture files generated",
        `${architect.files.length} route/component/lib/style/doc files`,
      ),
      passed(
        "backend",
        "Backend/schema/RLS plan generated",
        `${backend.tableCount} tables, ${backend.policyCount} RLS policy drafts`,
      ),
      visualGate,
      pending("typecheck", "TypeScript check", "npm run typecheck"),
      pending("lint", "Lint", "npm run lint"),
      pending("build", "Production build", "npm run build"),
      pending("test", "Tests", "npm run test", false),
    ],
  });

  return {
    generator: "monster-orchestrator-v1",
    blueprint,
    designBrief: brief,
    frontendFiles,
    backend,
    architect,
    files,
    visualQuality: visual,
    critique,
    repairAttempts,
    proof,
    output: {
      blueprintSummary,
      designBriefSummary,
      designMode: dashboardBleed.replaced ? dashboardBleed.fallbackName : blueprint.design.mode,
      appType: blueprint.appType,
      previewGenerator: dashboardBleed.replaced
        ? `direct-build-controller-v1-${dashboardBleed.fallbackName}`
        : "monster-custom-preview-v1",
      generator: "monster-orchestrator-v1",
      frontendFileCount: frontendFiles.length,
      backendFileCount: backend.files.length,
      architectFileCount: architect.files.length,
      fileCount: files.length,
      tableCount: backend.tableCount,
      policyCount: backend.policyCount,
      previewReady,
      canDeclareDone: proof.canDeclareDone,
      written,
      filesTouched: written,
      changedFiles: written,
      fileList: written,
      previewProof: {
        generator: dashboardBleed.replaced
          ? `direct-build-controller-v1-${dashboardBleed.fallbackName}`
          : "monster-custom-preview-v1",
        expectedMeta: dashboardBleed.replaced
          ? '<meta name="yawb-generator" content="direct-build-controller-v1" />'
          : '<meta name="yawb-generator" content="monster-custom-preview-v1" />',
        indexPath: "index.html",
      },
      designCritique,
      visualVerdict: critique.verdict,
      visualPassed: critique.passedVisualQuality,
      repairAttempts,
    },
  };
}
