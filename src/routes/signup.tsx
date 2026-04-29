import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
// TODO(codex): wire to src/services/auth.ts → signUp

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — yawB" }, { name: "description", content: "Create your yawB workspace." }] }),
  component: Signup,
});

function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="min-h-screen grid place-items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto h-11 w-11 rounded-xl bg-white/10 border border-white/10 grid place-items-center font-display font-bold mb-4">y</div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Create your workspace</h1>
          <p className="text-sm text-muted-foreground mt-1">Free to start. No credit card required.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-card p-6 shadow-elevated space-y-4">
          <Field icon={User}  type="text"     placeholder="Your name"          value={name}     onChange={setName} />
          <Field icon={Mail}  type="email"    placeholder="you@company.com"    value={email}    onChange={setEmail} />
          <Field icon={Lock}  type="password" placeholder="Choose a password"  value={password} onChange={setPassword} />
          <Button asChild variant="hero" size="lg" className="w-full justify-center">
            <Link to="/">Create workspace <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">By creating an account you agree to our Terms and Privacy Policy.</p>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-5">
          Already have an account? <Link to="/login" className="text-foreground hover:underline">Sign in</Link>
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
