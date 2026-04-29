import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — yawB" }] }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <div className="min-h-screen grid place-items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <Link to="/login" className="text-xs text-muted-foreground inline-flex items-center gap-1 mb-6 hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to sign in
        </Link>
        <h1 className="text-2xl font-display font-bold tracking-tight mb-1">Reset your password</h1>
        <p className="text-sm text-muted-foreground mb-6">We'll email you a secure reset link.</p>
        <div className="rounded-2xl border border-white/10 bg-gradient-card p-6 shadow-elevated space-y-4">
          {sent ? (
            <div className="text-sm text-success">Check your inbox — we sent a reset link to {email}.</div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-background/50 px-3 h-11">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@skky.group"
                  className="flex-1 bg-transparent text-sm focus:outline-none" />
              </div>
              <Button variant="hero" size="lg" className="w-full justify-center" onClick={() => setSent(true)}>
                Send reset link
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
