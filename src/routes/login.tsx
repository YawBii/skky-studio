import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
// TODO(codex): wire to src/services/auth.ts → signInWithPassword / signInWithProvider

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — yawB" }, { name: "description", content: "Sign in to your yawB workspace." }] }),
  component: Login,
});

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="min-h-screen grid place-items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto h-11 w-11 rounded-xl bg-white/10 border border-white/10 grid place-items-center font-display font-bold mb-4">y</div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your Skky Group workspace</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-card p-6 shadow-elevated space-y-4">
          <Button variant="soft" size="lg" className="w-full justify-center">
            <span className="text-xs font-bold">G</span> Continue with Google
          </Button>
          <Button variant="soft" size="lg" className="w-full justify-center">
            <span className="text-xs font-bold"></span> Continue with Apple
          </Button>
          <div className="relative my-2 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="bg-card px-3 relative z-10">or</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
          </div>
          <Field icon={Mail} type="email" placeholder="you@skky.group" value={email} onChange={setEmail} />
          <Field icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} />
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-muted-foreground"><input type="checkbox" className="accent-foreground" /> Remember me</label>
            <Link to="/forgot-password" className="text-foreground hover:underline">Forgot password?</Link>
          </div>
          <Button asChild variant="hero" size="lg" className="w-full justify-center">
            <Link to="/">Sign in <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-5">
          New to yawB? <Link to="/signup" className="text-foreground hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, type, placeholder, value, onChange }: any) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-background/50 px-3 h-11">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm focus:outline-none" />
    </div>
  );
}
