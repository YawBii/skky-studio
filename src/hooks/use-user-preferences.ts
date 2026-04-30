import { useEffect, useState, useCallback, useRef } from "react";
import { loadPreferences, savePreferences, type UserPreferences } from "@/services/user-preferences";

export function useUserPreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPreferences().then((p) => { if (alive) { setPrefs(p); setLoaded(true); } });
    return () => { alive = false; };
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const update = useCallback((patch: Partial<UserPreferences>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void savePreferences(patch); }, 400);
  }, []);

  return { prefs, loaded, update };
}
