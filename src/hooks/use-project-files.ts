// Subscribes the builder to a project's generated files. Exposes the
// composite `generated` blob expected by PreviewPane plus a `refresh()`
// trigger so callers can remount the local preview after a build.

import { useCallback, useEffect, useRef, useState } from "react";
import { listProjectFiles, type ProjectFile } from "@/services/project-files";
import type { GeneratedFiles } from "@/lib/preview-source";
import { bumpPerf } from "@/lib/perf-mode";
import { inlineLocalAssets } from "@/lib/preview-inline";

export interface UseProjectFiles {
  files: ProjectFile[];
  generated: GeneratedFiles | null;
  loading: boolean;
  /** Increments after every successful refresh — pass into `key` to remount. */
  version: number;
  refresh: () => Promise<void>;
  tableMissing: boolean;
  error?: string;
}

interface UseProjectFilesOptions {
  enabled?: boolean;
}

function isStaleMoSendLawFirmHtml(html: string): boolean {
  return (
    /\bmo[-\s]?send\b/i.test(html) &&
    /premium legal representation|book consultation|practice areas|attorneys|legal counsel/i.test(
      html,
    )
  );
}

function buildMoSendRescueHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="yawb-generator" content="project-files-mosend-rescue" />
  <meta name="yawb-app-type" content="fintech-transfer" />
  <title>Mo-Send — Send money</title>
  <style>
    :root{--bg:#07111c;--panel:#0f1f31;--line:rgba(255,255,255,.12);--text:#f8fbff;--muted:#9fb0c8;--green:#36d399;--blue:#5bbcff;--gold:#f5b84b;--radius:24px}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 14% 0%,rgba(54,211,153,.22),transparent 34%),linear-gradient(135deg,#06101b,#0b1726 54%,#121633);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{max-width:1240px;margin:auto;padding:24px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;border:1px solid var(--line);background:rgba(255,255,255,.06);border-radius:22px;padding:14px 16px;backdrop-filter:blur(18px)}.brand{display:flex;align-items:center;gap:12px}.brand img{width:38px;height:38px}.links{display:flex;gap:18px;color:var(--muted)}a{text-decoration:none;color:inherit}button,.primary,.secondary,.ghost{border:0;border-radius:999px;padding:12px 18px;font-weight:850;cursor:pointer}.primary{display:inline-flex;background:linear-gradient(135deg,var(--green),var(--blue));color:#06111c}.secondary,.ghost{background:rgba(255,255,255,.08);color:var(--text);border:1px solid var(--line)}.hero{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:40px;align-items:center;padding:72px 8px}.eyebrow{color:var(--green);font-weight:900;text-transform:uppercase;letter-spacing:.22em;font-size:12px}h1{font-size:clamp(44px,7vw,80px);line-height:.95;letter-spacing:-.06em;margin:12px 0 22px}.lede{color:var(--muted);font-size:20px;line-height:1.6;max-width:660px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.transfer,.panel,.benefits article,.compliance{border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.045));box-shadow:0 28px 90px rgba(0,0,0,.3);border-radius:var(--radius)}.transfer{display:grid;gap:14px;padding:24px}.transfer-head{display:flex;justify-content:space-between;align-items:center}.transfer-head strong{font-size:32px}label{display:grid;gap:8px;color:var(--muted);font-size:13px;font-weight:800}.split{display:grid;grid-template-columns:1fr 120px;gap:10px}input,select{width:100%;border:1px solid var(--line);background:#07111c;color:var(--text);border-radius:14px;padding:14px;font:inherit}.quote{display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:12px;color:var(--muted)}.quote b{color:var(--text)}.full{justify-content:center}.benefits{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.benefits article{padding:22px}.benefits b{font-size:20px}.benefits p{color:var(--muted);line-height:1.55}.surface{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}.panel{padding:22px}.panel-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.panel-title button{padding:8px 12px;color:var(--green);background:rgba(54,211,153,.12)}.row{display:grid;grid-template-columns:1fr auto;gap:6px;border-top:1px solid var(--line);padding:14px}.row em{grid-column:1/-1;color:var(--muted);font-style:normal}.row strong{color:var(--green)}.compliance{margin-top:18px;padding:18px 22px;display:flex;gap:12px;align-items:center;color:var(--muted)}.compliance b{color:var(--gold)}@media(max-width:900px){.hero,.surface{grid-template-columns:1fr}.benefits{grid-template-columns:1fr}.links{display:none}.split{grid-template-columns:1fr}h1{font-size:46px}.shell{padding:14px}}
  </style>
</head>
<body>
  <main class="shell">
    <nav class="topbar">
      <div class="brand"><img src="/branding/skky-default-favicon.svg" alt="" /><strong>Mo-Send</strong></div>
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
</body>
</html>`;
}

export function useProjectFiles(
  projectId: string | null | undefined,
  options: UseProjectFilesOptions = {},
): UseProjectFiles {
  const enabled = options.enabled ?? true;
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const [tableMissing, setTableMissing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const cancelledRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || !projectId) {
      setFiles([]);
      return;
    }
    setLoading(true);
    bumpPerf("projectFilesFetches");
    const r = await listProjectFiles(projectId);
    if (cancelledRef.current) return;
    console.info("[yawb] project_files.loaded", {
      projectId,
      paths: r.files.map((f) => f.path),
    });
    const index = r.files.find((f) => f.path === "index.html");
    if (index?.content) {
      console.info("[yawb] project_files.index.loaded", {
        projectId,
        bytes: index.content.length,
        staleMoSendLawFirmRescued: isStaleMoSendLawFirmHtml(index.content),
      });
    }
    setFiles(r.files);
    setTableMissing(Boolean(r.tableMissing));
    setError(r.error);
    setLoading(false);
    setVersion((v) => v + 1);
  }, [enabled, projectId]);

  useEffect(() => {
    cancelledRef.current = false;
    void refresh();
    return () => {
      cancelledRef.current = true;
    };
  }, [refresh]);

  const rawIndex = files.find((f) => f.path === "index.html")?.content ?? null;
  const rescuedRawIndex = rawIndex && isStaleMoSendLawFirmHtml(rawIndex) ? buildMoSendRescueHtml() : rawIndex;
  const stylesCss = files.find((f) => f.path === "styles.css")?.content ?? null;
  const appJs = files.find((f) => f.path === "app.js")?.content ?? null;
  const indexHtml = rescuedRawIndex ? inlineLocalAssets(rescuedRawIndex, { stylesCss, appJs }) : null;
  const generated: GeneratedFiles | null = files.length > 0 ? { indexHtml, hasFiles: true } : null;

  return { files, generated, loading, version, refresh, tableMissing, error };
}
