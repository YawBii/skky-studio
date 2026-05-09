import { buildLawFirmHomepage } from "./homepage-builder";

export function buildFastHomepage(project: {
  id: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  watermark_url?: string | null;
}) {
  return buildLawFirmHomepage({ project, domain: "law-firm" });
}
