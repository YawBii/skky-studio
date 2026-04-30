import { createServerFn } from "@tanstack/react-start";

export interface PublicConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export const getPublicConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicConfig> => {
    const supabaseUrl = process.env.EXTERNAL_SUPABASE_URL ?? "";
    const supabasePublishableKey = process.env.EXTERNAL_SUPABASE_PUBLISHABLE_KEY ?? "";
    return { supabaseUrl, supabasePublishableKey };
  },
);
