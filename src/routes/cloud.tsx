import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Database, Shield, FolderArchive, KeyRound, Zap, ScrollText, Plus, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cloud, supabaseSvc } from "@/services";
// TODO(codex): wire all reads/writes to Lovable Cloud admin client

export const Route = createFileRoute("/cloud")({
  head: () => ({
    meta: [{ title: "Cloud — yawB" }, { name: "description", content: "Database, auth, storage, secrets, functions and logs." }],
  }),
  component: CloudPage,
});

type Tab = "database" | "auth" | "storage" | "secrets" | "functions" | "logs";
const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: "database",  label: "Database",  icon: Database },
  { id: "auth",      label: "Users",     icon: Shield },
  { id: "storage",   label: "Storage",   icon: FolderArchive },
  { id: "secrets",   label: "Secrets",   icon: KeyRound },
  { id: "functions", label: "Functions", icon: Zap },
  { id: "logs",      label: "Logs",      icon: ScrollText },
];

function CloudPage() {
  const [tab, setTab] = useState<Tab>("database");
  return (
    <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Cloud</div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Backend platform</h1>
          <p className="text-muted-foreground mt-1">Database, auth, storage, secrets, functions, logs — all in one place.</p>
        </div>
        <div className="text-xs text-muted-foreground glass rounded-full px-3 py-1.5">
          <span className="h-1.5 w-1.5 inline-block rounded-full bg-success mr-2 align-middle" />
          eu-west-1 · operational
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-white/5 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("inline-flex items-center gap-2 px-4 h-10 text-sm border-b-2 transition-colors -mb-px",
              tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "database"  && <DatabaseTab />}
      {tab === "auth"      && <AuthTab />}
      {tab === "storage"   && <StorageTab />}
      {tab === "secrets"   && <SecretsTab />}
      {tab === "functions" && <FunctionsTab />}
      {tab === "logs"      && <LogsTab />}
    </div>
  );
}

function Section({ title, action, children }: any) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold">{title}</h2>
        {action}
      </div>
      <div className="rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">{children}</div>
    </section>
  );
}

function DatabaseTab() {
  const [tables, setTables] = useState<any[]>([]);
  useEffect(() => { supabaseSvc.listTables("demo").then(setTables); }, []);
  return (
    <Section title="Tables" action={<Button variant="soft" size="sm"><Plus className="h-3.5 w-3.5" /> New table</Button>}>
      <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-white/5">
        <div className="col-span-5">Table</div><div className="col-span-3">Rows</div><div className="col-span-2">RLS</div><div className="col-span-2">Status</div>
      </div>
      {tables.map((t) => (
        <div key={t.name} className="grid grid-cols-12 px-4 py-3 text-sm border-b border-white/5 last:border-0 items-center hover:bg-white/[0.02]">
          <div className="col-span-5 font-mono text-xs">{t.name}</div>
          <div className="col-span-3 tabular-nums text-muted-foreground">{t.rows.toLocaleString()}</div>
          <div className="col-span-2">{t.rls ? <span className="text-success text-xs">enabled</span> : <span className="text-warning text-xs">disabled</span>}</div>
          <div className="col-span-2 text-xs">
            {t.status === "ok" && <span className="text-success">healthy</span>}
            {t.status === "warn" && <span className="text-warning">warn</span>}
            {t.status === "missing" && <span className="text-destructive">missing</span>}
          </div>
        </div>
      ))}
    </Section>
  );
}

function AuthTab() {
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => { cloud.listAuthUsers().then(setUsers); }, []);
  return (
    <Section title="Auth users" action={<Button variant="soft" size="sm"><Plus className="h-3.5 w-3.5" /> Invite user</Button>}>
      <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-white/5">
        <div className="col-span-5">Email</div><div className="col-span-2">Provider</div><div className="col-span-3">Last sign in</div><div className="col-span-2">Created</div>
      </div>
      {users.map((u) => (
        <div key={u.id} className="grid grid-cols-12 px-4 py-3 text-sm border-b border-white/5 last:border-0 items-center hover:bg-white/[0.02]">
          <div className="col-span-5 font-mono text-xs">{u.email}</div>
          <div className="col-span-2 text-xs uppercase tracking-wider text-muted-foreground">{u.provider}</div>
          <div className="col-span-3 text-xs text-muted-foreground">{u.lastSignIn}</div>
          <div className="col-span-2 text-xs text-muted-foreground">{u.created}</div>
        </div>
      ))}
    </Section>
  );
}

function StorageTab() {
  const [buckets, setBuckets] = useState<any[]>([]);
  useEffect(() => { supabaseSvc.listBuckets("demo").then(setBuckets); }, []);
  return (
    <Section title="Storage buckets" action={<Button variant="soft" size="sm"><Plus className="h-3.5 w-3.5" /> New bucket</Button>}>
      <div className="divide-y divide-white/5">
        {buckets.map((b) => (
          <div key={b.name} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02]">
            <FolderArchive className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-mono">{b.name}</div>
              <div className="text-xs text-muted-foreground">{b.objects.toLocaleString()} objects · {b.size}</div>
            </div>
            <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", b.public ? "border-warning/30 text-warning" : "border-success/30 text-success")}>
              {b.public ? "public" : "private"}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function SecretsTab() {
  const [secrets, setSecrets] = useState<any[]>([]);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  useEffect(() => { cloud.listSecrets().then(setSecrets); }, []);
  return (
    <Section title="Secrets" action={<Button variant="soft" size="sm"><Plus className="h-3.5 w-3.5" /> Add secret</Button>}>
      <div className="divide-y divide-white/5">
        {secrets.map((s) => (
          <div key={s.name} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02]">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-mono">{s.name} {s.managed && <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-2">managed</span>}</div>
              <div className="text-xs text-muted-foreground font-mono">{reveal[s.name] ? "sk_live_" + s.name.toLowerCase() + "_demo" : "•••••••••••••••••••"}</div>
            </div>
            <span className="text-xs text-muted-foreground">{s.updated}</span>
            <Button variant="ghost" size="icon" onClick={() => setReveal(r => ({ ...r, [s.name]: !r[s.name] }))}>
              {reveal[s.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FunctionsTab() {
  const [fns, setFns] = useState<any[]>([]);
  useEffect(() => { cloud.listFunctions().then(setFns); }, []);
  return (
    <Section title="Edge functions" action={<Button variant="soft" size="sm"><Plus className="h-3.5 w-3.5" /> New function</Button>}>
      <div className="divide-y divide-white/5">
        {fns.map((f) => (
          <div key={f.name} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02]">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-mono">{f.name}</div>
              <div className="text-xs text-muted-foreground">{f.runtime} · last invoked {f.lastInvocation}</div>
            </div>
            <span className="text-xs text-success">{f.status}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { cloud.streamLogs().then(setLogs); }, []);
  return (
    <Section title="Live logs" action={<Button variant="soft" size="sm"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>}>
      <div className="font-mono text-xs divide-y divide-white/5">
        {logs.map((l, i) => (
          <div key={i} className="px-4 py-2.5 grid grid-cols-12 gap-3 items-start hover:bg-white/[0.02]">
            <span className="col-span-2 text-muted-foreground">{l.ts}</span>
            <span className={cn("col-span-1 uppercase text-[10px] tracking-wider",
              l.level === "info" && "text-muted-foreground",
              l.level === "warn" && "text-warning",
              l.level === "error" && "text-destructive")}>{l.level}</span>
            <span className="col-span-2 text-foreground/70">{l.source}</span>
            <span className="col-span-7">{l.message}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}
