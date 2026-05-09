import type { Project } from "@/services/projects";
import { upsertProjectFiles } from "@/services/project-files";
import { generateMonsterProject } from "@/services/monster-orchestrator";
import { findForbiddenDashboardTokens } from "@/lib/agent-controller/forbidden-dashboard-tokens";
import { scanProjectSecurity, type ProjectSecurityReport } from "@/lib/project-security-monitor";

export interface DirectBuildInput {
  project: Pick<Project, "id" | "name" | "description">;
  workspaceId: string;
  userRequest: string;
}

export type DirectBuildOutcome =
  | {
      kind: "success";
      controller: "direct-build-controller-v1";
      filesTouched: string[];
      forbiddenTokensFound: string[];
      security: ProjectSecurityReport;
      message: string;
    }
  | {
      kind: "failed";
      controller: "direct-build-controller-v1";
      filesTouched: string[];
      error: string;
    };

type VisibleFile = {
  path: string;
  content: string;
  language: string;
  kind: "source" | "asset";
};

function visibleFilesOnly(files: ReturnType<typeof generateMonsterProject>["files"]): VisibleFile[] {
  return files
    .filter((file) => ["index.html", "styles.css", "app.js"].includes(file.path))
    .map((file) => ({
      path: file.path,
      content: file.content,
      language: file.language,
      kind: file.kind,
    }));
}

function combinedInput(input: DirectBuildInput): string {
  return `${input.userRequest} ${input.project.name} ${input.project.description ?? ""}`.toLowerCase();
}

function isMoneyTransferBuild(input: DirectBuildInput): boolean {
  return /\b(mo-send|mosend|send money|money transfer|mobile money|bank transfer|remittance|payout|wallet|iban|recipient|kyc|fintech)\b/.test(
    combinedInput(input),
  );
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

function buildMoneyTransferFiles(input: DirectBuildInput): VisibleFile[] {
  const appName = escapeHtml(input.project.name || "Mo-Send");
  const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="yawb-generator" content="direct-build-controller-v1" />
  <meta name="yawb-app-type" content="fintech-transfer" />
  <title>${appName} — Send money fast</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="shell">
    <nav class="topbar">
      <div class="brand"><img src="/branding/skky-default-favicon.svg" alt="" /><strong>${appName}</strong></div>
      <div class="links"><a href="#send">Send</a><a href="#recipients">Recipients</a><a href="#activity">Activity</a><a href="#compliance">Compliance</a></div>
      <button class="ghost">Sign in</button>
    </nav>
    <section class="hero">
      <div class="copy">
        <p class="eyebrow">Mobile money + bank transfer</p>
        <h1>Send money to phones and bank accounts without the guesswork.</h1>
        <p class="lede">Mo-Send gives teams a clean transfer desk for recipient verification, transparent fees, delivery tracking, and compliance checks.</p>
        <div class="actions"><a class="primary" href="#send">Start transfer</a><a class="secondary" href="#activity">Track payments</a></div>
      </div>
      <section class="transfer" id="send" aria-label="Transfer form preview">
        <div class="transfer-head"><span>New transfer</span><strong>$250.00</strong></div>
        <label>Recipient phone or IBAN<input value="+233 24 000 0000" /></label>
        <label>Destination<select><option>Mobile money wallet</option><option>Bank account</option></select></label>
        <div class="split"><label>Amount<input value="250.00" /></label><label>Currency<select><option>USD</option><option>EUR</option><option>SEK</option><option>GHS</option></select></label></div>
        <div class="quote"><span>Fee</span><b>$3.20</b></div>
        <div class="quote"><span>Estimated arrival</span><b>~10 minutes</b></div>
        <button class="primary full">Review secure transfer</button>
      </section>
    </section>
    <section class="benefits">
      <article><b>Verify before payout</b><p>Check phone, wallet, or bank details before sending funds.</p></article>
      <article><b>Know the real cost</b><p>Show fees, exchange rate, and delivery estimate before confirmation.</p></article>
      <article><b>Stay audit-ready</b><p>KYC, limits, status history, and risk notes live with every transfer.</p></article>
    </section>
    <section class="surface">
      <div class="panel" id="recipients"><div class="panel-title"><b>Saved recipients</b><button>Add recipient</button></div><div class="row"><span>Akua Mensah</span><em>MTN Mobile Money · Ghana</em><strong>Ready</strong></div><div class="row"><span>Nordic Supplies AB</span><em>SEPA bank transfer · Sweden</em><strong>Verified</strong></div><div class="row"><span>Kwame Boateng</span><em>Vodafone Cash · Ghana</em><strong>Review</strong></div></div>
      <div class="panel" id="activity"><div class="panel-title"><b>Transfer activity</b><button>Export</button></div><div class="row"><span>$120 completed</span><em>Akua · Mobile money</em><strong>Paid</strong></div><div class="row"><span>$480 processing</span><em>Nordic Supplies · Bank transfer</em><strong>Live</strong></div><div class="row"><span>$1,200 needs review</span><em>New recipient · KYC limit</em><strong>Hold</strong></div></div>
    </section>
    <section class="compliance" id="compliance"><b>Compliance note</b><span>Prototype only. Connect licensed payout, KYC, sanctions screening, fraud, and ledger providers before moving real money.</span></section>
  </main>
  <script src="app.js"></script>
</body>
</html>`;

  const stylesCss = `:root{--bg:#07111c;--panel:#0f1f31;--line:rgba(255,255,255,.12);--text:#f8fbff;--muted:#9fb0c8;--green:#36d399;--blue:#5bbcff;--gold:#f5b84b;--radius:24px}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 14% 0%,rgba(54,211,153,.22),transparent 34%),linear-gradient(135deg,#06101b,#0b1726 54%,#121633);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{max-width:1240px;margin:auto;padding:24px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;border:1px solid var(--line);background:rgba(255,255,255,.06);border-radius:22px;padding:14px 16px;backdrop-filter:blur(18px)}.brand{display:flex;align-items:center;gap:12px}.brand img{width:38px;height:38px}.links{display:flex;gap:18px;color:var(--muted)}a{text-decoration:none;color:inherit}button,.primary,.secondary,.ghost{border:0;border-radius:999px;padding:12px 18px;font-weight:850;cursor:pointer}.primary{display:inline-flex;background:linear-gradient(135deg,var(--green),var(--blue));color:#06111c}.secondary,.ghost{background:rgba(255,255,255,.08);color:var(--text);border:1px solid var(--line)}.hero{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:40px;align-items:center;padding:72px 8px}.eyebrow{color:var(--green);font-weight:900;text-transform:uppercase;letter-spacing:.22em;font-size:12px}h1{font-size:clamp(44px,7vw,80px);line-height:.95;letter-spacing:-.06em;margin:12px 0 22px}.lede{color:var(--muted);font-size:20px;line-height:1.6;max-width:660px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.transfer,.panel,.benefits article,.compliance{border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.045));box-shadow:0 28px 90px rgba(0,0,0,.3);border-radius:var(--radius)}.transfer{display:grid;gap:14px;padding:24px}.transfer-head{display:flex;justify-content:space-between;align-items:center}.transfer-head strong{font-size:32px}label{display:grid;gap:8px;color:var(--muted);font-size:13px;font-weight:800}.split{display:grid;grid-template-columns:1fr 120px;gap:10px}input,select{width:100%;border:1px solid var(--line);background:#07111c;color:var(--text);border-radius:14px;padding:14px;font:inherit}.quote{display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:12px;color:var(--muted)}.quote b{color:var(--text)}.full{justify-content:center}.benefits{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.benefits article{padding:22px}.benefits b{font-size:20px}.benefits p{color:var(--muted);line-height:1.55}.surface{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}.panel{padding:22px}.panel-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.panel-title button{padding:8px 12px;color:var(--green);background:rgba(54,211,153,.12)}.row{display:grid;grid-template-columns:1fr auto;gap:6px;border-top:1px solid var(--line);padding:14px}.row em{grid-column:1/-1;color:var(--muted);font-style:normal}.row strong{color:var(--green)}.compliance{margin-top:18px;padding:18px 22px;display:flex;gap:12px;align-items:center;color:var(--muted)}.compliance b{color:var(--gold)}@media(max-width:900px){.hero,.surface{grid-template-columns:1fr}.benefits{grid-template-columns:1fr}.links{display:none}.split{grid-template-columns:1fr}h1{font-size:46px}.shell{padding:14px}}`;
  const appJs = "document.documentElement.dataset.yawbPreview='direct-fintech-transfer';\nconsole.info('[yawb] direct fintech transfer build active');\n";

  return [
    { path: "index.html", content: indexHtml, language: "html", kind: "source" },
    { path: "styles.css", content: stylesCss, language: "css", kind: "source" },
    { path: "app.js", content: appJs, language: "javascript", kind: "source" },
  ];
}

export async function runDirectBuildController(
  input: DirectBuildInput,
): Promise<DirectBuildOutcome> {
  const files = isMoneyTransferBuild(input)
    ? buildMoneyTransferFiles(input)
    : visibleFilesOnly(
        generateMonsterProject({
          project: input.project,
          chatRequest: input.userRequest,
          production: false,
        }).files,
      );

  if (!files.some((file) => file.path === "index.html")) {
    return {
      kind: "failed",
      controller: "direct-build-controller-v1",
      filesTouched: [],
      error: "Generator produced no index.html.",
    };
  }

  const fullOutput = files.map((file) => file.content).join("\n");
  const forbiddenTokensFound = findForbiddenDashboardTokens(fullOutput);
  if (forbiddenTokensFound.length > 0) {
    return {
      kind: "failed",
      controller: "direct-build-controller-v1",
      filesTouched: [],
      error: `Generator output still contains forbidden dashboard tokens: ${forbiddenTokensFound.join(", ")}`,
    };
  }

  const security = scanProjectSecurity(
    files.map((file) => ({ path: file.path, content: file.content })),
  );
  const criticalFindings = security.findings.filter((finding) => finding.severity === "critical");
  if (criticalFindings.length > 0) {
    return {
      kind: "failed",
      controller: "direct-build-controller-v1",
      filesTouched: [],
      error: `Security scan blocked write: ${criticalFindings.map((f) => f.title).join(", ")}`,
    };
  }

  const persisted = await upsertProjectFiles(input.project.id, files);
  if (!persisted.ok) {
    return {
      kind: "failed",
      controller: "direct-build-controller-v1",
      filesTouched: persisted.written,
      error: persisted.error ?? "Failed to write project files.",
    };
  }

  return {
    kind: "success",
    controller: "direct-build-controller-v1",
    filesTouched: persisted.written,
    forbiddenTokensFound,
    security,
    message: `Built app preview — wrote ${persisted.written.join(", ")}.`,
  };
}

export function summarizeDirectBuild(outcome: DirectBuildOutcome): string {
  if (outcome.kind === "failed") {
    return [
      `controller: ${outcome.controller}`,
      `filesTouched: [${outcome.filesTouched.map((f) => JSON.stringify(f)).join(", ")}]`,
      `status: failed`,
      `error: ${outcome.error}`,
    ].join(" · ");
  }
  return [
    `controller: ${outcome.controller}`,
    `filesTouched: [${outcome.filesTouched.map((f) => JSON.stringify(f)).join(", ")}]`,
    `status: success`,
    `forbiddenTokensFound: [${outcome.forbiddenTokensFound.map((t) => JSON.stringify(t)).join(", ")}]`,
    `securityScore: ${outcome.security.score}`,
    `criticalSecurityFindings: ${outcome.security.findings.filter((f) => f.severity === "critical").length}`,
    `legacyEnqueue: false`,
  ].join(" · ");
}
