"use client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { CreateRequestInput } from "./types";

export async function createRequest(input: CreateRequestInput): Promise<{ error?: string }> {
  if (!input.period || !input.partnerCode.trim() || !input.requestedModel.trim() || !Number.isInteger(input.quantity) || input.quantity < 1) return { error: "요청 월도, ITSS CODE, 요청 기종과 1대 이상의 수량을 입력하세요." };
  const supabase = createSupabaseBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 만료되었습니다. 다시 로그인하세요." };
  const { error } = await supabase.from("requests").insert({
    created_by: user.id,
    period: `${input.period}-01`,
    partner_code: input.partnerCode.trim(),
    requested_model: input.requestedModel.trim(),
    quantity: input.quantity,
    note: input.note.trim(),
  });
  return error ? { error: "요청을 저장하지 못했습니다. 승인 상태와 입력값을 확인하세요." } : {};
}

async function callAdminRpc(name: "approve_profile" | "register_inventory_serial" | "allocate_serial" | "ship_allocation", args: Record<string, unknown>) {
  const { error } = await createSupabaseBrowserClient().rpc(name, args);
  return error ? { error: "작업을 완료하지 못했습니다. 권한, 상태 및 입력값을 확인하세요." } : {};
}
export const approveProfile = (profileId: string) => callAdminRpc("approve_profile", { target_profile_id: profileId });
export const registerInventorySerial = (modelCode: string, serialNumber: string, storageLocation: string) => callAdminRpc("register_inventory_serial", { model_code_value: modelCode, serial_number_value: serialNumber, storage_location_value: storageLocation || null });
export const allocateSerial = (requestId: string, serialNumber: string) => callAdminRpc("allocate_serial", { request_id_value: requestId, serial_number_value: serialNumber });
export const shipAllocation = (allocationId: string, shippedAt: string, revenue: number, note: string) => callAdminRpc("ship_allocation", { allocation_id_value: allocationId, shipped_at_value: shippedAt, revenue_value: revenue, note_value: note });
