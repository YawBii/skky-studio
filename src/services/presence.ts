// Project presence service & hook.
// Uses Supabase Realtime Presence channel when available; otherwise
// returns the demo collaborator list so the UI never breaks.
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PresenceStatus = "editing" | "viewing" | "online" | "offline";

export interface PresentUser {
  userId: string;
  name: string;
  initials: string;
  color: string;
  role: "owner" | "admin" | "member" | "viewer";
  status: PresenceStatus;
  pagePath?: string;
}

/** Demo collaborators used as fallback when realtime is not connected. */
export const DEMO_PRESENCE: PresentUser[] = [
  { userId: "demo-ya", name: "Yaw",         initials: "YA", color: "bg-[oklch(0.72_0.18_240)]", role: "owner",  status: "editing" },
  { userId: "demo-bb", name: "Builder Bot", initials: "BB", color: "bg-[oklch(0.74_0.16_150)]", role: "member", status: "online"  },
  { userId: "demo-rv", name: "Reviewer",    initials: "RV", color: "bg-[oklch(0.72_0.16_30)]",  role: "viewer", status: "viewing" },
];

const COLORS = [
  "bg-[oklch(0.72_0.18_240)]",
  "bg-[oklch(0.74_0.16_150)]",
  "bg-[oklch(0.72_0.16_30)]",
  "bg-[oklch(0.72_0.18_300)]",
  "bg-[oklch(0.74_0.16_60)]",
];

function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

interface UseProjectPresenceOpts {
  projectId: string | null;
  status?: PresenceStatus;
  pagePath?: string;
  /** Force fallback to demo (e.g. when Cloud isn't configured for this view). */
  forceFallback?: boolean;
}

export function useProjectPresence({ projectId, status = "online", pagePath, forceFallback }: UseProjectPresenceOpts) {
  const [present, setPresent] = useState<PresentUser[]>(DEMO_PRESENCE);
  const [isLive, setIsLive] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (forceFallback || !projectId) { setIsLive(false); setPresent(DEMO_PRESENCE); return; }

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user;
      if (!me) { setIsLive(false); setPresent(DEMO_PRESENCE); return; }

      const channel = supabase.channel(`presence:project:${projectId}`, {
        config: { presence: { key: me.id } },
      });
      channelRef.current = channel;

      channel
        .on("presence", { event: "sync" }, () => {
          if (cancelled) return;
          const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
          const users: PresentUser[] = Object.entries(state).map(([uid, metas]) => {
            const meta = (metas?.[0] ?? {}) as Record<string, unknown>;
            const name = (meta.name as string) || (meta.email as string) || "Teammate";
            return {
              userId: uid,
              name,
              initials: initials(name),
              color: colorFor(uid),
              role: ((meta.role as PresentUser["role"]) ?? "member"),
              status: ((meta.status as PresenceStatus) ?? "online"),
              pagePath: meta.pagePath as string | undefined,
            };
          });
          setPresent(users.length ? users : DEMO_PRESENCE);
          setIsLive(users.length > 0);
        })
        .subscribe(async (s) => {
          if (s !== "SUBSCRIBED") return;
          await channel.track({
            name: me.user_metadata?.full_name || me.email || "Me",
            email: me.email,
            role: "member",
            status,
            pagePath,
          });
        });

      cleanup = () => {
        try { channel.untrack(); } catch {}
        try { supabase.removeChannel(channel); } catch {}
      };
    })();

    return () => { cancelled = true; cleanup?.(); channelRef.current = null; };
  }, [projectId, status, pagePath, forceFallback]);

  return useMemo(() => ({ present, isLive }), [present, isLive]);
}
