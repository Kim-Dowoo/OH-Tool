import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/config/supabase";
import { getWorkspaceDestination, type WorkspaceProfile } from "@/lib/auth/workspace-gate";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const config = getSupabasePublicConfig(process.env);
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot write cookies. */ }
      },
    },
  });
}

export async function requireWorkspaceProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { destination: getWorkspaceDestination(null), profile: null } as const;
  const { data: profile } = await supabase.from("profiles").select("id, employee_id, role, status").eq("id", user.id).maybeSingle();
  const safeProfile = profile as WorkspaceProfile & { id: string; employee_id: string } | null;
  return { destination: getWorkspaceDestination(safeProfile), profile: safeProfile } as const;
}
