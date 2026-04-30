import { useState } from "react";
import { Loader2, Plus, Sparkles, Github, Building2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createWorkspace, type Workspace } from "@/services/workspaces";
import { createProject, type Project } from "@/services/projects";
import { parseRepoInput, recordGitHubConnection, type ParsedRepo } from "@/services/github-import";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/* -------- Workspace empty state -------- */

export function CreateWorkspaceEmpty({
  onCreated,
  errorMessage,
}: {
  onCreated: (w: Workspace) => void;
  errorMessage?: string;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [touchedSlug, setTouchedSlug] = useState(false);

  const onName = (v: string) => {
    setName(v);
    if (!touchedSlug) setSlug(slugify(v));
  };

  async function submit() {
    const finalSlug = slugify(slug || name);
    if (!name.trim() || finalSlug.length < 2) { toast.error("Add a name and a valid slug"); return; }
    setBusy(true);
    const res = await createWorkspace({ name: name.trim(), slug: finalSlug });
    setBusy(false);
    if (!res.ok) {
      const detail = [res.code && `[${res.code}]`, res.error, res.hint && `Hint: ${res.hint}`]
        .filter(Boolean).join(" ");
      toast.error(detail || "Couldn't create workspace");
      return;
    }
    toast.success(`Workspace "${res.workspace.name}" created`);
    onCreated(res.workspace);
  }

  return (
    <Shell
      icon={Building2}
      eyebrow="Get started"
      title="Create your first workspace"
      hint="A workspace holds your projects, your team, and your settings."
    >
      {errorMessage && (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Couldn't load workspaces from Lovable Cloud.</div>
            <div className="opacity-80 mt-0.5 break-words">{errorMessage}</div>
            <div className="opacity-80 mt-1">Run <code className="font-mono">docs/sql/2026-04-30-collaboration.sql</code> in the Cloud SQL editor, then reload.</div>
          </div>
        </div>
      )}
      <div className="space-y-3">
        <Field label="Workspace name">
          <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Acme Inc." autoFocus />
        </Field>
        <Field label="Slug" hint="Used in URLs. Lowercase, numbers and dashes only.">
          <Input
            value={slug}
            onChange={(e) => { setTouchedSlug(true); setSlug(e.target.value); }}
            placeholder="acme"
          />
        </Field>
        <Button onClick={submit} variant="hero" className="w-full" disabled={busy || !name.trim()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Create workspace
        </Button>
      </div>
    </Shell>
  );
}

/* -------- Project empty state -------- */

export function CreateProjectEmpty({
  workspaceId,
  workspaceName,
  onCreated,
}: { workspaceId: string; workspaceName: string; onCreated: (p: Project) => void }) {
  const [mode, setMode] = useState<"describe" | "import">("describe");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touchedSlug, setTouchedSlug] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const onName = (v: string) => {
    setName(v);
    if (!touchedSlug) setSlug(slugify(v));
  };

  async function submit() {
    const finalSlug = slugify(slug || name);
    if (!name.trim() || finalSlug.length < 1) { toast.error("Add a name and a valid slug"); return; }
    setBusy(true);
    const p = await createProject({
      workspaceId,
      name: name.trim(),
      slug: finalSlug,
      description: description.trim() || undefined,
    });
    setBusy(false);
    if (!p) {
      toast.error("Couldn't create project. Make sure you have member access in this workspace.");
      return;
    }
    toast.success(`Project "${p.name}" created`);
    onCreated(p);
  }

  return (
    <Shell
      icon={Sparkles}
      eyebrow={workspaceName}
      title="Create your first project"
      hint="Describe an app and yawB will scaffold it, or connect a GitHub repo to import an existing one."
    >
      <div className="grid grid-cols-2 gap-2 mb-4">
        <ModeButton active={mode === "describe"} onClick={() => setMode("describe")} icon={Sparkles} label="Describe an app" />
        <ModeButton active={mode === "import"}   onClick={() => setMode("import")}   icon={Github}    label="Import GitHub repo" />
      </div>

      {mode === "describe" ? (
        <div className="space-y-3">
          <Field label="Project name">
            <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Customer Portal" autoFocus />
          </Field>
          <Field label="Slug">
            <Input
              value={slug}
              onChange={(e) => { setTouchedSlug(true); setSlug(e.target.value); }}
              placeholder="customer-portal"
            />
          </Field>
          <Field label="Describe your app" hint="One or two sentences. yawB will use this as the first prompt.">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="A premium client dashboard with billing, support and analytics…"
              className="w-full rounded-lg bg-background/40 border border-white/10 px-3 py-2 text-[13px] outline-none focus:border-primary/50 resize-none"
            />
          </Field>
          <Button onClick={submit} variant="hero" className="w-full" disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create project
          </Button>
        </div>
      ) : (
        <ImportGitHubForm
          workspaceId={workspaceId}
          onCreated={onCreated}
        />
      )}
    </Shell>
  );
}

/* -------- GitHub import sub-form -------- */

function ImportGitHubForm({
  workspaceId, onCreated,
}: { workspaceId: string; onCreated: (p: Project) => void }) {
  const [repoInput, setRepoInput] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [touchedName, setTouchedName] = useState(false);
  const [touchedSlug, setTouchedSlug] = useState(false);
  const [busy, setBusy] = useState(false);

  const parsed: ParsedRepo | null = parseRepoInput(repoInput);
  const repoError = repoInput.trim().length > 0 && !parsed
    ? "Use https://github.com/owner/repo or owner/repo"
    : null;

  // Auto-fill name + slug from parsed repo, until the user edits them.
  const effectiveName = touchedName ? name : parsed?.repo ?? "";
  const effectiveSlug = touchedSlug ? slug : (parsed ? slugify(parsed.repo) : "");

  async function submit() {
    if (!parsed) { toast.error("Enter a valid GitHub repo"); return; }
    const finalName = effectiveName.trim() || parsed.repo;
    const finalSlug = slugify(effectiveSlug || parsed.repo);
    if (finalSlug.length < 1) { toast.error("Slug is required"); return; }

    setBusy(true);
    const project = await createProject({
      workspaceId,
      name: finalName,
      slug: finalSlug,
      description: description.trim() || `Imported from github.com/${parsed.fullName}`,
    });
    if (!project) {
      setBusy(false);
      toast.error("Couldn't create project. Make sure you have member access.");
      return;
    }

    // Best-effort GitHub metadata. Do NOT claim sync until a real backend exists.
    const conn = await recordGitHubConnection({ projectId: project.id, repo: parsed });
    setBusy(false);

    if (conn.ok) {
      toast.success(`Project created from ${parsed.fullName} · GitHub link queued`);
    } else if (conn.reason === "table-missing") {
      toast.success(`Project "${project.name}" created. GitHub sync will be connected next.`);
    } else {
      toast(`Project created. GitHub link failed: ${conn.message ?? conn.reason}`);
    }
    onCreated(project);
  }

  return (
    <div className="space-y-3">
      <Field label="GitHub repo" hint="Paste a GitHub URL or owner/repo. We'll never read private code without your token.">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-background/40 px-3">
          <Github className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="https://github.com/acme/customer-portal"
            className="flex-1 bg-transparent py-2 text-[13px] outline-none"
            autoFocus
          />
        </div>
        {repoError && (
          <p className="mt-1 text-[11px] text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {repoError}
          </p>
        )}
        {parsed && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Parsed as <span className="font-mono text-foreground/80">{parsed.fullName}</span>
          </p>
        )}
      </Field>

      <Field label="Project name">
        <Input
          value={effectiveName}
          onChange={(e) => { setTouchedName(true); setName(e.target.value); }}
          placeholder={parsed?.repo ?? "customer-portal"}
        />
      </Field>

      <Field label="Slug">
        <Input
          value={effectiveSlug}
          onChange={(e) => { setTouchedSlug(true); setSlug(e.target.value); }}
          placeholder={parsed ? slugify(parsed.repo) : "customer-portal"}
        />
      </Field>

      <Field label="Description (optional)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Imported from GitHub. Add context for your team…"
          className="w-full rounded-lg bg-background/40 border border-white/10 px-3 py-2 text-[13px] outline-none focus:border-primary/50 resize-none"
        />
      </Field>

      <Button onClick={submit} variant="hero" className="w-full" disabled={busy || !parsed}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Github className="h-3.5 w-3.5" />}
        Import repository
      </Button>
      <p className="text-[10.5px] text-muted-foreground text-center">
        Real GitHub sync (OAuth, branches, commits) connects in the next pass.
      </p>
    </div>
  );
}

/* -------- shared -------- */

function Shell({
  icon: Icon, eyebrow, title, hint, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string; title: string; hint: string; children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          <Icon className="h-3 w-3" /> {eyebrow}
        </div>
        <h1 className="mt-3 text-[24px] font-display font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{hint}</p>
        <div className="mt-6 rounded-2xl border border-white/5 bg-gradient-card p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[10.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ModeButton({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-left transition ${
        active ? "border-primary/50 bg-primary/10" : "border-white/5 hover:border-white/15 hover:bg-white/[0.04]"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <div className="mt-1.5 text-[12.5px] font-medium">{label}</div>
    </button>
  );
}
