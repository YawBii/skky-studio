import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ImageIcon, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { DEFAULT_PROJECT_BRANDING, resolveProjectBranding } from "@/lib/project-branding";
import type { ProjectBrandingSource } from "@/lib/project-branding";

export const Route = createFileRoute("/branding")({
  head: () => ({
    meta: [
      { title: "Branding — yawB" },
      { name: "description", content: "Project logo, favicon, and watermark settings." },
    ],
  }),
  component: BrandingPage,
});

interface BrandingForm {
  logo_url: string;
  favicon_url: string;
  watermark_url: string;
}

function normalize(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function emptyForm(): BrandingForm {
  return { logo_url: "", favicon_url: "", watermark_url: "" };
}

function BrandingPage() {
  const { project, projectIsReal, refreshProjects } = useSelectedProject();
  const [form, setForm] = useState<BrandingForm>(emptyForm());
  const [loadedBranding, setLoadedBranding] = useState<ProjectBrandingSource | null>(null);
  const [saving, setSaving] = useState(false);
  const branding = resolveProjectBranding(loadedBranding);

  useEffect(() => {
    let cancelled = false;
    setLoadedBranding(null);
    setForm(emptyForm());
    if (!project?.id || !projectIsReal) return;

    (async () => {
      const { data, error } = await (supabase as any)
        .from("projects")
        .select("logo_url, favicon_url, watermark_url")
        .eq("id", project.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error(`Branding load failed: ${error.message}`);
        return;
      }
      const row = (data ?? {}) as ProjectBrandingSource;
      setLoadedBranding(row);
      setForm({
        logo_url: row.logo_url ?? "",
        favicon_url: row.favicon_url ?? "",
        watermark_url: row.watermark_url ?? "",
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [project?.id, projectIsReal]);

  const save = async () => {
    if (!project?.id || !projectIsReal) {
      toast("Select a real project first");
      return;
    }
    setSaving(true);
    const payload = {
      logo_url: normalize(form.logo_url),
      favicon_url: normalize(form.favicon_url),
      watermark_url: normalize(form.watermark_url),
    };
    const { error } = await (supabase as any).from("projects").update(payload).eq("id", project.id);
    setSaving(false);
    if (error) {
      toast.error(`Branding save failed: ${error.message}`);
      return;
    }
    setLoadedBranding(payload);
    await refreshProjects();
    window.dispatchEvent(
      new CustomEvent("yawb:project-branding-updated", { detail: { projectId: project.id } }),
    );
    toast.success("Project branding saved");
  };

  const reset = async () => {
    setForm(emptyForm());
    if (!project?.id || !projectIsReal) return;
    setSaving(true);
    const payload = { logo_url: null, favicon_url: null, watermark_url: null };
    const { error } = await (supabase as any).from("projects").update(payload).eq("id", project.id);
    setSaving(false);
    if (error) {
      toast.error(`Reset failed: ${error.message}`);
      return;
    }
    setLoadedBranding(payload);
    await refreshProjects();
    window.dispatchEvent(
      new CustomEvent("yawb:project-branding-updated", { detail: { projectId: project.id } }),
    );
    toast.success("Project branding reset to SKKY defaults");
  };

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8 md:px-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight md:text-4xl">Branding</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every project uses the SKKY AB logo, favicon, and watermark by default. Add URLs here
            only when a client project needs its own brand.
          </p>
        </div>
        <ImageIcon className="mt-2 h-7 w-7 text-muted-foreground" />
      </div>

      {!projectIsReal || !project ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-muted-foreground">
          Select a project to edit branding overrides.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-white/10 bg-gradient-card p-6">
            <h2 className="font-display text-lg font-semibold">{project.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Empty fields inherit SKKY defaults. Saving custom URLs overrides only this project.
            </p>

            <div className="mt-6 space-y-4">
              <BrandField
                label="Logo URL"
                value={form.logo_url}
                placeholder={DEFAULT_PROJECT_BRANDING.logoUrl}
                onChange={(value) => setForm((f) => ({ ...f, logo_url: value }))}
              />
              <BrandField
                label="Favicon URL"
                value={form.favicon_url}
                placeholder={DEFAULT_PROJECT_BRANDING.faviconUrl}
                onChange={(value) => setForm((f) => ({ ...f, favicon_url: value }))}
              />
              <BrandField
                label="Watermark URL"
                value={form.watermark_url}
                placeholder={DEFAULT_PROJECT_BRANDING.watermarkUrl}
                onChange={(value) => setForm((f) => ({ ...f, watermark_url: value }))}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="hero" onClick={save} disabled={saving}>
                <Save className="h-4 w-4" /> Save branding
              </Button>
              <Button variant="outline" onClick={reset} disabled={saving}>
                <RotateCcw className="h-4 w-4" /> Reset to SKKY defaults
              </Button>
            </div>
          </section>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Live resolution
            </div>
            <div className="mt-4 space-y-4">
              <PreviewAsset
                label="Logo"
                url={branding.logoUrl}
                inherited={branding.usesDefaultLogo}
              />
              <PreviewAsset
                label="Favicon"
                url={branding.faviconUrl}
                inherited={branding.usesDefaultFavicon}
              />
              <PreviewAsset
                label="Watermark"
                url={branding.watermarkUrl}
                inherited={branding.usesDefaultWatermark}
                wide
              />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function BrandField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm focus:border-white/20 focus:outline-none"
      />
    </label>
  );
}

function PreviewAsset({
  label,
  url,
  inherited,
  wide = false,
}: {
  label: string;
  url: string;
  inherited: boolean;
  wide?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium">{label}</span>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {inherited ? "SKKY default" : "Project override"}
        </span>
      </div>
      <div className="grid min-h-20 place-items-center rounded-lg bg-white p-3">
        <img
          src={url}
          alt={label}
          className={wide ? "max-h-24 max-w-full object-contain" : "h-14 w-14 object-contain"}
        />
      </div>
      <div className="mt-2 truncate font-mono text-[10px] text-muted-foreground">{url}</div>
    </div>
  );
}
