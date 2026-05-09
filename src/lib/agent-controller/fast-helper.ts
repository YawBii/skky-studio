import { buildLawFirmHomepage } from "./homepage-builder";

export type FastHomepageProject = {
  id: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  watermark_url?: string | null;
};

export function buildFastHomepage(project: FastHomepageProject) {
  return buildLawFirmHomepage({ project, domain: "law-firm" });
}

export function buildFastHomepageProjectFiles(project: FastHomepageProject) {
  const out = buildFastHomepage(project);
  return [
    { path: "index.html", content: out.indexHtml, language: "html", kind: "source" as const },
    { path: "styles.css", content: out.stylesCss, language: "css", kind: "source" as const },
  ];
}
