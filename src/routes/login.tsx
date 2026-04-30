import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signInWithPassword, signInWithProvider } from "@/services/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — yawB" }, { name: "description", content: "Sign in to your yawB workspace." }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) return setError("Email and password are required.");
    setLoading(true);
    try {
      await signInWithPassword(email.trim(), password);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
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
          <div className="mx-auto h-11 w-11 rounded-xl bg-white/10 border border-white/10 grid place-items-center font-display font-bold mb-4">y</div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your workspace</p>
        </div>
        <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-gradient-card p-6 shadow-elevated space-y-4">
          <Button type="button" variant="soft" size="lg" className="w-full justify-center" onClick={onGoogle}>
            <span className="text-xs font-bold">G</span> Continue with Google
          </Button>
          <div className="relative my-2 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="bg-card px-3 relative z-10">or</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
          </div>
          <Field icon={Mail} type="email" placeholder="you@skky.group" value={email} onChange={setEmail} autoComplete="email" />
          <Field icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} autoComplete="current-password" />
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-muted-foreground"><input type="checkbox" className="accent-foreground" /> Remember me</label>
            <Link to="/forgot-password" className="text-foreground hover:underline">Forgot password?</Link>
          </div>
          {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          <Button type="submit" variant="hero" size="lg" className="w-full justify-center" disabled={loading}>
            {loading ? "Signing in…" : <>Sign in <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-5">
          New to yawB? <Link to="/signup" className="text-foreground hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, type, placeholder, value, onChange, autoComplete }: { icon: typeof Mail; type: string; placeholder: string; value: string; onChange: (v: string) => void; autoComplete?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-background/50 px-3 h-11">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete}
        className="flex-1 bg-transparent text-sm focus:outline-none" />
    </div>
  );
}
