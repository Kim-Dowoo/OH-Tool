"use client";

import { useState } from "react";
import type { AllocationRecord, RequestRecord, ShipmentRecord } from "@/lib/repositories/contracts";
import styles from "./request-details.module.css";

type RequestDetailsProps = {
  requests: readonly RequestRecord[];
  allocations: readonly AllocationRecord[];
  shipments: readonly ShipmentRecord[];
  notes?: ReadonlyMap<string, string>;
};

const display = (value: string | null) => value || "-";
const period = (value: string) => value.replace("-", ". ");

export function RequestDetails({ requests, allocations, shipments, notes }: RequestDetailsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = requests.find((request) => request.id === selectedId) ?? null;
  const selectedAllocations = selected ? allocations.filter((allocation) => allocation.requestId === selected.id) : [];

  return <section className={styles.panel} aria-labelledby="requests-heading">
    <div className={styles.heading}><div><p>REQUESTS / DEMO</p><h2 id="requests-heading">OH 요청 목록</h2></div><span>요청 수량을 누르면 상세 정보와 SN을 확인합니다.</span></div>
    <div className={styles.tableScroll}>
      <table aria-label="OH 요청 목록">
        <thead><tr><th scope="col">월도</th><th scope="col">ITSS CODE</th><th scope="col">Team</th><th scope="col">파트너사명</th><th scope="col">담당 DM</th><th scope="col">Deal Type</th><th scope="col">End-user</th><th scope="col">현 사용 Brand</th><th scope="col">현 사용기종</th><th scope="col">요청 기종</th><th scope="col">요청 수량</th><th scope="col">Family</th><th scope="col">배정 상태</th></tr></thead>
        <tbody>{requests.map((request) => {
          const requestAllocations = allocations.filter((allocation) => allocation.requestId === request.id);
          return <tr key={request.id}>
            <td>{period(request.period)}</td><td>{request.partnerCode}</td><td>{request.teamName}</td><td>{request.partnerName}</td><td>{request.salesRep}</td><td>{display(request.dealType)}</td><td>{display(request.endUser)}</td><td>{display(request.currentBrand)}</td><td>{display(request.currentModel)}</td><td>{request.requestedModel}</td>
            <td><button type="button" className={styles.quantityButton} onClick={() => setSelectedId(request.id)} aria-label={`${request.quantity}대 요청 상세 보기`}>{request.quantity}대</button></td><td>{request.requestedFamily}</td><td>{requestAllocations.length}/{request.quantity}대</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    {selected && <div className={styles.backdrop} role="presentation" onMouseDown={() => setSelectedId(null)}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-label="OH 요청 상세" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p>REQUEST DETAIL</p><h2>{selected.requestedModel} 요청 상세</h2></div><button type="button" className={styles.closeButton} onClick={() => setSelectedId(null)} aria-label="상세 닫기">×</button></header>
        <dl className={styles.details}>
          <div><dt>월도</dt><dd>{period(selected.period)}</dd></div><div><dt>ITSS CODE</dt><dd>{selected.partnerCode}</dd></div><div><dt>Team</dt><dd>{selected.teamName}</dd></div><div><dt>파트너사명</dt><dd>{selected.partnerName}</dd></div><div><dt>담당 DM</dt><dd>{selected.salesRep}</dd></div><div><dt>Deal Type</dt><dd>{display(selected.dealType)}</dd></div><div><dt>End-user</dt><dd>{display(selected.endUser)}</dd></div><div><dt>현 사용 Brand</dt><dd>{display(selected.currentBrand)}</dd></div><div><dt>현 사용기종</dt><dd>{display(selected.currentModel)}</dd></div><div><dt>요청 기종</dt><dd>{selected.requestedModel}</dd></div><div><dt>요청 수량</dt><dd>{selected.quantity}대</dd></div><div><dt>Family</dt><dd>{selected.requestedFamily}</dd></div>{notes?.has(selected.id) && <div><dt>요청 메모</dt><dd>{notes.get(selected.id) || "-"}</dd></div>}
        </dl>
        <h3>배정 SN</h3>
        <div className={styles.tableScroll}><table aria-label="배정 SN"><thead><tr><th scope="col">SN</th><th scope="col">보관장소</th><th scope="col">배정 월도</th><th scope="col">배정 여부</th><th scope="col">출고 상태</th></tr></thead><tbody>{selectedAllocations.length ? selectedAllocations.map((allocation) => {
          const shipment = shipments.find((item) => item.allocationId === allocation.id);
          return <tr key={allocation.id}><td>{allocation.serialNumber}</td><td>{display(allocation.storageLocation)}</td><td>{period(allocation.allocatedAt.slice(0, 7))}</td><td>배정 완료</td><td>{shipment ? "출고 완료" : "배정 완료"}</td></tr>;
        }) : <tr><td colSpan={5}>아직 배정된 SN이 없습니다.</td></tr>}</tbody></table></div>
      </section>
    </div>}
  </section>;
}
