"use server";

import { redirect } from "next/navigation";
import { buildEmployeeAuthInput } from "@/lib/auth/employee-auth-input";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthResult = { error?: string; success?: string };

function inputFrom(formData: FormData) {
  return buildEmployeeAuthInput({
    employeeId: String(formData.get("employeeId") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
}

export async function signUpWithEmployeeId(_: AuthResult, formData: FormData): Promise<AuthResult> {
  const input = inputFrom(formData);
  if (!input) return { error: "사번 10자리와 8자 이상의 비밀번호를 입력하세요." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp(input);
  if (error) return { error: "가입을 완료하지 못했습니다. 사번과 비밀번호를 확인하세요." };
  return { success: "가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다." };
}

export async function signInWithEmployeeId(_: AuthResult, formData: FormData): Promise<AuthResult> {
  const input = inputFrom(formData);
  if (!input) return { error: "사번 10자리와 8자 이상의 비밀번호를 입력하세요." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) return { error: "로그인에 실패했습니다. 사번과 비밀번호를 확인하세요." };
  redirect("/");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
