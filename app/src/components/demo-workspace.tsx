"use client";

import { useState, useSyncExternalStore } from "react";
import { RequestDetails } from "@/components/request-details";
import type {
  AllocationRecord,
  DashboardGroup,
  DashboardSummary,
  InventoryBalance,
  RequestRecord,
  ShipmentRecord,
} from "@/lib/repositories/contracts";
import styles from "@/app/page.module.css";

type DemoRole = "admin" | "user";
type DemoView = "dashboard" | "requests" | "allocations" | "inventory" | "shipments";

type DemoWorkspaceProps = {
  period: string;
  summary: DashboardSummary;
  inventory: InventoryBalance[];
  requests: RequestRecord[];
  allocations: AllocationRecord[];
  shipments: ShipmentRecord[];
};

const number = (value: number) => value.toLocaleString("ko-KR");
const adminMenu: { id: DemoView; label: string }[] = [
  { id: "dashboard", label: "대시보드" },
  { id: "requests", label: "OH 요청" },
  { id: "allocations", label: "OH 배정" },
  { id: "inventory", label: "재고" },
  { id: "shipments", label: "출고 현황" },
];
const userMenu: { id: DemoView; label: string }[] = [
  { id: "requests", label: "OH 요청" },
  { id: "allocations", label: "배정 결과" },
];
const demoUserSalesRep = "가상 담당자 1";
const demoRoleStorageKey = "oh-demo-role";
const demoRoleListeners = new Set<() => void>();

function readStoredDemoRole(): DemoRole | null {
  if (typeof window === "undefined") return null;
  try {
    const storedRole = window.localStorage.getItem(demoRoleStorageKey);
    return storedRole === "admin" || storedRole === "user" ? storedRole : null;
  } catch {
    return null;
  }
}

function subscribeToDemoRole(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === demoRoleStorageKey) listener();
  };
  demoRoleListeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    demoRoleListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeStoredDemoRole(role: DemoRole | null): void {
  try {
    if (role) window.localStorage.setItem(demoRoleStorageKey, role);
    else window.localStorage.removeItem(demoRoleStorageKey);
  } catch {
    // Browser storage is optional for this demo; the in-memory role still works.
  }
  for (const listener of demoRoleListeners) listener();
}

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

function InventoryPanel({ inventory }: Pick<DemoWorkspaceProps, "inventory">) {
  return <section className={styles.panel}>
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
  </section>;
}

function Dashboard({ period, summary, inventory, requests, allocations, shipments }: DemoWorkspaceProps) {
  const cards = [
    { label: "요청 수량", value: summary.totalRequested, unit: "대", detail: "접수된 전체 요청", tone: "" },
    { label: "배정 수량", value: summary.totalAllocated, unit: "대", detail: "출고 완료 수량 포함", tone: styles.teal },
    { label: "출고 수량", value: summary.totalShipped, unit: "대", detail: "출고 확정 기준", tone: styles.blue },
    { label: "확정 매출", value: summary.confirmedRevenue, unit: "원", detail: "가상 출고 매출 합계", tone: styles.revenue },
  ];

  return <main className={styles.main} id="overview">
    <section className={styles.intro}>
      <div><p className={styles.eyebrow}>OVERVIEW / DEMO</p><h1>OH 운영 현황</h1><p>요청부터 출고까지, 운영 흐름을 한눈에 확인하세요.</p></div>
      <div className={styles.period}><span>샘플 기준월</span><strong>{period.replace("-", ". ")}</strong></div>
    </section>
    <section className={styles.cards} aria-label="운영 요약">
      {cards.map((card) => <article key={card.label} className={`${styles.card} ${card.tone}`}>
        <h2>{card.label}</h2><p className={styles.metric}><strong>{number(card.value)}</strong><span>{card.unit}</span></p><p className={styles.cardDetail}>{card.detail}</p>
      </article>)}
    </section>
    <RequestDetails requests={requests} allocations={allocations} shipments={shipments} />
    <InventoryPanel inventory={inventory} />
    <div className={styles.breakdowns}><Breakdown title="파트너별 현황" groups={summary.byPartner} /><Breakdown title="팀별 현황" groups={summary.byTeam} /></div>
    <footer className={styles.footer}><strong>모든 정보는 설명용 가상 데이터입니다.</strong><span>실제 고객·파트너·재고와 관계없는 고정 샘플입니다.</span></footer>
  </main>;
}

function RequestsView({ requests, allocations, shipments }: Pick<DemoWorkspaceProps, "requests" | "allocations" | "shipments">) {
  return <main className={styles.main}>
    <section className={styles.viewHeading}>
      <p className={styles.eyebrow}>REQUESTS / DEMO</p>
      <h1>OH 요청</h1>
      <p>가상 요청의 기본 정보와 배정 상세를 확인합니다.</p>
    </section>
    <RequestDetails requests={requests} allocations={allocations} shipments={shipments} />
  </main>;
}

function AllocationsView({ requests, allocations, scope }: Pick<DemoWorkspaceProps, "requests" | "allocations"> & { scope: "all" | "own" }) {
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const title = scope === "all" ? "OH 배정 현황" : "배정 결과";
  const tableTitle = scope === "all" ? "전체 배정 현황" : "내 배정 결과";
  return <main className={styles.main}>
    <section className={styles.viewHeading}>
      <p className={styles.eyebrow}>ALLOCATIONS / DEMO</p>
      <h1>{title}</h1>
      <p>요청별로 배정된 가상 SN과 현재 상태를 확인합니다.</p>
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeading}><h2>{tableTitle}</h2><span>{allocations.length}대 · 가상 데이터</span></div>
      <div className={styles.tableScroll}>
        <table aria-label={tableTitle}>
          <thead><tr><th scope="col">ITSS CODE</th><th scope="col">요청 기종</th><th scope="col">SN</th><th scope="col">보관장소</th><th scope="col">상태</th></tr></thead>
          <tbody>{allocations.map((allocation) => {
            const request = requestById.get(allocation.requestId);
            return <tr key={allocation.id}><td>{request?.partnerCode ?? "-"}</td><td>{allocation.modelCode}</td><td>{allocation.serialNumber}</td><td>{allocation.storageLocation ?? "-"}</td><td>{allocation.status === "SHIPPED" ? "출고 완료" : "배정 완료"}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  </main>;
}

function InventoryView({ inventory }: Pick<DemoWorkspaceProps, "inventory">) {
  return <main className={styles.main}>
    <section className={styles.viewHeading}>
      <p className={styles.eyebrow}>INVENTORY / DEMO</p>
      <h1>재고 현황</h1>
      <p>기종별 총재고와 현재 배정·잔여 수량을 확인합니다.</p>
    </section>
    <InventoryPanel inventory={inventory} />
  </main>;
}

function ShipmentsView({ requests, allocations, shipments }: Pick<DemoWorkspaceProps, "requests" | "allocations" | "shipments">) {
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const allocationById = new Map(allocations.map((allocation) => [allocation.id, allocation]));
  return <main className={styles.main}>
    <section className={styles.viewHeading}>
      <p className={styles.eyebrow}>SHIPMENTS / DEMO</p>
      <h1>출고 현황</h1>
      <p>출고가 완료된 가상 SN과 확정 매출을 확인합니다.</p>
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeading}><h2>전체 출고 현황</h2><span>{shipments.length}대 · 가상 데이터</span></div>
      <div className={styles.tableScroll}>
        <table aria-label="전체 출고 현황">
          <thead><tr><th scope="col">출고일</th><th scope="col">ITSS CODE</th><th scope="col">기종</th><th scope="col">SN</th><th scope="col">확정 매출</th><th scope="col">비고</th></tr></thead>
          <tbody>{shipments.map((shipment) => {
            const allocation = allocationById.get(shipment.allocationId);
            const request = allocation ? requestById.get(allocation.requestId) : undefined;
            return <tr key={shipment.id}><td>{shipment.shippedAt.replaceAll("-", ". ")}</td><td>{request?.partnerCode ?? "-"}</td><td>{allocation?.modelCode ?? "-"}</td><td>{allocation?.serialNumber ?? "-"}</td><td>{number(shipment.revenue)}원</td><td>{shipment.note ?? "-"}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  </main>;
}

export function DemoWorkspace(props: DemoWorkspaceProps) {
  const storedRole = useSyncExternalStore(subscribeToDemoRole, readStoredDemoRole, () => null);
  const [sessionRole, setSessionRole] = useState<DemoRole | null | undefined>(undefined);
  const role = sessionRole === undefined ? storedRole : sessionRole;
  const [view, setView] = useState<DemoView>("dashboard");

  const login = (nextRole: DemoRole) => {
    writeStoredDemoRole(nextRole);
    setSessionRole(nextRole);
    setView(nextRole === "admin" ? "dashboard" : "requests");
  };

  const logout = () => {
    writeStoredDemoRole(null);
    setSessionRole(null);
    setView("dashboard");
  };

  if (!role) return <main className={styles.loginShell}>
    <section className={styles.loginCard}>
      <span className={styles.loginMark} aria-hidden="true">OH</span>
      <p className={styles.eyebrow}>READ-ONLY DEMO</p>
      <h1>데모 로그인</h1>
      <p>확인할 역할을 선택하세요. 실제 계정이나 업무 데이터는 사용하지 않습니다.</p>
      <div className={styles.loginActions}>
        <button type="button" onClick={() => login("admin")}><strong>관리자 로그인</strong><span>전체 현황과 모든 메뉴 보기</span></button>
        <button type="button" onClick={() => login("user")}><strong>사용자 로그인</strong><span>내 요청과 배정 결과 보기</span></button>
      </div>
    </section>
  </main>;

  const visibleRequests = role === "user" ? props.requests.filter((request) => request.salesRep === demoUserSalesRep) : props.requests;
  const visibleRequestIds = new Set(visibleRequests.map((request) => request.id));
  const visibleAllocations = role === "user" ? props.allocations.filter((allocation) => visibleRequestIds.has(allocation.requestId)) : props.allocations;
  const visibleAllocationIds = new Set(visibleAllocations.map((allocation) => allocation.id));
  const visibleShipments = role === "user" ? props.shipments.filter((shipment) => visibleAllocationIds.has(shipment.allocationId)) : props.shipments;
  const menu = role === "admin" ? adminMenu : userMenu;
  const effectiveView = menu.some((item) => item.id === view) ? view : menu[0].id;

  let content = <Dashboard {...props} />;
  if (effectiveView === "requests") content = <RequestsView requests={visibleRequests} allocations={visibleAllocations} shipments={visibleShipments} />;
  if (effectiveView === "allocations") content = <AllocationsView requests={visibleRequests} allocations={visibleAllocations} scope={role === "admin" ? "all" : "own"} />;
  if (effectiveView === "inventory") content = <InventoryView inventory={props.inventory} />;
  if (effectiveView === "shipments") content = <ShipmentsView requests={visibleRequests} allocations={visibleAllocations} shipments={visibleShipments} />;

  return <div className={styles.workspace}>
    <aside className={styles.sidebar}>
      <div className={styles.sidebarBrand}><span>OH</span><strong>OH 관리</strong></div>
      <p className={styles.roleLabel}>{role === "admin" ? "관리자 데모" : `사용자 데모 · ${demoUserSalesRep}`}</p>
      <nav aria-label={role === "admin" ? "관리 메뉴" : "사용자 메뉴"}>
        {menu.map((item) => <button key={item.id} type="button" className={effectiveView === item.id ? styles.activeNav : ""} aria-current={effectiveView === item.id ? "page" : undefined} onClick={() => setView(item.id)}>{item.label}</button>)}
      </nav>
    </aside>
    <section className={styles.workspaceMain}>
      <header className={styles.header}>
        <div><strong>OH MANAGEMENT</strong><span className={styles.brandSub}>OPERATIONS OVERVIEW</span></div>
        <div className={styles.headerActions}>
          <span className={styles.readOnly}><span aria-hidden="true">●</span> 읽기 전용 데모</span>
          <button type="button" className={styles.logoutButton} onClick={logout}>로그아웃</button>
        </div>
      </header>
      {content}
    </section>
  </div>;
}
