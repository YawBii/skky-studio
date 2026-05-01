-- yawB project_files: per-project generated artifacts (index.html, app.css, app.js, ...).
-- Powers Local Preview so each project renders its own HTML instead of a shared placeholder.
-- Idempotent. Depends on collaboration migration (can_access_project, touch_updated_at)
-- and on public.projects.

create table if not exists public.project_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  path        text not null,
  content     text not null,
  language    text,
  kind        text not null default 'source',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (project_id, path)
);

alter table public.project_files enable row level security;

create index if not exists idx_pf_project on public.project_files(project_id);
create index if not exists idx_pf_kind    on public.project_files(project_id, kind);

drop policy if exists "pf_select_members" on public.project_files;
create policy "pf_select_members" on public.project_files
  for select using (public.can_access_project(project_id));

drop policy if exists "pf_insert_members" on public.project_files;
create policy "pf_insert_members" on public.project_files
  for insert with check (public.can_access_project(project_id));

drop policy if exists "pf_update_members" on public.project_files;
create policy "pf_update_members" on public.project_files
  for update using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

drop policy if exists "pf_delete_members" on public.project_files;
create policy "pf_delete_members" on public.project_files
  for delete using (public.can_access_project(project_id));

drop trigger if exists trg_pf_touch on public.project_files;
create trigger trg_pf_touch before update on public.project_files
  for each row execute function public.touch_updated_at();
