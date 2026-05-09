-- Project branding overrides
--
-- Null values inherit the yawB/SKKY default brand assets. Do not backfill
-- defaults into existing projects; inheritance keeps global defaults editable.

alter table public.projects
  add column if not exists logo_url text,
  add column if not exists favicon_url text,
  add column if not exists watermark_url text;

comment on column public.projects.logo_url is
  'Optional per-project logo override. Null = use global SKKY default logo.';

comment on column public.projects.favicon_url is
  'Optional per-project favicon override. Null = use global SKKY default favicon.';

comment on column public.projects.watermark_url is
  'Optional per-project watermark override. Null = use global SKKY default watermark.';
