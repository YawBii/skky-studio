# Collaboration schema

SQL: [`docs/sql/2026-04-30-collaboration.sql`](./sql/2026-04-30-collaboration.sql)

> Lovable Cloud was enabled against an existing Supabase project (env vars
> only — no migration tool wired in this session). To apply the schema, copy
> the SQL file into the Supabase SQL editor for that project and run it.
> The script is idempotent (uses `if not exists` / `drop policy if exists`).

## Tables

| Table               | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `workspaces`        | Team / org container.                                         |
| `workspace_members` | Membership + role. **Roles live here, never on `profiles`.**  |
| `workspace_invites` | Pending email invites with expiry + token.                    |
| `projects`          | Apps inside a workspace.                                      |
| `project_presence`  | Live "who's here" per project (added to `supabase_realtime`). |
| `user_preferences`  | Per-user JSON blob (UI layout, theme, split sizes). Private.  |

## Roles (`workspace_role` enum)

`owner` → `admin` → `member` → `viewer`. Owners and admins manage members
and invites; members can create/update projects; viewers are read-only.

## RLS summary

- `workspaces` — SELECT for members; INSERT by self; UPDATE owner/admin; DELETE owner.
- `workspace_members` — SELECT same-workspace members; INSERT/UPDATE owner/admin; DELETE self or owner/admin.
- `workspace_invites` — full lifecycle restricted to owner/admin.
- `projects` — SELECT members; INSERT/UPDATE owner/admin/member (viewers can't write); DELETE owner/admin.
- `project_presence` — SELECT members of project's workspace; users can only INSERT/UPDATE/DELETE their own rows.
- `user_preferences` — strictly private (`user_id = auth.uid()`).

All checks use SECURITY DEFINER helpers (`is_workspace_member`,
`has_workspace_role`, `can_access_project`) so RLS on `workspace_members`
is not recursive.

## Realtime

`project_presence` is added to the `supabase_realtime` publication. The
`useProjectPresence` hook prefers the Supabase Realtime **Presence**
channel API, with `postgres_changes` as a fallback signal.
