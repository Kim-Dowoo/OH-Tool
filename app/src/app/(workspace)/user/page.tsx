import { redirect } from "next/navigation";
import { UserWorkspace } from "@/components/user-workspace";
import { listOwnAllocations, listOwnRequests, listOwnShipments } from "@/lib/oh/queries";
import { requireWorkspaceProfile } from "@/lib/supabase/server";

export default async function UserPage() {
  const { destination } = await requireWorkspaceProfile();
  if (destination !== "/user") redirect(destination);
  const [initialRequests, initialAllocations, initialShipments] = await Promise.all([listOwnRequests(), listOwnAllocations(), listOwnShipments()]);
  return <UserWorkspace initialRequests={initialRequests} initialAllocations={initialAllocations} initialShipments={initialShipments} />;
}
