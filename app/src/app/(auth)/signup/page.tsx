"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpWithEmployeeId } from "../actions";
import type { AuthResult } from "../actions";
import styles from "@/app/page.module.css";

const initial: AuthResult = {};
export default function SignupPage() {
  const [state, action, pending] = useActionState(signUpWithEmployeeId, initial);
  return <main className={styles.loginShell}><section className={styles.loginCard}>
    <div className={styles.loginMark}>OH</div><p className={styles.eyebrow}>OH MANAGEMENT</p><h1>계정 가입 신청</h1>
    <p>가입 신청은 관리자 승인 후 사용할 수 있습니다.</p>
    <form className={styles.authForm} action={action}>
      <label>사번<input name="employeeId" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required autoComplete="username" /></label>
      <label>비밀번호<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
      {state.error && <p className={styles.formError} role="alert">{state.error}</p>}
      {state.success && <p className={styles.formSuccess} role="status">{state.success}</p>}
      <button type="submit" disabled={pending}>{pending ? "신청 중..." : "가입 신청"}</button>
    </form>
    <p className={styles.authLink}>이미 계정이 있으신가요? <Link href="/login">로그인</Link></p>
  </section></main>;
}
