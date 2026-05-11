-- yawB GitHub repository inventory
-- Stores metadata for repositories accessible to your GitHub token.
-- Do not seed private repository names in source-controlled SQL. Use the sync function.

create table if not exists public.github_accounts (
  id uuid primary key default gen_random_uuid(),
  github_id bigint unique,
  login text not null unique,
  account_type text not null default 'User',
  avatar_url text,
  html_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz
);

create table if not exists public.github_repositories (
  id uuid primary key default gen_random_uuid(),
  github_id bigint not null unique,
  owner_login text not null,
  full_name text not null unique,
  name text not null,
  description text,
  html_url text not null,
  clone_url text,
  ssh_url text,
  default_branch text,
  visibility text,
  private boolean not null default false,
  fork boolean not null default false,
  archived boolean not null default false,
  disabled boolean not null default false,
  language text,
  homepage text,
  topics text[] not null default '{}',
  size_kb integer,
  stargazers_count integer not null default 0,
  forks_count integer not null default 0,
  open_issues_count integer not null default 0,
  license_key text,
  license_name text,
  pushed_at timestamptz,
  github_created_at timestamptz,
  github_updated_at timestamptz,
  permissions jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists github_repositories_owner_idx on public.github_repositories(owner_login);
create index if not exists github_repositories_visibility_idx on public.github_repositories(visibility);
create index if not exists github_repositories_language_idx on public.github_repositories(language);
create index if not exists github_repositories_updated_idx on public.github_repositories(github_updated_at desc nulls last);
create index if not exists github_repositories_topics_idx on public.github_repositories using gin(topics);

create table if not exists public.github_repository_sync_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched_count integer not null default 0,
  upserted_count integer not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_github_accounts_updated_at on public.github_accounts;
create trigger touch_github_accounts_updated_at
before update on public.github_accounts
for each row execute function public.touch_updated_at();

drop trigger if exists touch_github_repositories_updated_at on public.github_repositories;
create trigger touch_github_repositories_updated_at
before update on public.github_repositories
for each row execute function public.touch_updated_at();

alter table public.github_accounts enable row level security;
alter table public.github_repositories enable row level security;
alter table public.github_repository_sync_runs enable row level security;

-- Authenticated yawB users can read the repository inventory inside the app.
drop policy if exists "Authenticated users can read github accounts" on public.github_accounts;
create policy "Authenticated users can read github accounts"
on public.github_accounts
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read github repositories" on public.github_repositories;
create policy "Authenticated users can read github repositories"
on public.github_repositories
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read github sync runs" on public.github_repository_sync_runs;
create policy "Authenticated users can read github sync runs"
on public.github_repository_sync_runs
for select
to authenticated
using (true);

-- Service role performs all sync writes.
grant select on public.github_accounts to authenticated;
grant select on public.github_repositories to authenticated;
grant select on public.github_repository_sync_runs to authenticated;

grant all on public.github_accounts to service_role;
grant all on public.github_repositories to service_role;
grant all on public.github_repository_sync_runs to service_role;

create or replace view public.yawb_repository_inventory_summary as
select
  count(*)::int as total_repositories,
  count(*) filter (where private)::int as private_repositories,
  count(*) filter (where not private)::int as public_repositories,
  count(*) filter (where archived)::int as archived_repositories,
  count(*) filter (where not archived and not disabled)::int as active_repositories,
  count(distinct owner_login)::int as owners,
  max(synced_at) as last_synced_at
from public.github_repositories;

grant select on public.yawb_repository_inventory_summary to authenticated;

notify pgrst, 'reload schema';
