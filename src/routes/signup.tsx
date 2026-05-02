import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mail, Lock, User, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signUp, signInWithProvider } from "@/services/auth";
import { getSupabaseDiagnostics } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — yawB" },
      { name: "description", content: "Create your yawB workspace." },
    ],
  }),
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email || !password) return setError("Email and password are required.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    try {
      const session = await signUp(email.trim(), password, name.trim() || undefined);
      if (session) {
        navigate({ to: "/" });
      } else {
        setInfo("Check your inbox to confirm your email address.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    try {
      await signInWithProvider("google");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Google sign-in.");
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto h-11 w-11 rounded-xl bg-white/10 border border-white/10 grid place-items-center font-display font-bold mb-4">
            y
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Create your workspace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Free to start. No credit card required.
          </p>
        </div>
        <SupabaseConfigBanner forceShow={!!error && /fetch|supabase|env vars/i.test(error)} />
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-gradient-card p-6 shadow-elevated space-y-4"
        >
          <Button
            type="button"
            variant="soft"
            size="lg"
            className="w-full justify-center"
            onClick={onGoogle}
          >
            <span className="text-xs font-bold">G</span> Continue with Google
          </Button>
          <div className="relative my-2 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="bg-card px-3 relative z-10">or</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
          </div>
          <Field
            icon={User}
            type="text"
            placeholder="Your name"
            value={name}
            onChange={setName}
            autoComplete="name"
          />
          <Field
            icon={Mail}
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <Field
            icon={Lock}
            type="password"
            placeholder="Choose a password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="text-xs text-success" role="status">
              {info}
            </p>
          )}
          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="w-full justify-center"
            disabled={loading}
          >
            {loading ? (
              "Creating…"
            ) : (
              <>
                Create workspace <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            By creating an account you agree to our Terms and Privacy Policy.
          </p>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  icon: typeof Mail;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-background/50 px-3 h-11">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="flex-1 bg-transparent text-sm focus:outline-none"
      />
    </div>
  );
}

function SupabaseConfigBanner({ forceShow }: { forceShow?: boolean }) {
  const d = getSupabaseDiagnostics();
  if (d.ok && !forceShow) return null;
  const tone = d.ok
    ? "border-warning/40 bg-warning/10 text-warning-foreground"
    : "border-destructive/40 bg-destructive/10 text-destructive-foreground";
  return (
    <div className={`mb-4 rounded-xl border p-3 text-xs ${tone}`} role="alert">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-3.5 w-3.5" />
        Supabase config diagnostics
      </div>
      <ul className="mt-2 space-y-0.5 font-mono text-[11px] leading-relaxed">
        <li>hasUrl: {String(d.hasUrl)}</li>
        <li>hasKey: {String(d.hasKey)}</li>
        <li>urlHost: {d.urlHost || "(empty)"}</li>
        <li>isPlaceholder: {String(d.isPlaceholder)}</li>
      </ul>
      {d.isPlaceholder && (
        <p className="mt-2 text-[11px] opacity-80">
          The deployed bundle was built with placeholder values. Republish so the new
          VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY get baked in.
        </p>
      )}
      {!d.isPlaceholder && !d.ok && (
        <p className="mt-2 text-[11px] opacity-80">
          Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in the build env.
        </p>
      )}
    </div>
  );
}
