import { redirect } from "next/navigation";
import { requireWorkspaceProfile } from "@/lib/supabase/server";

export default async function Home() {
  const { destination } = await requireWorkspaceProfile();
  redirect(destination);
}
