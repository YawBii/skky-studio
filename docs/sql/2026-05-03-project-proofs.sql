-- Per-build proof artifacts for the agentic build loop.
-- Apply in the external Supabase project (EXTERNAL_SUPABASE_URL).
create table if not exists public.project_proofs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  job_id uuid references public.project_jobs(id) on delete set null,
  workspace_id uuid,
  generator text not null default 'agentic-loop-v1',
  user_request text,
  plan jsonb not null default '{}'::jsonb,
  files_written jsonb not null default '[]'::jsonb,
  checks jsonb not null default '[]'::jsonb,
  repairs jsonb not null default '[]'::jsonb,
  critique jsonb not null default '{}'::jsonb,
  preview_source text,
  limitations jsonb not null default '[]'::jsonb,
  ok boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists project_proofs_project_idx
  on public.project_proofs (project_id, created_at desc);

alter table public.project_proofs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_proofs' and policyname = 'project_proofs_select_members'
  ) then
    create policy project_proofs_select_members on public.project_proofs
      for select to authenticated
      using (
        exists (
          select 1
          from public.projects p
          join public.workspace_members wm on wm.workspace_id = p.workspace_id
          where p.id = project_proofs.project_id
            and wm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_proofs' and policyname = 'project_proofs_insert_members'
  ) then
    create policy project_proofs_insert_members on public.project_proofs
      for insert to authenticated
      with check (
        exists (
          select 1
          from public.projects p
          join public.workspace_members wm on wm.workspace_id = p.workspace_id
          where p.id = project_proofs.project_id
            and wm.user_id = auth.uid()
        )
      );
  end if;
end$$;
