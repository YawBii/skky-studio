-- yawB Native Hosting publication state
--
-- Native Publish should be first-class and not depend on Vercel. This table
-- records which projects have been published through yawB Native Hosting and
-- stores the current public URL/version metadata for the Builder UI.

create table if not exists public.project_publications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  url text not null,
  provider text not null default 'yawb-native',
  status text not null default 'published' check (status in ('published', 'unpublished')),
  version integer not null default 1,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  unpublished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

alter table public.project_publications enable row level security;

create index if not exists project_publications_project_id_idx
  on public.project_publications(project_id);

create index if not exists project_publications_workspace_id_idx
  on public.project_publications(workspace_id);

create index if not exists project_publications_status_idx
  on public.project_publications(status);

create or replace function public.touch_project_publications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_project_publications_updated_at on public.project_publications;
create trigger touch_project_publications_updated_at
before update on public.project_publications
for each row execute function public.touch_project_publications_updated_at();

-- Authenticated workspace members can manage publication state for projects in
-- their workspace.
drop policy if exists "workspace members can read project publications" on public.project_publications;
create policy "workspace members can read project publications"
  on public.project_publications
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = project_publications.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "workspace members can insert project publications" on public.project_publications;
create policy "workspace members can insert project publications"
  on public.project_publications
  for insert
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = project_publications.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "workspace members can update project publications" on public.project_publications;
create policy "workspace members can update project publications"
  on public.project_publications
  for update
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = project_publications.workspace_id
        and wm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = project_publications.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Public visitors may read publication metadata for published projects. The
-- public rendered route still serves the project output through /p/:projectId.
drop policy if exists "published project publications are public" on public.project_publications;
create policy "published project publications are public"
  on public.project_publications
  for select
  using (status = 'published');
