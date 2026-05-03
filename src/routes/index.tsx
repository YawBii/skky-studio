import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Eye,
  Code2,
  Database,
  Rocket,
  RefreshCw,
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  Play,
  History,
  BarChart3,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSelectedProject } from "@/hooks/use-selected-project";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workspace — yawB" },
      { name: "description", content: "Preview, edit, and ship your production app with yawB." },
    ],
  }),
  component: Workspace,
});

type Tab = "preview" | "code" | "database" | "analytics" | "deploy" | "history";
type Device = "desktop" | "tablet" | "mobile";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "code", label: "Code", icon: Code2 },
  { id: "database", label: "Database", icon: Database },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "deploy", label: "Deploy", icon: Rocket },
  { id: "history", label: "History", icon: History },
];

function Workspace() {
  const [tab, setTab] = useState<Tab>("preview");
  const [device, setDevice] = useState<Device>("desktop");
  const { project, projectIsReal } = useSelectedProject();

  // The empty-state takeovers in __root.tsx already handle "no workspace"
  // and "no project". If we render here, either a real project is selected
  // or projects are still loading.

  return (
    <div className="flex flex-col h-full">
      <div className="h-11 border-b border-white/5 px-4 flex items-center gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-2 h-8 px-3 rounded-lg text-[12.5px] transition",
              tab === t.id
                ? "bg-white/[0.07] text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "preview" && (
          <PreviewPane
            device={device}
            setDevice={setDevice}
            projectName={project?.name}
            projectId={project?.id}
            isReal={projectIsReal}
          />
        )}
        {tab === "code" && (
          <NotConnected
            title="Code editor"
            hint="In-app code editing is not connected to this project yet. Ask yawB in the chat to start editing files."
          />
        )}
        {tab === "database" && (
          <NotConnected
            title="Database"
            hint="Connect Supabase from Integrations to browse tables and RLS."
            cta={{ label: "Open Integrations", to: "/connectors" }}
          />
        )}
        {tab === "analytics" && (
          <NotConnected
            title="Analytics"
            hint="Production analytics arrive once Vercel/Plausible is connected."
            cta={{ label: "Open Integrations", to: "/connectors" }}
          />
        )}
        {tab === "deploy" && (
          <NotConnected
            title="Deploys"
            hint="Connect Vercel from Integrations to deploy this project."
            cta={{ label: "Open Integrations", to: "/connectors" }}
          />
        )}
        {tab === "history" && (
          <NotConnected
            title="History"
            hint="Connect a Git provider from Integrations to see commit history."
            cta={{ label: "Open Integrations", to: "/connectors" }}
          />
        )}
      </div>
    </div>
  );
}

function PreviewPane({
  device,
  setDevice,
  projectName,
  projectId,
  isReal,
}: {
  device: Device;
  setDevice: (d: Device) => void;
  projectName?: string;
  projectId?: string;
  isReal: boolean;
}) {
  const widths: Record<Device, string> = { desktop: "100%", tablet: "820px", mobile: "390px" };
  return (
    <div className="h-full flex flex-col">
      <div className="h-11 border-b border-white/5 px-4 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => toast("Refreshing…")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1 mx-2 h-7 rounded-md bg-white/[0.04] border border-white/5 px-2.5 flex items-center text-[11.5px] text-muted-foreground gap-2 font-mono">
          <ExternalLink className="h-3 w-3" /> No deploy URL yet
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
          {(
            [
              { k: "desktop", I: Monitor },
              { k: "tablet", I: Tablet },
              { k: "mobile", I: Smartphone },
            ] as const
          ).map(({ k, I }) => (
            <button
              key={k}
              onClick={() => setDevice(k)}
              className={cn(
                "h-6 w-6 rounded grid place-items-center transition",
                device === k
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <I className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 grid place-items-start justify-center bg-[oklch(0.13_0_0)]">
        <div style={{ width: widths[device] }} className="transition-all w-full max-w-full">
          <div className="rounded-2xl border border-white/10 bg-gradient-card shadow-elevated aspect-[16/10] overflow-hidden">
            <div className="h-full flex flex-col items-center justify-center text-center p-10">
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                Preview
              </div>
              <h2 className="mt-3 text-3xl md:text-4xl font-display font-bold tracking-tight text-balance">
                {projectName ?? "No project selected"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-md text-pretty">
                {isReal
                  ? "Tell yawB in the chat what to build for this project. The first build will appear here."
                  : "Create a project from the home screen to see a live preview."}
              </p>
              {isReal && projectId ? (
                <Button variant="hero" className="mt-5" asChild>
                  <Link to="/builder/$projectId" params={{ projectId }}>
                    <Play className="h-3.5 w-3.5" /> Start a build
                  </Link>
                </Button>
              ) : (
                <Button variant="hero" className="mt-5" disabled>
                  <Play className="h-3.5 w-3.5" /> Start a build
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotConnected({
  title,
  hint,
  cta,
}: {
  title: string;
  hint: string;
  cta?: { label: string; to: string };
}) {
  return (
    <div className="h-full grid place-items-center text-center px-6">
      <div className="max-w-sm">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          Not connected yet
        </div>
        <h2 className="mt-2 text-2xl font-display font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-[13px] text-muted-foreground text-pretty">{hint}</p>
        {cta && (
          <Button variant="hero" className="mt-5" asChild>
            <Link to={cta.to as never}>
              <Plus className="h-3.5 w-3.5" /> {cta.label}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
