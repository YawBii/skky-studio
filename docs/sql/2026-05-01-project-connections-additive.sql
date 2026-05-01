-- Additive migration: extend project_connections with workspace_id, external_id, url.
-- Keeps repo_full_name, repo_url for backward compatibility.
-- Backfills from existing rows. Idempotent.

alter table public.project_connections
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists external_id  text,
  add column if not exists url          text,
  add column if not exists token_owner_type text not null default 'workspace'
    check (token_owner_type in ('workspace','user')),
  add column if not exists provider_account_id uuid;

-- Backfill: copy repo_full_name -> external_id, repo_url -> url where missing.
update public.project_connections
   set external_id = coalesce(external_id, repo_full_name)
 where external_id is null and repo_full_name is not null;

update public.project_connections
   set url = coalesce(url, repo_url)
 where url is null and repo_url is not null;

-- Backfill workspace_id from the project's workspace.
update public.project_connections pc
   set workspace_id = p.workspace_id
  from public.projects p
 where pc.project_id = p.id
   and pc.workspace_id is null;

create index if not exists idx_pc_workspace on public.project_connections(workspace_id);
create index if not exists idx_pc_provider_external on public.project_connections(provider, external_id);

-- Optional table to host per-user OAuth accounts in Phase 2. Created now so
-- provider_account_id has a valid target; no rows are required for Phase 1.
create table if not exists public.provider_accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null check (provider in ('github','gitlab','bitbucket','vercel','netlify','supabase')),
  external_login  text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, provider)
);
alter table public.provider_accounts enable row level security;

drop policy if exists "pa_select_self" on public.provider_accounts;
create policy "pa_select_self" on public.provider_accounts for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "pa_modify_self" on public.provider_accounts;
create policy "pa_modify_self" on public.provider_accounts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Add the FK now that the table exists. Idempotent.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_connections_provider_account_fk'
  ) then
    alter table public.project_connections
      add constraint project_connections_provider_account_fk
      foreign key (provider_account_id) references public.provider_accounts(id) on delete set null;
  end if;
end $$;
