import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSession, onAuthChange, type Session } from "@/services/auth";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    // Subscribe FIRST so we don't miss events that fire during getSession().
    onAuthChange((s) => {
      if (!cancelled) setSession(s);
    }).then((u) => {
      if (cancelled) u();
      else unsub = u;
    });

    getSession()
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
