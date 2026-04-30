# Collaboration schema

Migration: `supabase/migrations/20260430120000_collaboration_foundation.sql`

## Tables

| Table | Purpose |
| --- | --- |
| `workspaces` | A team / org container. |
| `workspace_members` | Membership + role. **Roles live here, never on `profiles`**. |
| `workspace_invites` | Pending email invites with expiry + token. |
| `projects` | Apps inside a workspace. |
| `project_presence` | Live "who's here" per project (added to `supabase_realtime`). |
| `user_preferences` | Per-user JSON blob (UI layout, theme, split sizes). Private. |

## Roles (`workspace_role` enum)

`owner` → `admin` → `member` → `viewer`. Admins inherit member abilities.

## RLS summary

- `workspaces`: SELECT for members; INSERT by self; UPDATE by owner/admin; DELETE by owner.
- `workspace_members`: SELECT by same-workspace members; INSERT/UPDATE by owner/admin; DELETE by self or owner/admin.
- `workspace_invites`: full lifecycle restricted to owner/admin.
- `projects`: SELECT by members; INSERT/UPDATE by owner/admin/member (viewers can't write); DELETE by owner/admin.
- `project_presence`: SELECT by members of the project's workspace; users can only INSERT/UPDATE/DELETE their own rows.
- `user_preferences`: strictly private — `user_id = auth.uid()`.

All access checks use SECURITY DEFINER helpers (`is_workspace_member`,
`workspace_role_of`, `has_workspace_role`, `can_access_project`) to avoid
recursive RLS on `workspace_members`.

## Realtime

`project_presence` is added to the `supabase_realtime` publication for
`postgres_changes` and works as a fallback channel for the Supabase Realtime
**Presence** API used by `useProjectPresence`.

## How to apply

The migration runs automatically. To apply by hand, paste the file contents
into the Supabase SQL editor or run `supabase db push`.
