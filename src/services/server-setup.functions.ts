// Returns presence-only booleans for all server-side env vars yawB depends on.
// Never returns secret values. Powers the in-app Server Setup screen.
import { createServerFn } from "@tanstack/react-start";

export interface ServerSetupSnapshot {
  buildRunner: {
    mode: "external" | "local" | "none";
    hasBuildRunnerUrl: boolean;
    hasBuildRunnerToken: boolean;
    hasBuildRunnerMode: boolean;
    hasBuildCommand: boolean;
    hasTypecheckCommand: boolean;
    hasBuildPreviewCommand: boolean;
    reason: string;
  };
  supabase: {
    hasSupabaseUrl: boolean;
    hasSupabasePublishableKey: boolean;
    hasSupabaseServiceRoleKey: boolean;
  };
  providers: {
    hasGithubToken: boolean;
    hasVercelToken: boolean;
    hasAiGatewayKey: boolean;
  };
}

export const getServerSetup = createServerFn({ method: "GET" }).handler(
  async (): Promise<ServerSetupSnapshot> => {
    const { getBuildRunnerConfigServer } = await import("../server/jobs-runner.server");
    const buildRunner = getBuildRunnerConfigServer();
    const env = process.env;
    return {
      buildRunner,
      supabase: {
        hasSupabaseUrl: Boolean(
          env.SUPABASE_URL || env.EXTERNAL_SUPABASE_URL || env.VITE_SUPABASE_URL,
        ),
        hasSupabasePublishableKey: Boolean(
          env.SUPABASE_PUBLISHABLE_KEY ||
          env.EXTERNAL_SUPABASE_PUBLISHABLE_KEY ||
          env.SUPABASE_ANON_KEY ||
          env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ),
        hasSupabaseServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      },
      providers: {
        hasGithubToken: Boolean(env.GITHUB_TOKEN),
        hasVercelToken: Boolean(env.VERCEL_TOKEN),
        hasAiGatewayKey: Boolean(env.LOVABLE_API_KEY || env.AI_GATEWAY_KEY),
      },
    };
  },
);
