import { createFileRoute } from "@tanstack/react-router";
import { ProjectCard } from "@/components/project-card";
import { projects } from "@/lib/demo-data";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — yawB" },
      { name: "description", content: "All your yawB and imported projects in one place." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  return (
    <div className="px-6 md:px-10 py-10 max-w-[1400px] mx-auto">
      <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-2">Projects</h1>
      <p className="text-muted-foreground mb-8">{projects.length} projects · sorted by recent activity</p>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
      </div>
    </div>
  );
}
