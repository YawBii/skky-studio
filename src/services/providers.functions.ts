// Server function wrappers around providers.server.ts.
// Safe to import from client components — bodies are stripped from the client bundle.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface ProviderStatusDTO {
  provider: "github" | "vercel" | "supabase" | "build-runner";
  configured: boolean;
  reachable: boolean | null;
  account: string | null;
  error: string | null;
  missing: string[];
  checkedAt: string;
}

export interface ProvidersOverview {
  github: ProviderStatusDTO;
  vercel: ProviderStatusDTO;
  supabase: ProviderStatusDTO;
  buildRunner: ProviderStatusDTO;
}

export const getProvidersOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProvidersOverview> => {
    const m = await import("../server/providers.server");
    const [github, vercel, supabase, buildRunner] = await Promise.all([
      m.getGithubStatus(),
      m.getVercelStatus(),
      m.pingSupabase(),
      m.getBuildRunnerStatus(),
    ]);
    return { github, vercel, supabase, buildRunner };
  },
);

export const listGithubReposFn = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ perPage: z.number().int().min(1).max(100).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const m = await import("../server/providers.server");
    return m.listGithubRepos({ perPage: data.perPage });
  });

export const listVercelProjectsFn = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ teamId: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const m = await import("../server/providers.server");
    return m.listVercelProjects({ teamId: data.teamId, limit: data.limit });
  });
