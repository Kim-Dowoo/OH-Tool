import { redirect } from "next/navigation";
import { requireWorkspaceProfile } from "@/lib/supabase/server";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { destination } = await requireWorkspaceProfile();
  if (destination === "/login" || destination === "/pending") redirect(destination);
  return children;
}
