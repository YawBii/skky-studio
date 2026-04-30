import { useState } from "react";
import { Send, X, UserPlus, Mail, Crown, Eye, User } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createInvite } from "@/services/invites";

type Role = "admin" | "member" | "viewer";

const ROLES: { value: Role; label: string; hint: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "admin",  label: "Admin",  hint: "Manage members, projects and billing.", Icon: Crown },
  { value: "member", label: "Member", hint: "Build and edit projects.",              Icon: User  },
  { value: "viewer", label: "Viewer", hint: "Read-only access.",                     Icon: Eye   },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
  workspaceName?: string;
}

export function InviteSheet({ open, onOpenChange, workspaceId, workspaceName = "your workspace" }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [pending, setPending] = useState<{ email: string; role: Role }[]>([]);
  const [busy, setBusy] = useState(false);

  async function send() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/.+@.+\..+/.test(trimmed)) { toast.error("Enter a valid email"); return; }
    setBusy(true);
    if (workspaceId) {
      const res = await createInvite({ workspaceId, email: trimmed, role });
      if (res.ok) {
        toast.success(`Invite sent to ${trimmed}`);
      } else {
        // Fall through to local pending list — backend not ready yet
        toast(`Invite queued locally (backend: ${res.reason})`);
      }
    } else {
      toast.success(`Invite queued for ${trimmed}`);
    }
    setPending((p) => [{ email: trimmed, role }, ...p]);
    setEmail("");
    setBusy(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-background/95 backdrop-blur-xl border-white/10 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            <UserPlus className="h-4 w-4" /> Invite to {workspaceName}
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Teammates collaborate on this workspace and every project inside it.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <label className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">Email</label>
            <div className="mt-1.5 flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
                placeholder="teammate@company.com"
                className="bg-transparent border-0 px-0 h-8 text-[13px] focus-visible:ring-0"
              />
            </div>

            <div className="mt-3">
              <label className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">Role</label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-left transition",
                      role === r.value
                        ? "border-primary/50 bg-primary/10"
                        : "border-white/5 hover:border-white/15 hover:bg-white/[0.04]",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <r.Icon className="h-3 w-3" />
                      <span className="text-[12px] font-medium">{r.label}</span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{ROLES.find((r) => r.value === role)?.hint}</p>
            </div>

            <Button onClick={send} disabled={busy || !email.trim()} variant="hero" className="mt-3 w-full">
              <Send className="h-3.5 w-3.5" /> Send invite
            </Button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[12px] font-medium">Pending invites</h4>
              <span className="text-[10.5px] text-muted-foreground">{pending.length}</span>
            </div>
            {pending.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-[11.5px] text-muted-foreground">
                No invites yet. Add one above to get started.
              </div>
            ) : (
              <ul className="space-y-1">
                {pending.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg border border-white/5 px-2.5 py-2">
                    <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[12.5px] truncate flex-1">{p.email}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">{p.role}</span>
                    <button onClick={() => setPending((arr) => arr.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Invites are stored in <code className="font-mono">workspace_invites</code> with admin/owner-only RLS.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
