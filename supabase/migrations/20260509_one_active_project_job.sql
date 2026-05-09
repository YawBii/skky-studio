-- yawB job safety guard
--
-- Prevent a project from running multiple queued/running/waiting jobs at once.
-- This is the database-level backstop for the product rule:
--   Finish or cancel the current job before starting another build/repair/regenerate.
--
-- The client already single-flights identical job types. This index extends that
-- protection across all job types for the same project.

create unique index if not exists project_jobs_one_active_per_project
  on public.project_jobs (project_id)
  where status in ('queued', 'running', 'waiting_for_input');

comment on index public.project_jobs_one_active_per_project is
  'Only one queued/running/waiting job may exist per project. Keeps Build/Repair/Regenerate from overlapping.';
