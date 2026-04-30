# Auth setup — external Supabase project

This project authenticates against an **external Supabase project**. The browser uses only the publishable/anon key — never the service-role key.

## 1. Configure environment variables

Edit the project's `.env` file:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-or-anon-key>
```

These are build-time, browser-safe values (RLS enforces all access). Restart the dev server after editing.

## 2. Run the SQL below

Schema changes are NOT applied automatically. Open your external project's **SQL Editor** and run the script once. It is idempotent — safe to re-run.

## What it creates

- `public.app_role` enum (`admin`, `member`)
- `public.user_roles` table with RLS + `has_role(uuid, app_role)` security-definer function
- `public.profiles` table with RLS (own-row read/update, admin read-all)
- `updated_at` trigger on `profiles`
- `handle_new_user()` trigger on `auth.users` that auto-creates a profile row and assigns the default `member` role on signup

## SQL to run

```sql
-- 1. Roles ----------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

drop policy if exists "user_roles_select_self" on public.user_roles;
create policy "user_roles_select_self"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_roles_admin_all" on public.user_roles;
create policy "user_roles_admin_all"
  on public.user_roles for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 2. Profiles -------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- 3. Auto-provision profile + default role on signup ---------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name',
             new.raw_user_meta_data->>'full_name',
             split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'member')
  on conflict (user_id, role) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

## Google OAuth

In your external Supabase project: **Authentication → Providers → Google** → enable, paste your Google OAuth client ID/secret, and add `https://<your-app-domain>` (and the Lovable preview URL) to the allowed redirect URLs.

## Configure Site URL

**Authentication → URL Configuration**:
- **Site URL**: your production domain
- **Redirect URLs**: include both production and preview URLs, plus `<origin>/reset-password`
