// TODO(codex): wire to workspace_members table + invitations.
export type Role = "owner" | "admin" | "editor" | "viewer";
export interface Member { id: string; email: string; name: string; role: Role; lastActive: string }
export interface Invitation { id: string; email: string; role: Role; sentAt: string }

export async function listMembers(): Promise<Member[]> {
  return [
    { id: "u_1", email: "ana@skky.group",  name: "Ana Reyes",  role: "owner",  lastActive: "now" },
    { id: "u_2", email: "ben@skky.group",  name: "Ben Okafor", role: "admin",  lastActive: "2h ago" },
    { id: "u_3", email: "cleo@skky.group", name: "Cleo Park",  role: "editor", lastActive: "1d ago" },
    { id: "u_4", email: "dom@skky.group",  name: "Dom Singh",  role: "viewer", lastActive: "5d ago" },
  ];
}
export async function listInvitations(): Promise<Invitation[]> {
  return [{ id: "inv_1", email: "newhire@skky.group", role: "editor", sentAt: "1h ago" }];
}
export async function inviteMember(_email: string, _role: Role): Promise<void> {}
export async function updateRole(_userId: string, _role: Role): Promise<void> {}
export async function removeMember(_userId: string): Promise<void> {}
