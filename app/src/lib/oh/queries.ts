import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OwnAllocation, OwnRequest, OwnShipment } from "./types";

export async function listOwnRequests(): Promise<OwnRequest[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("requests").select("id, period, partner_code, requested_model, quantity, note, status, created_at").order("created_at", { ascending: false });
  if (error) throw new Error("OH 요청을 불러오지 못했습니다.");
  return (data ?? []) as OwnRequest[];
}

export async function listOwnAllocations(): Promise<OwnAllocation[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("allocations").select("id, status, allocated_at, requests(partner_code, requested_model), inventory_serials(serial_number, model_code)").order("allocated_at", { ascending: false });
  if (error) throw new Error("배정 현황을 불러오지 못했습니다.");
  return (data ?? []) as unknown as OwnAllocation[];
}

export async function listOwnShipments(): Promise<OwnShipment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("shipments").select("id, shipped_at, revenue, note, allocations(inventory_serials(serial_number, model_code))").order("shipped_at", { ascending: false });
  if (error) throw new Error("출고 현황을 불러오지 못했습니다.");
  return (data ?? []) as unknown as OwnShipment[];
}

export async function listAdminWorkspaceData() {
  const supabase = await createSupabaseServerClient();
  const [profiles, requests, inventory, allocations] = await Promise.all([
    supabase.from("profiles").select("id, employee_id, created_at").eq("role", "USER").eq("status", "PENDING").order("created_at"),
    supabase.from("requests").select("id, partner_code, requested_model, quantity, status, created_at").order("created_at", { ascending: false }),
    supabase.from("inventory_serials").select("id, model_code, serial_number, storage_location, status").order("created_at", { ascending: false }),
    supabase.from("allocations").select("id, status, allocated_at, requests(partner_code, requested_model), inventory_serials(serial_number, model_code)").order("allocated_at", { ascending: false }),
  ]);
  if (profiles.error || requests.error || inventory.error || allocations.error) throw new Error("관리자 데이터를 불러오지 못했습니다.");
  return { pendingProfiles: profiles.data ?? [], requests: requests.data ?? [], inventory: inventory.data ?? [], allocations: allocations.data ?? [] };
}
