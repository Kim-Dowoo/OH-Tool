"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/config/supabase";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createSupabaseBrowserClient() {
  if (client) return client;
  const config = getSupabasePublicConfig(process.env);
  client = createBrowserClient(config.url, config.publishableKey);
  return client;
}
