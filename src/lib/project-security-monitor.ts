export type SecuritySeverity = "pass" | "info" | "warning" | "critical";

export interface SecurityInputFile {
  path: string;
  content: string;
}

export interface SecurityFinding {
  id: string;
  title: string;
  severity: SecuritySeverity;
  detail: string;
  files: string[];
  recommendation: string;
}

export interface ProjectSecurityReport {
  monitoredBy: "yawb-security-monitor-v1";
  status: "secure" | "needs_attention" | "critical";
  score: number;
  generatedAt: string;
  filesScanned: number;
  findings: SecurityFinding[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    pass: number;
  };
}

const SECRET_PATTERNS: Array<{ id: string; label: string; re: RegExp }> = [
  { id: "openai-key", label: "OpenAI API key", re: /sk-[A-Za-z0-9_-]{20,}/g },
  { id: "stripe-secret", label: "Stripe secret key", re: /sk_(live|test)_[A-Za-z0-9]{16,}/g },
  { id: "supabase-service-role", label: "Supabase service role token", re: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { id: "private-key", label: "Private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { id: "github-token", label: "GitHub token", re: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
  { id: "generic-secret-assignment", label: "Hardcoded secret assignment", re: /\b(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{10,}['"]/gi },
];

function hasMatch(files: SecurityInputFile[], re: RegExp): string[] {
  const found: string[] = [];
  for (const file of files) {
    re.lastIndex = 0;
    if (re.test(file.content)) found.push(file.path);
  }
  return found;
}

function addFinding(findings: SecurityFinding[], finding: SecurityFinding) {
  findings.push(finding);
}

export function scanProjectSecurity(files: SecurityInputFile[], now = new Date()): ProjectSecurityReport {
  const findings: SecurityFinding[] = [];
  const all = files.map((file) => file.content).join("\n");
  const htmlFiles = files.filter((file) => /\.html?$/i.test(file.path));
  const jsFiles = files.filter((file) => /\.(js|ts|tsx|jsx)$/i.test(file.path));

  for (const pattern of SECRET_PATTERNS) {
    const matched = hasMatch(files, pattern.re);
    if (matched.length > 0) {
      addFinding(findings, {
        id: `secret-${pattern.id}`,
        title: `${pattern.label} detected`,
        severity: "critical",
        detail: "A generated project file appears to contain a credential or secret-like token.",
        files: matched,
        recommendation: "Remove the secret from project files, rotate it, and store it in server-side environment variables only.",
      });
    }
  }

  const inlineScriptFiles = htmlFiles.filter((file) => /<script(?![^>]+src=)[^>]*>/i.test(file.content)).map((file) => file.path);
  if (inlineScriptFiles.length > 0) {
    addFinding(findings, {
      id: "inline-script",
      title: "Inline script present",
      severity: "warning",
      detail: "Inline scripts make it harder to enforce a strict Content Security Policy.",
      files: inlineScriptFiles,
      recommendation: "Move script logic to app.js or remove scripts from static landing pages unless they are required.",
    });
  }

  const dangerousDomFiles = jsFiles.filter((file) => /innerHTML\s*=|dangerouslySetInnerHTML/i.test(file.content)).map((file) => file.path);
  if (dangerousDomFiles.length > 0) {
    addFinding(findings, {
      id: "dangerous-dom-write",
      title: "Dangerous DOM write detected",
      severity: "critical",
      detail: "Direct HTML injection can create XSS if user-controlled content reaches this code path.",
      files: dangerousDomFiles,
      recommendation: "Use textContent or a framework-safe renderer. Sanitize any HTML that must be rendered.",
    });
  }

  const externalFormFiles = htmlFiles
    .filter((file) => /<form[^>]+action=["']https?:\/\//i.test(file.content))
    .map((file) => file.path);
  if (externalFormFiles.length > 0) {
    addFinding(findings, {
      id: "external-form-action",
      title: "External form action",
      severity: "warning",
      detail: "A form posts visitor data to an external URL.",
      files: externalFormFiles,
      recommendation: "Confirm the endpoint is trusted, uses HTTPS, and has the correct privacy disclosure.",
    });
  }

  const httpFiles = files.filter((file) => /http:\/\//i.test(file.content)).map((file) => file.path);
  if (httpFiles.length > 0) {
    addFinding(findings, {
      id: "mixed-content-http",
      title: "Insecure HTTP reference",
      severity: "warning",
      detail: "HTTP assets can be blocked by browsers and can expose visitors to mixed-content risk.",
      files: httpFiles,
      recommendation: "Use HTTPS URLs for all assets, links, forms, and scripts.",
    });
  }

  const thirdPartyScriptFiles = htmlFiles
    .filter((file) => /<script[^>]+src=["']https?:\/\//i.test(file.content))
    .map((file) => file.path);
  if (thirdPartyScriptFiles.length > 0) {
    addFinding(findings, {
      id: "third-party-script",
      title: "Third-party script loaded",
      severity: "info",
      detail: "External scripts can affect performance, privacy, and security.",
      files: thirdPartyScriptFiles,
      recommendation: "Only load trusted third-party scripts and consider Subresource Integrity where possible.",
    });
  }

  const iframeFiles = htmlFiles.filter((file) => /<iframe\b/i.test(file.content)).map((file) => file.path);
  if (iframeFiles.length > 0) {
    addFinding(findings, {
      id: "iframe-embed",
      title: "Iframe embed detected",
      severity: "info",
      detail: "Embedded frames can create tracking, clickjacking, or data-leak risks depending on the source.",
      files: iframeFiles,
      recommendation: "Verify iframe sources, restrict permissions, and use sandbox attributes where possible.",
    });
  }

  const hasCsp = /http-equiv=["']Content-Security-Policy["']|Content-Security-Policy/i.test(all);
  if (!hasCsp && files.length > 0) {
    addFinding(findings, {
      id: "missing-csp",
      title: "Content Security Policy not declared",
      severity: "info",
      detail: "No CSP marker was found in generated files.",
      files: htmlFiles.map((file) => file.path),
      recommendation: "Add a CSP at the hosting layer or as a meta tag for static projects.",
    });
  }

  if (files.length === 0) {
    addFinding(findings, {
      id: "no-files",
      title: "No project files to scan",
      severity: "info",
      detail: "Security monitoring will start once this project has generated files.",
      files: [],
      recommendation: "Build or import the project, then run the security monitor again.",
    });
  }

  const summary = findings.reduce(
    (acc, finding) => {
      acc[finding.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0, pass: 0 },
  );

  if (summary.critical === 0 && summary.warning === 0) {
    summary.pass += 1;
    addFinding(findings, {
      id: "baseline-pass",
      title: "Baseline static security scan passed",
      severity: "pass",
      detail: "No hardcoded secrets, dangerous DOM writes, external form posts, or insecure HTTP references were found.",
      files: files.map((file) => file.path),
      recommendation: "Continue monitoring after every generation, import, and publish.",
    });
  }

  const score = Math.max(0, 100 - summary.critical * 35 - summary.warning * 15 - summary.info * 4);
  const status = summary.critical > 0 ? "critical" : summary.warning > 0 ? "needs_attention" : "secure";

  return {
    monitoredBy: "yawb-security-monitor-v1",
    status,
    score,
    generatedAt: now.toISOString(),
    filesScanned: files.length,
    findings,
    summary,
  };
}
