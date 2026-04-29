import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  MessageSquare, Eye, Code2, Database, Rocket, ArrowLeft, Send, Sparkles,
  CheckCircle2, ExternalLink, GitBranch, Play, RefreshCw, Smartphone, Monitor, Tablet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { projects, chatHistory } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/builder/$projectId")({
  head: ({ params }) => ({
    meta: [
      { title: `Builder — ${params.projectId} | yawB` },
      { name: "description", content: "Chat, preview, code, database and deploy — all in one workspace." },
    ],
  }),
  loader: ({ params }) => {
    const project = projects.find(p => p.id === params.projectId);
    if (!project) throw notFound();
    return { project };
  },
  errorComponent: ({ error }) => <div className="p-10">Error: {error.message}</div>,
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-display font-bold">Project not found</h1>
      <Link to="/" className="text-primary text-sm mt-3 inline-block">← Back to dashboard</Link>
    </div>
  ),
  component: Builder,
});

type Tab = "preview" | "code" | "database" | "deploy";

function Builder() {
  const { project } = Route.useLoaderData() as { project: typeof projects[number] };
  const [tab, setTab] = useState<Tab>("preview");
  const [messages, setMessages] = useState(chatHistory);
  const [input, setInput] = useState("");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const send = () => {
    if (!input.trim()) return;
    setMessages([...messages, { role: "user", content: input }]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [...m, {
        role: "assistant",
        content: "On it — I'll plan the change, implement it, run a verification pass, and show you a proof report before declaring done.",
      }]);
    }, 700);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="h-14 shrink-0 border-b border-white/5 bg-sidebar/60 backdrop-blur-xl px-4 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display font-semibold truncate">{project.name}</span>
          <StatusBadge status={project.status} />
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {(["preview","code","database","deploy"] as Tab[]).map((t) => {
            const Icon = { preview: Eye, code: Code2, database: Database, deploy: Rocket }[t];
            return (
              <button key={t} onClick={() => setTab(t)}
                className={cn("inline-flex items-center gap-2 rounded-lg px-3 h-9 text-sm capitalize transition-all",
                  tab === t ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5")}>
                <Icon className="h-4 w-4" />{t}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 ml-2 pl-3 border-l border-white/5">
          <Button variant="soft" size="sm"><GitBranch className="h-3.5 w-3.5" /> PR</Button>
          <Button variant="hero" size="sm"><Rocket className="h-3.5 w-3.5" /> Deploy</Button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Chat */}
        <section className="w-[400px] shrink-0 border-r border-white/5 flex flex-col bg-sidebar/40">
          <div className="px-4 h-12 border-b border-white/5 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Chat</span>
            <span className="ml-auto text-[11px] text-muted-foreground">yawB Agent</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                <div className={cn("h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-semibold",
                  m.role === "user" ? "bg-white/10" : "bg-gradient-brand text-primary-foreground")}>
                  {m.role === "user" ? "SG" : <Sparkles className="h-3.5 w-3.5" />}
                </div>
                <div className={cn("rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap",
                  m.role === "user" ? "bg-white/5" : "bg-gradient-card border border-white/5")}>
                  {m.content}
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-success/20 bg-success/5 p-3 text-xs flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-success mb-0.5">Proof report</div>
                <div className="text-muted-foreground">Build ✓ · Tests 12/12 ✓ · Lighthouse 98 ✓ · No console errors</div>
              </div>
            </div>
          </div>
          <div className="p-3 border-t border-white/5">
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-background/60 p-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask yawB to change anything…"
                rows={2}
                className="flex-1 resize-none bg-transparent text-sm focus:outline-none px-2 py-1.5"
              />
              <Button variant="hero" size="icon" onClick={send}><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </section>

        {/* Main panel */}
        <section className="flex-1 min-w-0 flex flex-col bg-background/60">
          {tab === "preview" && <PreviewPanel device={device} setDevice={setDevice} project={project} />}
          {tab === "code" && <CodePanel />}
          {tab === "database" && <DatabasePanel />}
          {tab === "deploy" && <DeployPanel />}
        </section>
      </div>
    </div>
  );
}

function PreviewPanel({ device, setDevice, project }: any) {
  const widths = { desktop: "100%", tablet: "820px", mobile: "390px" };
  return (
    <>
      <div className="h-12 border-b border-white/5 px-4 flex items-center gap-2">
        <Button variant="ghost" size="icon"><RefreshCw className="h-4 w-4" /></Button>
        <div className="flex-1 mx-3 h-8 rounded-lg bg-white/5 border border-white/5 px-3 flex items-center text-xs text-muted-foreground gap-2">
          <ExternalLink className="h-3 w-3" /> https://{project.url}
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5">
          {[{k:"desktop",I:Monitor},{k:"tablet",I:Tablet},{k:"mobile",I:Smartphone}].map(({k,I}) => (
            <button key={k} onClick={() => setDevice(k)}
              className={cn("h-7 w-7 rounded grid place-items-center", device===k?"bg-white/10":"text-muted-foreground hover:text-foreground")}>
              <I className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 grid place-items-start justify-center">
        <div style={{ width: widths[device as keyof typeof widths] }} className="transition-all w-full max-w-full">
          <div className="rounded-2xl border border-white/10 bg-gradient-card overflow-hidden shadow-elevated aspect-[16/10] relative">
            <div className="relative h-full flex flex-col p-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-7 w-7 rounded-lg bg-white/10 border border-white/10" />
                <span className="font-display font-semibold">{project.name}</span>
              </div>
              <div className="my-auto text-center">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Live preview</div>
                <h2 className="mt-2 text-3xl font-display font-bold">Welcome back, Skky team</h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">Your latest build is live and verified.</p>
                <Button variant="hero" className="mt-5"><Play className="h-3.5 w-3.5" /> Explore</Button>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-6">
                {[1,2,3].map((i) => (
                  <div key={i} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                    <div className="h-2 w-12 rounded bg-white/10 mb-2" />
                    <div className="h-4 w-20 rounded bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CodePanel() {
  const files = ["src/routes/index.tsx","src/routes/settings.tsx","src/components/header.tsx","src/lib/db.ts"];
  return (
    <div className="flex-1 flex min-h-0">
      <div className="w-56 border-r border-white/5 p-3 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground px-2 mb-2">Files</div>
        {files.map((f, i) => (
          <button key={f} className={cn("w-full text-left text-xs px-2 py-1.5 rounded font-mono", i===1?"bg-white/10":"hover:bg-white/5 text-muted-foreground")}>{f}</button>
        ))}
      </div>
      <pre className="flex-1 overflow-auto p-6 text-xs font-mono leading-relaxed text-muted-foreground">
{`import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/components/profile-form";
import { BillingPanel } from "@/components/billing-panel";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto py-10">
      `}<span className="text-foreground">{`<Tabs defaultValue="profile">`}</span>{`
        `}<span className="text-foreground">{`<TabsList>`}</span>{`
          `}<span className="text-primary">{`<TabsTrigger value="profile">Profile</TabsTrigger>`}</span>{`
          `}<span className="text-primary">{`<TabsTrigger value="billing">Billing</TabsTrigger>`}</span>{`
        `}<span className="text-foreground">{`</TabsList>`}</span>{`
        `}<span className="text-foreground">{`<TabsContent value="profile"><ProfileForm /></TabsContent>`}</span>{`
        `}<span className="text-foreground">{`<TabsContent value="billing"><BillingPanel /></TabsContent>`}</span>{`
      `}<span className="text-foreground">{`</Tabs>`}</span>{`
    </div>
  );
}`}
      </pre>
    </div>
  );
}

function DatabasePanel() {
  const tables = [
    { name: "users", rows: 1284, rls: true, status: "ok" },
    { name: "organizations", rows: 42, rls: true, status: "ok" },
    { name: "subscriptions", rows: 38, rls: true, status: "ok" },
    { name: "audit_logs", rows: 9214, rls: false, status: "warn" },
    { name: "feature_flags", rows: 0, rls: false, status: "missing" },
  ];
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display font-semibold text-lg">Database</h2>
          <p className="text-xs text-muted-foreground">Supabase · eu-west-1 · 5 tables</p>
        </div>
        <Button variant="hero" size="sm">Repair missing tables</Button>
      </div>
      <div className="rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-white/5">
          <div className="col-span-5">Table</div><div className="col-span-3">Rows</div><div className="col-span-2">RLS</div><div className="col-span-2">Status</div>
        </div>
        {tables.map((t) => (
          <div key={t.name} className="grid grid-cols-12 px-4 py-3 text-sm border-b border-white/5 last:border-0 items-center hover:bg-white/[0.02]">
            <div className="col-span-5 font-mono text-xs">{t.name}</div>
            <div className="col-span-3 tabular-nums text-muted-foreground">{t.rows.toLocaleString()}</div>
            <div className="col-span-2">{t.rls ? <span className="text-success text-xs">enabled</span> : <span className="text-warning text-xs">disabled</span>}</div>
            <div className="col-span-2">
              {t.status === "ok" && <span className="text-xs text-success">healthy</span>}
              {t.status === "warn" && <span className="text-xs text-warning">warn</span>}
              {t.status === "missing" && <span className="text-xs text-destructive">missing</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeployPanel() {
  const logs = [
    "✓ Cloned skky-group/portal at main (a4f2c91)",
    "✓ Installed 412 packages in 12.4s",
    "✓ Generated route tree (8 routes)",
    "✓ Built client bundle (188 kB gzipped)",
    "✓ Built server bundle for Edge runtime",
    "✓ Uploaded to Vercel (region: iad1)",
    "✓ Health check passed at https://portal.skky.group",
    "✓ Lighthouse: 98 perf · 100 a11y · 100 seo",
    "✅ Deployment complete — promoted to production",
  ];
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display font-semibold text-lg">Deployments</h2>
          <p className="text-xs text-muted-foreground">Vercel · production</p>
        </div>
        <Button variant="hero" size="sm"><Rocket className="h-3.5 w-3.5" /> Deploy now</Button>
      </div>
      <div className="rounded-2xl border border-white/5 bg-gradient-card p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="font-medium text-sm">Production · main · a4f2c91</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Deployed 2 hours ago by Skky team · Built in 42s</div>
          </div>
          <Button variant="glass" size="sm"><ExternalLink className="h-3.5 w-3.5" /> Visit</Button>
        </div>
      </div>
      <div className="rounded-2xl border border-white/5 bg-black/40 p-5 font-mono text-xs leading-relaxed">
        {logs.map((l, i) => (
          <div key={i} className={cn(l.startsWith("✅") ? "text-success font-medium mt-2" : "text-muted-foreground")}>
            <span className="text-muted-foreground/50 mr-3">{String(i+1).padStart(2,"0")}</span>{l}
          </div>
        ))}
      </div>
    </div>
  );
}
