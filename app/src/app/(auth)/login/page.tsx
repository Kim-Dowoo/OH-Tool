"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithEmployeeId } from "../actions";
import type { AuthResult } from "../actions";
import styles from "@/app/page.module.css";

const initial: AuthResult = {};
export default function LoginPage() {
  const [state, action, pending] = useActionState(signInWithEmployeeId, initial);
  return <main className={styles.loginShell}><section className={styles.loginCard}>
    <div className={styles.loginMark}>OH</div><p className={styles.eyebrow}>OH MANAGEMENT</p><h1>사번으로 로그인</h1>
    <p>승인된 계정으로 OH 요청, 배정 및 출고 현황을 확인하세요.</p>
    <form className={styles.authForm} action={action}>
      <label>사번<input name="employeeId" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required autoComplete="username" /></label>
      <label>비밀번호<input name="password" type="password" minLength={8} required autoComplete="current-password" /></label>
      {state.error && <p className={styles.formError} role="alert">{state.error}</p>}
      <button type="submit" disabled={pending}>{pending ? "로그인 중..." : "로그인"}</button>
    </form>
    <p className={styles.authLink}>계정이 없으신가요? <Link href="/signup">가입 신청</Link></p>
  </section></main>;
}
