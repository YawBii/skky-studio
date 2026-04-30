-- yawB: per-step attempt history + tighten project_jobs.status to allow
-- 'waiting_for_input'. Idempotent. Run after 2026-04-30-project-jobs.sql.

-- 1) Allow 'waiting_for_input' on project_jobs.status (the runner sets it).
alter table public.project_jobs drop constraint if exists project_jobs_status_check;
alter table public.project_jobs
  add constraint project_jobs_status_check
  check (status in ('queued','running','waiting_for_input','succeeded','failed','cancelled'));

-- 2) Per-step attempt counter on project_job_steps (preserved across retries).
alter table public.project_job_steps
  add column if not exists attempt_number integer not null default 1;

-- 3) Per-step attempt history. One row per execution attempt of a step.
create table if not exists public.project_job_step_attempts (
  id              uuid primary key default gen_random_uuid(),
  step_id         uuid not null references public.project_job_steps(id) on delete cascade,
  job_id          uuid not null references public.project_jobs(id) on delete cascade,
  attempt_number  integer not null,
  status          text not null
                   check (status in ('running','succeeded','failed','skipped','cancelled','waiting_for_input')),
  input           jsonb not null default '{}'::jsonb,
  output          jsonb not null default '{}'::jsonb,
  error           text,
  logs            jsonb not null default '[]'::jsonb,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (step_id, attempt_number)
);
alter table public.project_job_step_attempts enable row level security;
create index if not exists idx_pjsa_step on public.project_job_step_attempts(step_id);
create index if not exists idx_pjsa_job  on public.project_job_step_attempts(job_id);

-- Attempts inherit access from their parent job (same shape as project_job_steps).
drop policy if exists "pjsa_select_members" on public.project_job_step_attempts;
create policy "pjsa_select_members" on public.project_job_step_attempts for select to authenticated
  using (
    exists (
      select 1 from public.project_jobs j
      where j.id = job_id and public.can_access_project(j.project_id, auth.uid())
    )
  );

drop policy if exists "pjsa_insert_member" on public.project_job_step_attempts;
create policy "pjsa_insert_member" on public.project_job_step_attempts for insert to authenticated
  with check (
    exists (
      select 1 from public.project_jobs j
      where j.id = job_id and public.can_access_project(j.project_id, auth.uid())
    )
  );

drop policy if exists "pjsa_update_member" on public.project_job_step_attempts;
create policy "pjsa_update_member" on public.project_job_step_attempts for update to authenticated
  using (
    exists (
      select 1 from public.project_jobs j
      where j.id = job_id and public.can_access_project(j.project_id, auth.uid())
    )
  );
