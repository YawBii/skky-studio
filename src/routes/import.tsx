import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Github, GitBranch, Database, Cloud, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import Project — yawB" },
      { name: "description", content: "Import existing projects from GitHub, Vercel and Supabase to repair, upgrade and maintain." },
    ],
  }),
  component: ImportProject,
});

const steps = [
  { id: "github", label: "Connect GitHub", icon: Github, detail: "Pull source code & branches" },
  { id: "vercel", label: "Connect Vercel", icon: Cloud, detail: "Link production deployments" },
  { id: "supabase", label: "Connect Supabase", icon: Database, detail: "Inspect schema & RLS" },
];

function ImportProject() {
  const [url, setUrl] = useState("github.com/skky-group/aurora");
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const navigate = useNavigate();

  const start = () => {
    setScanning(true);
    setTimeout(() => { setScanning(false); setScanned(true); }, 1800);
  };

  return (
    <div className="px-6 md:px-10 py-10 max-w-[1100px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Import an existing project</h1>
        <p className="mt-2 text-muted-foreground">Bring in a Lovable, Next.js or Vite project — yawB scans, repairs and upgrades it.</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-gradient-card shadow-elevated p-6 md:p-8">
        <label className="block text-sm font-medium mb-2">Repository URL</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-white/10 bg-background/50 px-4 h-12">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none text-sm"
              placeholder="github.com/your-org/your-repo"
            />
          </div>
          <Button variant="hero" size="lg" onClick={start} disabled={scanning}>
            {scanning ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning…</> : <>Scan project <ArrowRight /></>}
          </Button>
        </div>

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <div key={s.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center"><s.icon className="h-4 w-4" /></div>
                {scanned ? <CheckCircle2 className="h-4 w-4 text-success" /> : <span className="text-[11px] text-muted-foreground">Step {i + 1}</span>}
              </div>
              <div className="mt-3 text-sm font-medium">{s.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.detail}</div>
            </div>
          ))}
        </div>

        {scanned && (
          <div className="mt-8 rounded-2xl border border-success/20 bg-success/5 p-5 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="font-medium">Scan complete — Aurora SaaS</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5 ml-7 list-disc">
              <li>Detected <span className="text-foreground">Next.js 14</span> + <span className="text-foreground">Supabase</span> + <span className="text-foreground">Vercel</span></li>
              <li>Health score: <span className="text-warning font-medium">78%</span> · 3 issues found</li>
              <li>Recommended: upgrade UI library, repair 1 missing table, enable RLS on <code className="text-xs">audit_logs</code></li>
            </ul>
            <div className="mt-5 flex gap-3 ml-7">
              <Button variant="hero" onClick={() => navigate({ to: "/builder/$projectId", params: { projectId: "aurora-saas" } })}>
                Open in Workspace <ArrowRight />
              </Button>
              <Button variant="glass" onClick={() => navigate({ to: "/health" })}>View health report</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
