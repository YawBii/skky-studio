import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ArrowUp, Wand2, Database, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { NoProjectSelected } from "@/components/project-empty";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create New App — yawB" },
      { name: "description", content: "Describe an idea. yawB will build it for the selected project." },
    ],
  }),
  component: CreateApp,
});

function CreateApp() {
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();
  const { project, projectIsReal, workspaceIsReal } = useSelectedProject();

  if (!workspaceIsReal || !projectIsReal || !project) {
    return <NoProjectSelected hint="Create a workspace and project first, then start describing an app." />;
  }

  const submit = () => {
    // The chat panel handles real generation; this just routes back to the workspace.
    navigate({ to: "/" });
  };

  return (
    <div className="relative min-h-screen px-6 md:px-10 py-10 max-w-[1100px] mx-auto">
      <div className="relative text-center mb-10 pt-6">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-5">
          <Wand2 className="h-3 w-3" /> {project.name}
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
          What should yawB build for <span className="text-foreground">{project.name}?</span>
        </h1>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Describe a feature, page, fix, or full app. yawB plans it, builds it, and reports back.
        </p>
      </div>

      <div className="relative rounded-3xl border border-white/10 bg-gradient-card shadow-elevated p-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Add a settings page with profile and billing tabs, wired to Lovable Cloud…"
          rows={5}
          className="w-full resize-none bg-transparent px-5 py-4 text-base placeholder:text-muted-foreground/70 focus:outline-none"
        />
        <div className="flex items-center justify-between border-t border-white/5 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"><Database className="h-3.5 w-3.5" /> Cloud</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"><Lock className="h-3.5 w-3.5" /> Auth</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"><Globe className="h-3.5 w-3.5" /> Deploy</span>
          </div>
          <Button variant="hero" size="lg" onClick={submit} disabled={!prompt.trim()}>
            Send to chat <ArrowUp className="h-4 w-4 rotate-45" />
          </Button>
        </div>
      </div>

      <p className="mt-6 text-[12px] text-muted-foreground text-center">
        <Sparkles className="h-3 w-3 inline mr-1" />
        The yawB chat on the right runs the real generation. This page just frames the prompt for the selected project.
      </p>
    </div>
  );
}
