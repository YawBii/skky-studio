import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2, Save, Database, AlertCircle, Server, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — yawB" },
      { name: "description", content: "Workspace preferences and account settings." },
    ],
  }),
  component: SettingsPage,
});

const tabs = [
  "Profile",
  "Workspace",
  "Notifications",
  "Appearance",
  "Security",
  "Danger zone",
] as const;
type Tab = (typeof tabs)[number];

function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Profile");
  return (
    <div className="px-6 md:px-10 py-8 max-w-[1100px] mx-auto">
      <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-1">Settings</h1>
      <p className="text-muted-foreground mb-8">Workspace preferences and account settings.</p>

      <div className="grid md:grid-cols-[200px_1fr] gap-8">
        <nav className="space-y-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                tab === t
                  ? "bg-white/[0.07] text-foreground"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="rounded-2xl border border-white/5 bg-gradient-card p-6">
          {tab === "Profile" && <ProfilePane />}
          {tab === "Workspace" && <WorkspacePane />}
          {tab === "Notifications" && <NotificationsPane />}
          {tab === "Appearance" && <AppearancePane />}
          {tab === "Security" && <SecurityPane />}
          {tab === "Danger zone" && <DangerPane />}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">{label}</div>
      {children}
    </label>
  );
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-white/10 bg-background/50 px-3 h-10 text-sm focus:outline-none focus:border-white/20"
    />
  );
}

function ProfilePane() {
  return (
    <div className="space-y-5">
      <h2 className="font-display font-semibold">Profile</h2>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-white/10 border border-white/10 grid place-items-center font-semibold">
          AR
        </div>
        <div className="flex gap-2">
          <Button variant="soft" size="sm" onClick={() => toast("Avatar upload coming soon")}>
            Upload
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toast("Avatar removed")}>
            Remove
          </Button>
        </div>
      </div>
      <Field label="Full name">
        <Input defaultValue="Ana Reyes" />
      </Field>
      <Field label="Email">
        <Input defaultValue="ana@skky.group" type="email" />
      </Field>
      <Field label="Job title">
        <Input defaultValue="Head of Engineering" />
      </Field>
      <Button variant="hero" onClick={() => toast.success("Profile saved")}>
        <Save className="h-4 w-4" /> Save changes
      </Button>
    </div>
  );
}
function WorkspacePane() {
  const { current, source, error, isReal, loading } = useWorkspaces();
  const { session } = useAuth();

  const sourceLabel =
    source === "supabase"
      ? { text: "Live · Lovable Cloud", tone: "ok" as const }
      : source === "demo-empty"
        ? { text: "No workspace yet", tone: "warn" as const }
        : source === "error"
          ? { text: "Cloud query failed", tone: "err" as const }
          : { text: "Demo (signed-out preview)", tone: "warn" as const };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display font-semibold">Workspace</h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] uppercase tracking-[0.16em] border",
            sourceLabel.tone === "ok" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
            sourceLabel.tone === "warn" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
            sourceLabel.tone === "err" &&
              "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          <Database className="h-3 w-3" /> {sourceLabel.text}
        </span>
      </div>

      {!isReal && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[12px] text-muted-foreground flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            {source === "demo-fallback" && (
              <>
                You're not signed in, so this shows demo data. Sign in to see your real workspace.
              </>
            )}
            {source === "demo-empty" && (
              <>
                No workspace exists yet for{" "}
                <span className="font-mono">{session?.userId ?? "this user"}</span>. Create one from
                the home screen.
              </>
            )}
            {source === "error" && (
              <>
                Couldn't read from Lovable Cloud.{" "}
                {error && <span className="block mt-1 break-words">{error}</span>}
                <span className="block mt-1">
                  Run <code className="font-mono">docs/sql/2026-04-30-collaboration.sql</code> in
                  the Cloud SQL editor.
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <Field label="Workspace name">
        <Input
          value={loading ? "Loading…" : (current?.name ?? "")}
          readOnly
          placeholder="No workspace"
        />
      </Field>
      <Field label="Workspace slug">
        <Input value={loading ? "" : (current?.slug ?? "")} readOnly placeholder="no-workspace" />
      </Field>
      <Field label="Workspace ID">
        <Input value={current?.id ?? ""} readOnly placeholder="—" />
      </Field>
      <Field label="Your role">
        <Input value={current?.role ?? "—"} readOnly />
      </Field>
      <Field label="Default region">
        <select className="w-full rounded-lg border border-white/10 bg-background/50 px-3 h-10 text-sm focus:outline-none">
          <option>eu-west-1 (Ireland)</option>
          <option>us-east-1 (Virginia)</option>
          <option>ap-south-1 (Mumbai)</option>
        </select>
      </Field>
      <Button variant="hero" disabled={!isReal} onClick={() => toast.success("Workspace saved")}>
        <Save className="h-4 w-4" /> Save changes
      </Button>

      <Link
        to="/server-setup"
        className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 hover:bg-white/[0.05] transition-colors"
      >
        <span className="flex items-center gap-3">
          <Server className="h-4 w-4 text-muted-foreground" />
          <span>
            <span className="block text-sm font-medium">Server Setup</span>
            <span className="block text-xs text-muted-foreground">
              Check server-side env vars (build runner, Supabase, GitHub, Vercel).
            </span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  );
}
function NotificationsPane() {
  const items = [
    "Deploy succeeded",
    "Deploy failed",
    "New pull request",
    "Health scan finds issues",
    "Billing alerts",
    "Weekly summary",
  ];
  return (
    <div className="space-y-3">
      <h2 className="font-display font-semibold">Notifications</h2>
      {items.map((i) => (
        <label
          key={i}
          className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0"
        >
          <span className="text-sm">{i}</span>
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" defaultChecked className="accent-foreground" /> Email
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" className="accent-foreground" /> Slack
            </label>
          </span>
        </label>
      ))}
    </div>
  );
}
function AppearancePane() {
  return (
    <div className="space-y-5">
      <h2 className="font-display font-semibold">Appearance</h2>
      <Field label="Theme">
        <div className="grid grid-cols-3 gap-3">
          {["Dark", "Light", "System"].map((t, i) => (
            <button
              key={t}
              className={cn(
                "rounded-xl border px-4 py-6 text-sm",
                i === 0
                  ? "border-foreground/40 bg-white/5"
                  : "border-white/10 hover:bg-white/[0.03]",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Density">
        <select className="w-full rounded-lg border border-white/10 bg-background/50 px-3 h-10 text-sm focus:outline-none">
          <option>Comfortable</option>
          <option>Compact</option>
        </select>
      </Field>
    </div>
  );
}
function SecurityPane() {
  return (
    <div className="space-y-5">
      <h2 className="font-display font-semibold">Security</h2>
      <div className="rounded-xl border border-white/10 p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Two-factor authentication</div>
          <div className="text-xs text-muted-foreground">
            Add an extra layer of security to your account.
          </div>
        </div>
        <Button variant="soft" size="sm" onClick={() => toast("2FA setup coming soon")}>
          Enable
        </Button>
      </div>
      <div className="rounded-xl border border-white/10 p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Active sessions</div>
          <div className="text-xs text-muted-foreground">2 devices currently signed in.</div>
        </div>
        <Button variant="soft" size="sm" onClick={() => toast("Session management coming soon")}>
          Manage
        </Button>
      </div>
      <div className="rounded-xl border border-white/10 p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Personal access tokens</div>
          <div className="text-xs text-muted-foreground">Use tokens for CLI and API access.</div>
        </div>
        <Button variant="soft" size="sm" onClick={() => toast("Token generation coming soon")}>
          Generate
        </Button>
      </div>
    </div>
  );
}
function DangerPane() {
  return (
    <div className="space-y-5">
      <h2 className="font-display font-semibold text-destructive">Danger zone</h2>
      <div className="rounded-xl border border-destructive/30 p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Delete workspace</div>
          <div className="text-xs text-muted-foreground">
            This permanently deletes the current workspace and all its projects.
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            if (confirm("Permanently delete this workspace and all projects?")) {
              toast.error("Workspace deletion is not enabled yet");
            }
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
    </div>
  );
}
