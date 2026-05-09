import { describe, expect, it } from "vitest";
import { scanProjectSecurity } from "./project-security-monitor";

describe("yawB project security monitor", () => {
  it("passes a clean static homepage baseline", () => {
    const report = scanProjectSecurity(
      [
        {
          path: "index.html",
          content:
            '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'"></head><body><h1>Hello</h1></body></html>',
        },
        { path: "styles.css", content: "body{font-family:sans-serif}" },
      ],
      new Date("2026-05-09T00:00:00.000Z"),
    );

    expect(report.monitoredBy).toBe("yawb-security-monitor-v1");
    expect(report.status).toBe("secure");
    expect(report.summary.critical).toBe(0);
    expect(report.summary.warning).toBe(0);
    expect(report.findings.some((finding) => finding.id === "baseline-pass")).toBe(true);
  });

  it("flags hardcoded secrets as critical", () => {
    const report = scanProjectSecurity(
      [{ path: "app.js", content: "const token = 'ghp_abcdefghijklmnopqrstuvwxyz1234567890';" }],
      new Date("2026-05-09T00:00:00.000Z"),
    );

    expect(report.status).toBe("critical");
    expect(report.summary.critical).toBeGreaterThan(0);
    expect(report.findings.map((finding) => finding.id)).toContain("secret-github-token");
  });

  it("flags dangerous DOM writes as critical", () => {
    const report = scanProjectSecurity(
      [{ path: "app.js", content: "document.querySelector('#root').innerHTML = location.hash;" }],
      new Date("2026-05-09T00:00:00.000Z"),
    );

    expect(report.status).toBe("critical");
    expect(report.findings.map((finding) => finding.id)).toContain("dangerous-dom-write");
  });

  it("flags insecure HTTP references and external form posts", () => {
    const report = scanProjectSecurity(
      [
        {
          path: "index.html",
          content:
            '<form action="https://example.com/lead"></form><img src="http://cdn.example.com/a.png" />',
        },
      ],
      new Date("2026-05-09T00:00:00.000Z"),
    );

    expect(report.status).toBe("needs_attention");
    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining(["external-form-action", "mixed-content-http"]),
    );
  });
});
