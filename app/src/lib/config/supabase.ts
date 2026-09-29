type PublicEnvironment = Readonly<Record<string, string | undefined>>;

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export function getSupabasePublicConfig(env: PublicEnvironment = process.env): SupabasePublicConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Supabase public configuration is required");
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) throw new Error();
  } catch {
    throw new Error("Supabase public configuration is invalid");
  }
  return { url, publishableKey };
}
