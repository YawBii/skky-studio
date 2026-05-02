import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updatePassword } from "@/services/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — yawB" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate({ to: "/" }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-display font-bold tracking-tight mb-1">Set a new password</h1>
        <p className="text-sm text-muted-foreground mb-6">Enter and confirm your new password.</p>
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-gradient-card p-6 shadow-elevated space-y-4"
        >
          {done ? (
            <div className="text-sm text-success">Password updated. Redirecting…</div>
          ) : (
            <>
              <Field
                icon={Lock}
                type="password"
                placeholder="New password"
                value={password}
                onChange={setPassword}
              />
              <Field
                icon={Lock}
                type="password"
                placeholder="Confirm password"
                value={confirm}
                onChange={setConfirm}
              />
              {error && (
                <p className="text-xs text-destructive" role="alert">
                  {error}
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
                  "Saving…"
                ) : (
                  <>
                    Update password <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                <Link to="/login" className="hover:text-foreground">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </form>
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
}: {
  icon: typeof Lock;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-background/50 px-3 h-11">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm focus:outline-none"
      />
    </div>
  );
}
