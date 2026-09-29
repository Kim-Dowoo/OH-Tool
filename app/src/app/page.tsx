import { DEMO_PERIOD, demoSeed } from "@/demo/seed";
import { DemoWorkspace } from "@/components/demo-workspace";
import { assertSafeRuntime, getRuntimeMode } from "@/lib/config/runtime-mode";
import { createDemoRepository } from "@/lib/repositories/demo-repository";
import styles from "./page.module.css";

export default async function Home() {
  assertSafeRuntime();
  if (getRuntimeMode() !== "demo") return <main className={styles.local}>
    <span className={styles.eyebrow}>OH MANAGEMENT</span>
    <h1>OH 관리 · 로컬 모드</h1><p>로컬 업무 화면을 준비하고 있습니다.</p>
  </main>;

  const repository = createDemoRepository();
  const [summary, inventory, requests] = await Promise.all([repository.getDashboard({}), repository.getInventoryBalances(), repository.listRequests({})]);
  return <DemoWorkspace
    period={DEMO_PERIOD}
    summary={summary}
    inventory={inventory}
    requests={requests}
    allocations={[...demoSeed.allocations]}
    shipments={[...demoSeed.shipments]}
  />;
}
