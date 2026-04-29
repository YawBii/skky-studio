import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ArrowUp, Rocket, ShoppingBag, BarChart3, Users, Briefcase, Wand2, Database, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { promptSuggestions } from "@/lib/demo-data";

const iconMap: Record<string, any> = { Rocket, ShoppingBag, BarChart3, Users, Briefcase, Sparkles };

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create New App — yawB" },
      { name: "description", content: "Describe your idea. yawB will design, build and deploy a production app for you." },
    ],
  }),
  component: CreateApp,
});

function CreateApp() {
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();

  const submit = () => navigate({ to: "/builder/$projectId", params: { projectId: "skky-portal" } });

  return (
    <div className="relative min-h-screen px-6 md:px-10 py-10 max-w-[1100px] mx-auto">
      <div className="relative text-center mb-10 pt-6">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-5">
          <Wand2 className="h-3 w-3" /> Production-first generation
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
          What would you like to <span className="text-foreground">build today?</span>
        </h1>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Describe your app, dashboard, SaaS or website. yawB plans, builds, verifies and ships it.
        </p>
      </div>

      <div className="relative rounded-3xl border border-white/10 bg-gradient-card shadow-elevated p-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A multi-tenant SaaS dashboard with team auth, Stripe billing, usage analytics and an admin console..."
          rows={5}
          className="w-full resize-none bg-transparent px-5 py-4 text-base placeholder:text-muted-foreground/70 focus:outline-none"
        />
        <div className="flex items-center justify-between border-t border-white/5 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5"><Database className="h-3.5 w-3.5" /> Cloud</button>
            <button className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5"><Lock className="h-3.5 w-3.5" /> Auth</button>
            <button className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5"><Globe className="h-3.5 w-3.5" /> Deploy</button>
          </div>
          <Button variant="hero" size="lg" onClick={submit} disabled={!prompt.trim()}>
            Build it <ArrowUp className="h-4 w-4 rotate-45" />
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">Start from a template</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {promptSuggestions.map((s) => {
            const Icon = iconMap[s.icon];
            return (
              <button
                key={s.title}
                onClick={() => setPrompt(s.prompt)}
                className="group text-left rounded-2xl border border-white/5 bg-gradient-card p-4 hover:border-white/15 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center text-primary group-hover:bg-gradient-brand group-hover:text-primary-foreground transition-all">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{s.prompt}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
