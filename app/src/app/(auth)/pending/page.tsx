import Link from "next/link";
import styles from "@/app/page.module.css";

export default function PendingPage() {
  return <main className={styles.loginShell}><section className={styles.loginCard}><div className={styles.loginMark}>OH</div>
    <p className={styles.eyebrow}>OH MANAGEMENT</p><h1>관리자 승인 대기 중</h1>
    <p>가입 신청이 접수되었습니다. 관리자가 승인하면 로그인 후 업무 화면을 이용할 수 있습니다.</p>
    <Link className={styles.primaryLink} href="/login">로그인으로 돌아가기</Link>
  </section></main>;
}
