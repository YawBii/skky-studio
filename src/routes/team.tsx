import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { team } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "Team — yawB" }, { name: "description", content: "Manage members, roles and invitations." }] }),
  component: TeamPage,
});

const roleColor: Record<string, string> = {
  owner:  "border-foreground/30 text-foreground",
  admin:  "border-accent/30 text-accent",
  editor: "border-success/30 text-success",
  viewer: "border-white/10 text-muted-foreground",
};

function TeamPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  useEffect(() => {
    team.listMembers().then(setMembers);
    team.listInvitations().then(setInvitations);
  }, []);

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1100px] mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground mt-1">{members.length} members · {invitations.length} pending invitation{invitations.length !== 1 && "s"}</p>
        </div>
        <Button variant="hero" size="lg"><Plus /> Invite member</Button>
      </div>

      <div className="rounded-2xl border border-white/5 bg-gradient-card overflow-hidden mb-8">
        <div className="grid grid-cols-12 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-white/5">
          <div className="col-span-5">Member</div><div className="col-span-3">Role</div><div className="col-span-3">Last active</div><div className="col-span-1"></div>
        </div>
        {members.map((m) => (
          <div key={m.id} className="grid grid-cols-12 px-5 py-3 text-sm border-b border-white/5 last:border-0 items-center hover:bg-white/[0.02]">
            <div className="col-span-5 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-white/10 border border-white/10 grid place-items-center text-xs font-semibold">
                {m.name.split(" ").map((n: string) => n[0]).join("")}
              </div>
              <div>
                <div className="text-sm font-medium">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
              </div>
            </div>
            <div className="col-span-3"><span className={cn("text-[11px] px-2 py-1 rounded-full border capitalize", roleColor[m.role])}>{m.role}</span></div>
            <div className="col-span-3 text-xs text-muted-foreground">{m.lastActive}</div>
            <div className="col-span-1 text-right"><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></div>
          </div>
        ))}
      </div>

      {invitations.length > 0 && (
        <>
          <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-3">Pending invitations</h2>
          <div className="rounded-2xl border border-white/5 bg-gradient-card divide-y divide-white/5">
            {invitations.map((i) => (
              <div key={i.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-sm font-mono">{i.email}</div>
                  <div className="text-xs text-muted-foreground">Sent {i.sentAt} · role: {i.role}</div>
                </div>
                <Button variant="soft" size="sm">Resend</Button>
                <Button variant="ghost" size="sm">Revoke</Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
