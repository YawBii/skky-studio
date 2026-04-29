import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { billing } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Billing — yawB" }, { name: "description", content: "Plans, usage and invoices." }] }),
  component: BillingPage,
});

function BillingPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  useEffect(() => {
    billing.listPlans().then(setPlans);
    billing.listInvoices().then(setInvoices);
  }, []);

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1200px] mx-auto">
      <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-1">Billing</h1>
      <p className="text-muted-foreground mb-8">Manage your plan, usage and invoices.</p>

      {/* Usage */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {[
          { label: "Active projects", used: 5, total: 10 },
          { label: "AI credits this month", used: 8420, total: 25000 },
          { label: "Deployments", used: 23, total: 100 },
        ].map((u) => (
          <div key={u.label} className="rounded-2xl border border-white/5 bg-gradient-card p-5">
            <div className="text-xs text-muted-foreground">{u.label}</div>
            <div className="mt-2 text-2xl font-display font-bold tabular-nums">{u.used.toLocaleString()} <span className="text-sm text-muted-foreground font-sans font-normal">/ {u.total.toLocaleString()}</span></div>
            <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full bg-foreground/80" style={{ width: `${(u.used / u.total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Plans */}
      <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-3">Plans</h2>
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {plans.map((p) => (
          <div key={p.id} className={cn("rounded-2xl border p-6 bg-gradient-card",
            p.current ? "border-foreground/40 shadow-elevated" : "border-white/5")}>
            <div className="flex items-baseline justify-between">
              <div className="font-display font-semibold text-lg">{p.name}</div>
              {p.current && <span className="text-[11px] uppercase tracking-wider text-success">Current</span>}
            </div>
            <div className="mt-2 text-3xl font-display font-bold tabular-nums">${p.price}<span className="text-sm font-normal text-muted-foreground">/{p.interval}</span></div>
            <ul className="mt-5 space-y-2 text-sm">
              {p.features.map((f: string) => (
                <li key={f} className="flex items-center gap-2 text-muted-foreground"><Check className="h-3.5 w-3.5 text-success" /> {f}</li>
              ))}
            </ul>
            <Button variant={p.current ? "soft" : "hero"} className="w-full justify-center mt-6" disabled={p.current}>
              {p.current ? "Current plan" : "Upgrade"}
            </Button>
          </div>
        ))}
      </div>

      {/* Invoices */}
      <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-3">Invoices</h2>
      <div className="rounded-2xl border border-white/5 bg-gradient-card overflow-hidden">
        {invoices.map((i) => (
          <div key={i.id} className="grid grid-cols-12 px-5 py-3 items-center text-sm border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
            <div className="col-span-3 font-mono text-xs">{i.id}</div>
            <div className="col-span-4 text-muted-foreground">{i.date}</div>
            <div className="col-span-2 tabular-nums">${i.amount}.00</div>
            <div className="col-span-2"><span className="text-xs text-success capitalize">{i.status}</span></div>
            <div className="col-span-1 text-right"><Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button></div>
          </div>
        ))}
      </div>
    </div>
  );
}
