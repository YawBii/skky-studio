-- yawB job orchestration: project_jobs, project_job_steps, project_secrets.
-- Idempotent. Depends on the collaboration migration (helpers can_access_project,
-- has_workspace_role, touch_updated_at) and on public.projects / public.workspaces.

-- ============================================================
-- project_jobs
-- ============================================================
create table if not exists public.project_jobs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  type          text not null,
  status        text not null default 'queued'
                  check (status in ('queued','running','succeeded','failed','cancelled')),
  title         text not null,
  input         jsonb not null default '{}'::jsonb,
  output        jsonb not null default '{}'::jsonb,
  error         text,
  retry_count   integer not null default 0,
  created_by    uuid not null references auth.users(id) on delete restrict,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  updated_at    timestamptz not null default now()
);
alter table public.project_jobs enable row level security;
create index if not exists idx_pj_project on public.project_jobs(project_id);
create index if not exists idx_pj_status  on public.project_jobs(status);

drop policy if exists "pj_select_members" on public.project_jobs;
create policy "pj_select_members" on public.project_jobs for select to authenticated
  using (public.can_access_project(project_id, auth.uid()));

drop policy if exists "pj_insert_member" on public.project_jobs;
create policy "pj_insert_member" on public.project_jobs for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_access_project(project_id, auth.uid())
  );

drop policy if exists "pj_update_member" on public.project_jobs;
create policy "pj_update_member" on public.project_jobs for update to authenticated
  using (public.can_access_project(project_id, auth.uid()));

drop policy if exists "pj_delete_admin" on public.project_jobs;
create policy "pj_delete_admin" on public.project_jobs for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.has_workspace_role(p.workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[])
    )
  );

drop trigger if exists trg_pj_touch on public.project_jobs;
create trigger trg_pj_touch before update on public.project_jobs
  for each row execute function public.touch_updated_at();

-- ============================================================
-- project_job_steps
-- ============================================================
create table if not exists public.project_job_steps (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.project_jobs(id) on delete cascade,
  step_key      text not null,
  title         text not null,
  status        text not null default 'queued'
                  check (status in ('queued','running','succeeded','failed','skipped','cancelled')),
  position      integer not null default 0,
  input         jsonb not null default '{}'::jsonb,
  output        jsonb not null default '{}'::jsonb,
  logs          jsonb not null default '[]'::jsonb,
  error         text,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (job_id, step_key)
);
alter table public.project_job_steps enable row level security;
create index if not exists idx_pjs_job on public.project_job_steps(job_id);

-- Steps inherit access from their parent job.
drop policy if exists "pjs_select_members" on public.project_job_steps;
create policy "pjs_select_members" on public.project_job_steps for select to authenticated
  using (
    exists (
      select 1 from public.project_jobs j
      where j.id = job_id and public.can_access_project(j.project_id, auth.uid())
    )
  );

drop policy if exists "pjs_insert_member" on public.project_job_steps;
create policy "pjs_insert_member" on public.project_job_steps for insert to authenticated
  with check (
    exists (
      select 1 from public.project_jobs j
      where j.id = job_id and public.can_access_project(j.project_id, auth.uid())
    )
  );

drop policy if exists "pjs_update_member" on public.project_job_steps;
create policy "pjs_update_member" on public.project_job_steps for update to authenticated
  using (
    exists (
      select 1 from public.project_jobs j
      where j.id = job_id and public.can_access_project(j.project_id, auth.uid())
    )
  );

drop policy if exists "pjs_delete_admin" on public.project_job_steps;
create policy "pjs_delete_admin" on public.project_job_steps for delete to authenticated
  using (
    exists (
      select 1 from public.project_jobs j
      join public.projects p on p.id = j.project_id
      where j.id = job_id
        and public.has_workspace_role(p.workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[])
    )
  );

drop trigger if exists trg_pjs_touch on public.project_job_steps;
create trigger trg_pjs_touch before update on public.project_job_steps
  for each row execute function public.touch_updated_at();

-- ============================================================
-- project_secrets — REFERENCE ONLY.
-- value_ref points to a Lovable Cloud / runtime env var name.
-- The actual secret VALUE is never stored in the DB and never sent to the
-- browser. Server-side workers read process.env[value_ref].
-- ============================================================
create table if not exists public.project_secrets (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  provider      text not null,
  key           text not null,
  value_ref     text not null,
  description   text,
  created_by    uuid not null references auth.users(id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (project_id, provider, key)
);
alter table public.project_secrets enable row level security;
create index if not exists idx_ps_project on public.project_secrets(project_id);

-- Only admins/owners of the workspace can read secret references; values are
-- never in the DB so this only protects the mapping metadata.
drop policy if exists "ps_select_admin" on public.project_secrets;
create policy "ps_select_admin" on public.project_secrets for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.has_workspace_role(p.workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[])
    )
  );

drop policy if exists "ps_insert_admin" on public.project_secrets;
create policy "ps_insert_admin" on public.project_secrets for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.has_workspace_role(p.workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[])
    )
  );

drop policy if exists "ps_update_admin" on public.project_secrets;
create policy "ps_update_admin" on public.project_secrets for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.has_workspace_role(p.workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[])
    )
  );

drop policy if exists "ps_delete_admin" on public.project_secrets;
create policy "ps_delete_admin" on public.project_secrets for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.has_workspace_role(p.workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[])
    )
  );

drop trigger if exists trg_ps_touch on public.project_secrets;
create trigger trg_ps_touch before update on public.project_secrets
  for each row execute function public.touch_updated_at();
