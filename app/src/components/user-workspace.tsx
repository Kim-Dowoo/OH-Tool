"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createRequest } from "@/lib/oh/commands";
import type { OwnAllocation, OwnRequest, OwnShipment } from "@/lib/oh/types";
import styles from "@/app/page.module.css";

type Tab = "register" | "requests" | "results";
type Props = { initialRequests: OwnRequest[]; initialAllocations: OwnAllocation[]; initialShipments: OwnShipment[] };
const statusLabel: Record<string, string> = { RECEIVED: "접수", PARTIALLY_ALLOCATED: "일부 배정", ALLOCATED: "배정 완료", SHIPPED: "출고 완료", CANCELLED: "취소" };

export function UserWorkspace({ initialRequests, initialAllocations, initialShipments }: Props) {
  const router = useRouter(); const [tab, setTab] = useState<Tab>("register"); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess(""); const form = new FormData(event.currentTarget);
    const result = await createRequest({ period: String(form.get("period")), partnerCode: String(form.get("partnerCode")), requestedModel: String(form.get("requestedModel")), quantity: Number(form.get("quantity")), note: String(form.get("note")) });
    if (result.error) { setError(result.error); return; } event.currentTarget.reset(); setSuccess("요청을 저장했습니다. 요청 현황에서 확인할 수 있습니다."); router.refresh();
  }
  return <main className={styles.workspaceMain}><header className={styles.header}><div className={styles.brand}><span className={styles.brandMark}>OH</span><span>OH 관리<small className={styles.brandSub}>USER WORKSPACE</small></span></div></header><section className={styles.main}>
    <nav className={styles.tabNav} aria-label="사용자 메뉴">{([ ["register", "OH 등록"], ["requests", "OH 요청 현황"], ["results", "배정 및 출고 현황"] ] as const).map(([key, label]) => <button key={key} aria-current={tab === key ? "page" : undefined} className={tab === key ? styles.activeNav : undefined} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {tab === "register" && <><div className={styles.viewHeading}><p className={styles.eyebrow}>OH REQUEST</p><h1>OH 등록</h1><p>저장하면 관리자가 확인하여 SN 배정을 진행합니다.</p></div><section className={styles.requestFormPanel}><form className={styles.requestForm} onSubmit={submit}><label>요청 월도<input name="period" type="month" required /></label><label>ITSS CODE<input name="partnerCode" required /></label><label>요청 기종<input name="requestedModel" required /></label><label>요청 수량<input name="quantity" type="number" min="1" required /></label><label className={styles.fullWidth}>요청 메모<textarea name="note" rows={3} /></label>{error && <p className={styles.formError} role="alert">{error}</p>}{success && <p className={styles.formSuccess} role="status">{success}</p>}<div className={styles.formActions}><button type="submit">요청 저장</button></div></form></section></>}
    {tab === "requests" && <section className={styles.panel}><div className={styles.panelHeading}><h1>OH 요청 현황</h1><span>내 요청만 표시됩니다.</span></div><RequestTable requests={initialRequests} /></section>}
    {tab === "results" && <><section className={styles.panel}><div className={styles.panelHeading}><h1>배정 현황</h1></div><table><thead><tr><th>요청 기종</th><th>SN</th><th>상태</th><th>배정일</th></tr></thead><tbody>{initialAllocations.length ? initialAllocations.map((row) => <tr key={row.id}><th>{row.requests.requested_model}</th><td>{row.inventory_serials.serial_number}</td><td>{statusLabel[row.status]}</td><td>{row.allocated_at.slice(0, 10)}</td></tr>) : <tr><td colSpan={4}>배정된 SN이 없습니다.</td></tr>}</tbody></table></section><section className={styles.panel}><div className={styles.panelHeading}><h1>출고 현황</h1></div><table><thead><tr><th>기종</th><th>SN</th><th>출고일</th><th>비고</th></tr></thead><tbody>{initialShipments.length ? initialShipments.map((row) => <tr key={row.id}><th>{row.allocations.inventory_serials.model_code}</th><td>{row.allocations.inventory_serials.serial_number}</td><td>{row.shipped_at}</td><td>{row.note || "-"}</td></tr>) : <tr><td colSpan={4}>출고된 SN이 없습니다.</td></tr>}</tbody></table></section></>}
  </section></main>;
}

function RequestTable({ requests }: { requests: OwnRequest[] }) { return <table aria-label="OH 요청 목록"><thead><tr><th>월도</th><th>ITSS CODE</th><th>요청 기종</th><th>수량</th><th>상태</th></tr></thead><tbody>{requests.length ? requests.map((row) => <tr key={row.id}><th>{row.period.slice(0, 7)}</th><td>{row.partner_code}</td><td>{row.requested_model}</td><td>{row.quantity}</td><td>{statusLabel[row.status]}</td></tr>) : <tr><td colSpan={5}>등록된 OH 요청이 없습니다.</td></tr>}</tbody></table>; }
