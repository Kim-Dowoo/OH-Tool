import { DEMO_PERIOD, demoSeed } from "@/demo/seed";
import { RequestDetails } from "@/components/request-details";
import { assertSafeRuntime, getRuntimeMode } from "@/lib/config/runtime-mode";
import { createDemoRepository } from "@/lib/repositories/demo-repository";
import type { DashboardGroup } from "@/lib/repositories/contracts";
import styles from "./page.module.css";

const number = (value: number) => value.toLocaleString("ko-KR");

function Breakdown({ title, groups }: { title: string; groups: DashboardGroup[] }) {
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><h2>{title}</h2><span>{groups.length}개 · 가상 데이터</span></div>
    <div className={styles.tableScroll}>
      <table aria-label={title}>
        <thead><tr><th scope="col">구분</th><th scope="col">요청</th><th scope="col">배정</th><th scope="col">출고</th><th scope="col">매출(원)</th></tr></thead>
        <tbody>{groups.map((group) => <tr key={group.label}>
          <th scope="row">{group.label}</th><td>{number(group.requested)}</td><td>{number(group.allocated)}</td>
          <td>{number(group.shipped)}</td><td>{number(group.revenue)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

export default async function Home() {
  assertSafeRuntime();
  if (getRuntimeMode() !== "demo") return <main className={styles.local}>
    <span className={styles.eyebrow}>OH MANAGEMENT</span>
    <h1>OH 관리 · 로컬 모드</h1><p>로컬 업무 화면을 준비하고 있습니다.</p>
  </main>;

  const repository = createDemoRepository();
  const [summary, inventory, requests] = await Promise.all([repository.getDashboard({}), repository.getInventoryBalances(), repository.listRequests({})]);
  const cards = [
    { label: "요청 수량", value: summary.totalRequested, unit: "대", detail: "접수된 전체 요청", tone: "" },
    { label: "배정 수량", value: summary.totalAllocated, unit: "대", detail: "출고 완료 수량 포함", tone: styles.teal },
    { label: "출고 수량", value: summary.totalShipped, unit: "대", detail: "출고 확정 기준", tone: styles.blue },
    { label: "확정 매출", value: summary.confirmedRevenue, unit: "원", detail: "가상 출고 매출 합계", tone: styles.revenue },
  ];
  return <div className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="#overview"><span className={styles.brandMark}>OH</span><span>OH 관리<span className={styles.brandSub}>OPERATIONS OVERVIEW</span></span></a>
      <span className={styles.readOnly}><span aria-hidden="true">●</span> 읽기 전용 데모</span>
    </header>
    <main className={styles.main} id="overview">
      <section className={styles.intro}>
        <div><p className={styles.eyebrow}>OVERVIEW / DEMO</p><h1>OH 운영 현황</h1><p>요청부터 출고까지, 운영 흐름을 한눈에 확인하세요.</p></div>
        <div className={styles.period}><span>샘플 기준월</span><strong>{DEMO_PERIOD.replace("-", ". ")}</strong></div>
      </section>
      <section className={styles.cards} aria-label="운영 요약">
        {cards.map((card) => <article key={card.label} className={`${styles.card} ${card.tone}`}>
          <h2>{card.label}</h2><p className={styles.metric}><strong>{number(card.value)}</strong><span>{card.unit}</span></p><p className={styles.cardDetail}>{card.detail}</p>
        </article>)}
      </section>
      <RequestDetails requests={requests} allocations={demoSeed.allocations} shipments={demoSeed.shipments} />
      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><p className={styles.eyebrow}>INVENTORY</p><h2>기종별 재고</h2></div><span>잔여 = 총재고 − 배정</span></div>
        <div className={styles.tableScroll}>
          <table aria-label="기종별 재고">
            <thead><tr><th scope="col">기종 / 제품군</th><th scope="col">총재고</th><th scope="col">배정</th><th scope="col">잔여</th><th scope="col">배정 비율</th></tr></thead>
            <tbody>{inventory.map((item) => <tr key={item.modelCode}>
              <th scope="row">{item.modelCode}<span className={styles.family}>{item.family}</span></th>
              <td>{item.totalQuantity}대</td><td>{item.allocatedQuantity}대</td><td><span className={styles.stock}>{item.remainingQuantity}대</span></td>
              <td><div className={styles.ratio}><meter min={0} max={item.totalQuantity} value={item.allocatedQuantity} aria-label={`${item.modelCode} 배정 비율`} /><span>{Math.round(item.allocatedQuantity / item.totalQuantity * 100)}%</span></div></td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className={styles.panelNote}>배정 수량에는 출고 완료된 기기가 포함됩니다.</p>
      </section>
      <div className={styles.breakdowns}><Breakdown title="파트너별 현황" groups={summary.byPartner} /><Breakdown title="팀별 현황" groups={summary.byTeam} /></div>
      <footer className={styles.footer}><strong>모든 정보는 설명용 가상 데이터입니다.</strong><span>실제 고객·파트너·재고와 관계없는 고정 샘플입니다.</span></footer>
    </main>
  </div>;
}
