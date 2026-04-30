import { createFileRoute, Link } from "@tanstack/react-router";
import { Book, MessageCircle, Mail, ExternalLink, Sparkles, Wrench, Database, Rocket } from "lucide-react";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help — yawB" }, { name: "description", content: "Docs, support and contact." }] }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <div className="px-6 md:px-10 py-10 max-w-[1100px] mx-auto">
      <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-1">How can we help?</h1>
      <p className="text-muted-foreground mb-8">Browse guides, ask the community or contact support.</p>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {[
          { icon: Book,          title: "Documentation", desc: "Guides, API references and best practices." },
          { icon: MessageCircle, title: "Community",     desc: "Ask questions and share what you build." },
          { icon: Mail,          title: "Contact us",    desc: "Get in touch with support." },
        ].map((c) => (
          <a key={c.title} href="#" className="rounded-2xl border border-white/5 bg-gradient-card p-5 hover:border-white/15 transition-colors">
            <c.icon className="h-5 w-5 text-foreground" />
            <div className="mt-4 font-display font-semibold">{c.title} <ExternalLink className="inline h-3 w-3 ml-1 text-muted-foreground" /></div>
            <div className="text-xs text-muted-foreground mt-1">{c.desc}</div>
          </a>
        ))}
      </div>

      <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-3">Get started</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { to: "/create",  icon: Sparkles, title: "Create a new app",       desc: "Describe your idea and ship a production app." },
          { to: "/import",  icon: Wrench,   title: "Import an existing project", desc: "Bring in a GitHub or Vercel project to maintain." },
          { to: "/cloud",   icon: Database, title: "Tour Cloud",             desc: "Database, auth, storage, secrets and functions." },
          { to: "/",        icon: Rocket,   title: "Open the Workspace",      desc: "Chat, preview, code, database and deploy." },
        ].map((c) => (
          <Link key={c.to} to={c.to} className="rounded-2xl border border-white/5 bg-gradient-card p-5 hover:border-white/15 transition-colors flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 grid place-items-center"><c.icon className="h-4 w-4" /></div>
            <div>
              <div className="font-display font-semibold">{c.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
