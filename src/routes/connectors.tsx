import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plug, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectors as connectorsSvc } from "@/services";
import { cn } from "@/lib/utils";
import { GithubStatusPanel } from "@/components/github-status-panel";

export const Route = createFileRoute("/connectors")({
  head: () => ({ meta: [{ title: "Connectors — yawB" }, { name: "description", content: "GitHub, Vercel, Supabase, Stripe and more." }] }),
  component: ConnectorsPage,
});

function ConnectorsPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { connectorsSvc.listConnectors().then(setItems); }, []);
  const connected = items.filter(i => i.status === "connected");
  const available = items.filter(i => i.status === "disconnected");

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1300px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Connectors</h1>
        <p className="text-muted-foreground mt-1">Connect your tools so yawB can build, deploy and maintain on your behalf.</p>
      </div>

      <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-3">Connected · {connected.length}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {connected.map((c) => <ConnectorCard key={c.id} c={c} />)}
      </div>

      <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-3">Available</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {available.map((c) => <ConnectorCard key={c.id} c={c} />)}
      </div>
    </div>
  );
}

function ConnectorCard({ c }: { c: any }) {
  const isConnected = c.status === "connected";
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 grid place-items-center">
          <Plug className="h-4 w-4" />
        </div>
        <span className={cn("text-[11px] px-2 py-1 rounded-full border",
          isConnected ? "border-success/30 text-success bg-success/5" : "border-white/10 text-muted-foreground")}>
          {isConnected ? <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" /> Connected</span> : "Not connected"}
        </span>
      </div>
      <div className="mt-4">
        <div className="font-display font-semibold">{c.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>
      </div>
      {c.account && <div className="mt-3 text-[11px] text-muted-foreground font-mono">{c.account}</div>}
      <div className="mt-4 flex gap-2">
        {isConnected ? (
          <>
            <Button variant="soft" size="sm" className="flex-1">Manage</Button>
            <Button variant="ghost" size="sm">Disconnect</Button>
          </>
        ) : (
          <Button variant="hero" size="sm" className="flex-1"><Plus className="h-3.5 w-3.5" /> Connect</Button>
        )}
      </div>
    </div>
  );
}
