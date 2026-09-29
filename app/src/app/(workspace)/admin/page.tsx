import { redirect } from "next/navigation";
import { AdminWorkspace, type AdminWorkspaceProps } from "@/components/admin-workspace";
import { listAdminWorkspaceData } from "@/lib/oh/queries";
import { requireWorkspaceProfile } from "@/lib/supabase/server";

export default async function AdminPage() { const { destination } = await requireWorkspaceProfile(); if (destination !== "/admin") redirect(destination); const data = await listAdminWorkspaceData(); return <AdminWorkspace {...data as unknown as AdminWorkspaceProps} />; }
