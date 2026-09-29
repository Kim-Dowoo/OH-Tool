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
