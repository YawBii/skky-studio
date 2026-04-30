-- Collaboration foundation: workspaces, members, invites, projects, presence, prefs
-- All tables RLS-enabled. Roles stored in workspace_members (NOT on profiles).
-- Run this in Supabase SQL editor for your existing project.

do $$ begin
  create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
exception when duplicate_object then null; end $$;

-- ============ workspaces ============
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  created_by  uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.workspaces enable row level security;

-- ============ workspace_members ============
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         public.workspace_role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
alter table public.workspace_members enable row level security;
create index if not exists idx_workspace_members_user on public.workspace_members(user_id);

-- ============ workspace_invites ============
create table if not exists public.workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email        text not null check (length(email) <= 254),
  role         public.workspace_role not null default 'member',
  token        text not null unique,
  invited_by   uuid not null references auth.users(id) on delete restrict,
  accepted_at  timestamptz,
  expires_at   timestamptz not null default (now() + interval '14 days'),
  created_at   timestamptz not null default now()
);
alter table public.workspace_invites enable row level security;
create index if not exists idx_workspace_invites_workspace on public.workspace_invites(workspace_id);

-- ============ projects ============
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null check (length(name) between 1 and 80),
  slug         text not null check (slug ~ '^[a-z0-9-]{1,60}$'),
  description  text check (length(description) <= 500),
  created_by   uuid not null references auth.users(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, slug)
);
alter table public.projects enable row level security;
create index if not exists idx_projects_workspace on public.projects(workspace_id);

-- ============ project_presence ============
create table if not exists public.project_presence (
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  session_id  text not null,
  status      text not null default 'online' check (status in ('editing','viewing','online','offline')),
  page_path   text,
  last_seen   timestamptz not null default now(),
  primary key (project_id, user_id, session_id)
);
alter table public.project_presence enable row level security;
create index if not exists idx_presence_project on public.project_presence(project_id);

-- ============ user_preferences ============
create table if not exists public.user_preferences (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.user_preferences enable row level security;

-- ===================================================================
-- Security definer helpers (avoid recursive RLS)
-- ===================================================================
create or replace function public.is_workspace_member(_workspace_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id and user_id = _user_id
  );
$$;

create or replace function public.has_workspace_role(_workspace_id uuid, _user_id uuid, _roles public.workspace_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id and user_id = _user_id and role = any(_roles)
  );
$$;

create or replace function public.can_access_project(_project_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    join public.workspace_members wm on wm.workspace_id = p.workspace_id and wm.user_id = _user_id
    where p.id = _project_id
  );
$$;

-- ===================================================================
-- RLS POLICIES
-- ===================================================================

-- workspaces
drop policy if exists "ws_select_members" on public.workspaces;
create policy "ws_select_members" on public.workspaces for select to authenticated
  using (public.is_workspace_member(id, auth.uid()));
drop policy if exists "ws_insert_self" on public.workspaces;
create policy "ws_insert_self" on public.workspaces for insert to authenticated
  with check (created_by = auth.uid());
drop policy if exists "ws_update_admin" on public.workspaces;
create policy "ws_update_admin" on public.workspaces for update to authenticated
  using (public.has_workspace_role(id, auth.uid(), array['owner','admin']::public.workspace_role[]))
  with check (public.has_workspace_role(id, auth.uid(), array['owner','admin']::public.workspace_role[]));
drop policy if exists "ws_delete_owner" on public.workspaces;
create policy "ws_delete_owner" on public.workspaces for delete to authenticated
  using (public.has_workspace_role(id, auth.uid(), array['owner']::public.workspace_role[]));

-- workspace_members
drop policy if exists "wm_select_same_workspace" on public.workspace_members;
create policy "wm_select_same_workspace" on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
drop policy if exists "wm_insert_admin" on public.workspace_members;
create policy "wm_insert_admin" on public.workspace_members for insert to authenticated
  with check (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[]));
drop policy if exists "wm_update_admin" on public.workspace_members;
create policy "wm_update_admin" on public.workspace_members for update to authenticated
  using (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[]));
drop policy if exists "wm_delete_admin_or_self" on public.workspace_members;
create policy "wm_delete_admin_or_self" on public.workspace_members for delete to authenticated
  using (user_id = auth.uid()
         or public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[]));

-- workspace_invites (admin/owner only)
drop policy if exists "wi_select_admin" on public.workspace_invites;
create policy "wi_select_admin" on public.workspace_invites for select to authenticated
  using (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[]));
drop policy if exists "wi_insert_admin" on public.workspace_invites;
create policy "wi_insert_admin" on public.workspace_invites for insert to authenticated
  with check (invited_by = auth.uid()
              and public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[]));
drop policy if exists "wi_delete_admin" on public.workspace_invites;
create policy "wi_delete_admin" on public.workspace_invites for delete to authenticated
  using (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[]));

-- projects
drop policy if exists "p_select_members" on public.projects;
create policy "p_select_members" on public.projects for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
drop policy if exists "p_insert_member" on public.projects;
create policy "p_insert_member" on public.projects for insert to authenticated
  with check (created_by = auth.uid()
              and public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin','member']::public.workspace_role[]));
drop policy if exists "p_update_member" on public.projects;
create policy "p_update_member" on public.projects for update to authenticated
  using (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin','member']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin','member']::public.workspace_role[]));
drop policy if exists "p_delete_admin" on public.projects;
create policy "p_delete_admin" on public.projects for delete to authenticated
  using (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.workspace_role[]));

-- project_presence
drop policy if exists "pp_select_members" on public.project_presence;
create policy "pp_select_members" on public.project_presence for select to authenticated
  using (public.can_access_project(project_id, auth.uid()));
drop policy if exists "pp_insert_self" on public.project_presence;
create policy "pp_insert_self" on public.project_presence for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_project(project_id, auth.uid()));
drop policy if exists "pp_update_self" on public.project_presence;
create policy "pp_update_self" on public.project_presence for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "pp_delete_self" on public.project_presence;
create policy "pp_delete_self" on public.project_presence for delete to authenticated
  using (user_id = auth.uid());

-- user_preferences (private to owner)
drop policy if exists "up_select_self" on public.user_preferences;
create policy "up_select_self" on public.user_preferences for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "up_insert_self" on public.user_preferences;
create policy "up_insert_self" on public.user_preferences for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "up_update_self" on public.user_preferences;
create policy "up_update_self" on public.user_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===================================================================
-- Triggers
-- ===================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_workspaces_touch on public.workspaces;
create trigger trg_workspaces_touch before update on public.workspaces
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_projects_touch on public.projects;
create trigger trg_projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_user_prefs_touch on public.user_preferences;
create trigger trg_user_prefs_touch before update on public.user_preferences
  for each row execute function public.touch_updated_at();

create or replace function public.workspace_seed_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner') on conflict do nothing;
  return new;
end $$;
drop trigger if exists trg_workspace_seed_owner on public.workspaces;
create trigger trg_workspace_seed_owner after insert on public.workspaces
  for each row execute function public.workspace_seed_owner();

-- Realtime publication
do $$ begin
  alter publication supabase_realtime add table public.project_presence;
exception when duplicate_object then null; when undefined_object then null; end $$;
