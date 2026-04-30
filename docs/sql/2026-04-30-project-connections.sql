-- project_connections: optional table for external repo / deploy provider links.
-- Safe to apply on top of the collaboration migration. Idempotent.

create table if not exists public.project_connections (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  provider        text not null check (provider in ('github','gitlab','bitbucket','vercel','netlify')),
  status          text not null default 'pending' check (status in ('pending','connected','error','disconnected')),
  repo_full_name  text,
  repo_url        text,
  default_branch  text,
  metadata        jsonb not null default '{}'::jsonb,
  created_by      uuid not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, provider, repo_full_name)
);
alter table public.project_connections enable row level security;
create index if not exists idx_pc_project on public.project_connections(project_id);

-- RLS: any workspace member of the project's workspace can read; member+
-- can insert; admin/owner can update or delete. Reuses the helper from the
-- collaboration migration.
drop policy if exists "pc_select_members" on public.project_connections;
create policy "pc_select_members" on public.project_connections for select to authenticated
  using (public.can_access_project(project_id, auth.uid()));

drop policy if exists "pc_insert_member" on public.project_connections;
create policy "pc_insert_member" on public.project_connections for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_access_project(project_id, auth.uid())
  );

drop policy if exists "pc_update_admin" on public.project_connections;
create policy "pc_update_admin" on public.project_connections for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.has_workspace_role(p.workspace_id, auth.uid(), array['owner','admin','member']::public.workspace_role[])
    )
  );

drop policy if exists "pc_delete_admin" on public.project_connections;
create policy "pc_delete_admin" on public.project_connections for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.has_workspace_role(p.workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[])
    )
  );

drop trigger if exists trg_pc_touch on public.project_connections;
create trigger trg_pc_touch before update on public.project_connections
  for each row execute function public.touch_updated_at();
