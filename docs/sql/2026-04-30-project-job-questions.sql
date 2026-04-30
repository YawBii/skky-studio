-- yawB job questions: pause a running job, ask the user something, resume.
-- Depends on docs/sql/2026-04-30-project-jobs.sql.

-- 1. Allow waiting_for_input on jobs and steps.
alter table public.project_jobs drop constraint if exists project_jobs_status_check;
alter table public.project_jobs add constraint project_jobs_status_check
  check (status in ('queued','running','waiting_for_input','succeeded','failed','cancelled'));

alter table public.project_job_steps drop constraint if exists project_job_steps_status_check;
alter table public.project_job_steps add constraint project_job_steps_status_check
  check (status in ('queued','running','waiting_for_input','succeeded','failed','skipped','cancelled'));

-- 2. Question table.
create table if not exists public.project_job_questions (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.project_jobs(id) on delete cascade,
  step_id       uuid references public.project_job_steps(id) on delete cascade,
  question      text not null,
  kind          text not null check (kind in ('single_choice','multi_choice','text','confirm')),
  options       jsonb not null default '[]'::jsonb,
  answer        jsonb,
  required      boolean not null default true,
  created_at    timestamptz not null default now(),
  answered_at   timestamptz,
  updated_at    timestamptz not null default now()
);
alter table public.project_job_questions enable row level security;
create index if not exists idx_pjq_job  on public.project_job_questions(job_id);
create index if not exists idx_pjq_open on public.project_job_questions(job_id) where answered_at is null;

drop policy if exists "pjq_select_members" on public.project_job_questions;
create policy "pjq_select_members" on public.project_job_questions for select to authenticated
  using (
    exists (
      select 1 from public.project_jobs j
      where j.id = job_id and public.can_access_project(j.project_id, auth.uid())
    )
  );

drop policy if exists "pjq_insert_member" on public.project_job_questions;
create policy "pjq_insert_member" on public.project_job_questions for insert to authenticated
  with check (
    exists (
      select 1 from public.project_jobs j
      where j.id = job_id and public.can_access_project(j.project_id, auth.uid())
    )
  );

drop policy if exists "pjq_update_member" on public.project_job_questions;
create policy "pjq_update_member" on public.project_job_questions for update to authenticated
  using (
    exists (
      select 1 from public.project_jobs j
      where j.id = job_id and public.can_access_project(j.project_id, auth.uid())
    )
  );

drop policy if exists "pjq_delete_admin" on public.project_job_questions;
create policy "pjq_delete_admin" on public.project_job_questions for delete to authenticated
  using (
    exists (
      select 1 from public.project_jobs j
      join public.projects p on p.id = j.project_id
      where j.id = job_id
        and public.has_workspace_role(p.workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[])
    )
  );

drop trigger if exists trg_pjq_touch on public.project_job_questions;
create trigger trg_pjq_touch before update on public.project_job_questions
  for each row execute function public.touch_updated_at();
