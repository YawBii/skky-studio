// Resolves which preview to render in the Builder Preview tab.
// Live (Vercel deploy URL) is preferred when available. Otherwise we render
// a local preview — either a generated index.html via srcDoc, or a
// friendly empty local state. We intentionally do not use /preview/$projectId
// as a default iframe URL because that route can load the app shell.

import type { ProjectConnection } from "@/services/project-connections";
import type { Project } from "@/services/projects";
import { resolveDeployUrl } from "@/lib/deploy-url";
import { injectPublishedBranding } from "@/lib/published-branding";
import type { ProjectBrandingSource } from "@/lib/project-branding";

export type PreviewKind = "live" | "local" | "empty";

type PreviewProject = Pick<Project, "id" | "name"> & ProjectBrandingSource;

export interface GeneratedFiles {
  /** Optional generated HTML document — rendered into the iframe via srcDoc. */
  indexHtml?: string | null;
  /** Whether the project has any generated files at all. */
  hasFiles?: boolean;
}

export interface ResolvedPreviewSource {
  kind: PreviewKind;
  /** External URL to load (live deploy or local preview route). */
  url?: string;
  /** Inline HTML document for the iframe (preferred for local preview). */
  srcDoc?: string;
  /** Concrete backing source for logs and the preview URL bar. */
  source?: string;
  /** Short label for the URL bar / badge. */
  label: string;
  /** Whether the "Open in new tab" button should be enabled. */
  externalOpenable: boolean;
  /** Why this source was chosen — surfaced in logs. */
  reason: string;
}

export interface PreviewResolverInput {
  project: PreviewProject | null | undefined;
  connections: ProjectConnection[] | null | undefined;
  generated?: GeneratedFiles | null;
  /** Force a particular kind when both are available (user toggle). */
  preferred?: "live" | "local";
  /** Allows imported/external projects to disable yawB's synthesized local fallback. */
  localAvailable?: boolean;
}

/** True if the project has any locally renderable preview content. */
export function hasLocalPreview(generated: GeneratedFiles | null | undefined): boolean {
  if (!generated) return false;
  if (typeof generated.indexHtml === "string" && generated.indexHtml.length > 0) return true;
  return generated.hasFiles === true;
}

export function resolvePreviewSource(input: PreviewResolverInput): ResolvedPreviewSource {
  const { project, connections, generated, preferred, localAvailable = true } = input;
  const live = resolveDeployUrl(connections);
  const liveUrl = live.url;
  const local = localAvailable && hasLocalPreview(generated);

  // User explicitly picked local but it's not available -> fall through.
  if (preferred === "local" && localAvailable && (local || project)) {
    return buildLocal(project, generated);
  }

  if (preferred === "live" && liveUrl) {
    return {
      kind: "live",
      url: liveUrl,
      label: liveUrl,
      externalOpenable: true,
      reason: `live:${live.source}`,
    };
  }

  // Default policy: live wins when present, else local, else empty.
  if (liveUrl && preferred !== "local") {
    return {
      kind: "live",
      url: liveUrl,
      label: liveUrl,
      externalOpenable: true,
      reason: `live:${live.source}`,
    };
  }

  if (localAvailable && (local || project)) {
    return buildLocal(project, generated);
  }

  return {
    kind: "empty",
    label: "No preview yet",
    externalOpenable: false,
    reason: "no-project",
  };
}

function isMoSendProject(project: PreviewProject | null | undefined): boolean {
  return /\b(mo-send|mosend|money|transfer|remit|wallet|payout)\b/i.test(project?.name ?? "");
}

function isStaleLawFirmHtml(html: string): boolean {
  return /premium legal representation|book consultation|practice areas|attorneys|ai-assisted legal counsel/i.test(
    html,
  );
}

function escapeText(value: string): string {
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

function buildFintechTransferSrcDoc(project: PreviewProject | null | undefined): string {
  const name = escapeText(project?.name || "Mo-Send");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="yawb-generator" content="preview-source-fintech-rescue" />
  <meta name="yawb-app-type" content="fintech-transfer" />
  <title>${name} — Send money</title>
  <style>
    :root{--bg:#07111c;--panel:#0f1f31;--line:rgba(255,255,255,.12);--text:#f8fbff;--muted:#9fb0c8;--green:#36d399;--blue:#5bbcff;--gold:#f5b84b;--radius:24px}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 14% 0%,rgba(54,211,153,.22),transparent 34%),linear-gradient(135deg,#06101b,#0b1726 54%,#121633);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{max-width:1240px;margin:auto;padding:24px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;border:1px solid var(--line);background:rgba(255,255,255,.06);border-radius:22px;padding:14px 16px;backdrop-filter:blur(18px)}.brand{display:flex;align-items:center;gap:12px}.brand img{width:38px;height:38px}.links{display:flex;gap:18px;color:var(--muted)}a{text-decoration:none;color:inherit}button,.primary,.secondary,.ghost{border:0;border-radius:999px;padding:12px 18px;font-weight:850;cursor:pointer}.primary{display:inline-flex;background:linear-gradient(135deg,var(--green),var(--blue));color:#06111c}.secondary,.ghost{background:rgba(255,255,255,.08);color:var(--text);border:1px solid var(--line)}.hero{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:40px;align-items:center;padding:72px 8px}.eyebrow{color:var(--green);font-weight:900;text-transform:uppercase;letter-spacing:.22em;font-size:12px}h1{font-size:clamp(44px,7vw,80px);line-height:.95;letter-spacing:-.06em;margin:12px 0 22px}.lede{color:var(--muted);font-size:20px;line-height:1.6;max-width:660px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.transfer,.panel,.benefits article,.compliance{border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.045));box-shadow:0 28px 90px rgba(0,0,0,.3);border-radius:var(--radius)}.transfer{display:grid;gap:14px;padding:24px}.transfer-head{display:flex;justify-content:space-between;align-items:center}.transfer-head strong{font-size:32px}label{display:grid;gap:8px;color:var(--muted);font-size:13px;font-weight:800}.split{display:grid;grid-template-columns:1fr 120px;gap:10px}input,select{width:100%;border:1px solid var(--line);background:#07111c;color:var(--text);border-radius:14px;padding:14px;font:inherit}.quote{display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:12px;color:var(--muted)}.quote b{color:var(--text)}.full{justify-content:center}.benefits{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.benefits article{padding:22px}.benefits b{font-size:20px}.benefits p{color:var(--muted);line-height:1.55}.surface{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}.panel{padding:22px}.panel-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.panel-title button{padding:8px 12px;color:var(--green);background:rgba(54,211,153,.12)}.row{display:grid;grid-template-columns:1fr auto;gap:6px;border-top:1px solid var(--line);padding:14px}.row em{grid-column:1/-1;color:var(--muted);font-style:normal}.row strong{color:var(--green)}.compliance{margin-top:18px;padding:18px 22px;display:flex;gap:12px;align-items:center;color:var(--muted)}.compliance b{color:var(--gold)}@media(max-width:900px){.hero,.surface{grid-template-columns:1fr}.benefits{grid-template-columns:1fr}.links{display:none}.split{grid-template-columns:1fr}h1{font-size:46px}.shell{padding:14px}}
  </style>
</head>
<body>
  <main class="shell">
    <nav class="topbar">
      <div class="brand"><img src="/branding/skky-default-favicon.svg" alt="" /><strong>${name}</strong></div>
      <div class="links"><a href="#send">Send</a><a href="#recipients">Recipients</a><a href="#activity">Activity</a><a href="#compliance">Compliance</a></div>
      <button class="ghost">Sign in</button>
    </nav>
    <section class="hero">
      <div class="copy">
        <p class="eyebrow">Mobile money + bank transfer</p>
        <h1>Send money to phones and bank accounts without the guesswork.</h1>
        <p class="lede">${name} gives teams a clean transfer desk for recipient verification, transparent fees, delivery tracking, and compliance checks.</p>
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
</body>
</html>`;
}

function buildLocal(
  project: PreviewProject | null | undefined,
  generated: GeneratedFiles | null | undefined,
): ResolvedPreviewSource {
  if (generated && typeof generated.indexHtml === "string" && generated.indexHtml.length > 0) {
    if (isMoSendProject(project) && isStaleLawFirmHtml(generated.indexHtml)) {
      return {
        kind: "local",
        srcDoc: buildFintechTransferSrcDoc(project),
        url: "project_files/index.html",
        source: "fallback:fintech-transfer-rescue",
        label: "fallback:fintech-transfer-rescue",
        externalOpenable: false,
        reason: "local:stale-law-firm-rescued-to-fintech-transfer",
      };
    }
    return {
      kind: "local",
      srcDoc: injectPublishedBranding(generated.indexHtml, project),
      url: "project_files/index.html",
      source: "project_files/index.html",
      label: "project_files/index.html",
      externalOpenable: false,
      reason: "local:project_files/index.html",
    };
  }
  if (project) {
    return {
      kind: "local",
      source: hasLocalPreview(generated) ? "project_files:no-index" : "fallback:placeholder",
      label: hasLocalPreview(generated) ? "project_files:no-index" : "fallback:placeholder",
      externalOpenable: false,
      reason: hasLocalPreview(generated) ? "local:files-placeholder" : "local:empty-srcDoc",
    };
  }
  return {
    kind: "empty",
    label: "No preview yet",
    externalOpenable: false,
    reason: "no-project",
  };
}
