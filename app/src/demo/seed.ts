import type { AllocationRecord, InventoryImportRecord, RequestRecord, ShipmentRecord } from "@/lib/repositories/contracts";

// Entirely invented examples. Never populate this module from operational files.
export const DEMO_PERIOD = "2026-09";
const timestamp = "2026-09-15T00:00:00.000Z";
const scenarios = [
  { partner: "새봄", team: "새봄", model: "100", quantity: 12, allocated: 9, shipped: 6 },
  { partner: "별숲", team: "새봄", model: "100", quantity: 8, allocated: 6, shipped: 4 },
  { partner: "달빛", team: "달빛", model: "200", quantity: 7, allocated: 5, shipped: 3 },
  { partner: "구름", team: "달빛", model: "200", quantity: 6, allocated: 4, shipped: 2 },
  { partner: "가온", team: "가온", model: "300", quantity: 5, allocated: 3, shipped: 2 },
  { partner: "노을", team: "가온", model: "300", quantity: 4, allocated: 1, shipped: 1 },
];
const inventory: InventoryImportRecord[] = [
  { modelCode: "DEMO-100", family: "가상 컴팩트", totalQuantity: 24 },
  { modelCode: "DEMO-200", family: "가상 스탠다드", totalQuantity: 18 },
  { modelCode: "DEMO-300", family: "가상 프리미엄", totalQuantity: 14 },
];
const requests: RequestRecord[] = scenarios.map((scenario, index) => ({
  id: `DEMO-R${index + 1}`, importBatchId: "DEMO-BATCH", sourceRow: index + 1, sourceNumber: null,
  period: DEMO_PERIOD, partnerCode: `DEMO-P${index + 1}`, teamRaw: `${scenario.team}팀(가상)`,
  departmentName: "가상 영업본부", teamName: `${scenario.team}팀(가상)`,
  partnerName: `가상 파트너 · ${scenario.partner}`, salesRep: `가상 담당자 ${index + 1}`,
  dealType: "가상 교체", endUser: null, currentBrand: null, currentModel: null,
  requestedModel: `DEMO-${scenario.model}`, requestedFamily: inventory[Math.floor(index / 2)].family,
  quantity: scenario.quantity, status: "PARTIALLY_ALLOCATED", createdAt: timestamp,
}));
const allocations: AllocationRecord[] = scenarios.flatMap((scenario, index) =>
  Array.from({ length: scenario.allocated }, (_, unit) => ({
    id: `DEMO-A${index + 1}-${unit + 1}`, requestId: requests[index].id,
    modelCode: requests[index].requestedModel, serialNumber: `DEMO-SN-${index + 1}-${String(unit + 1).padStart(3, "0")}`,
    storageLocation: "가상 보관소", status: unit < scenario.shipped ? "SHIPPED" as const : "ALLOCATED" as const,
    allocatedAt: timestamp, cancelledAt: null, cancelReason: null,
  })),
);
const shipments: ShipmentRecord[] = allocations.filter((row) => row.status === "SHIPPED").map((row, index) => ({
  id: `DEMO-S${index + 1}`, allocationId: row.id, shippedAt: "2026-09-20",
  revenue: 1_500_000, note: "가상 출고", createdAt: timestamp,
}));

export const demoSeed = Object.freeze({
  requests: Object.freeze(requests.map((row) => Object.freeze(row))),
  inventory: Object.freeze(inventory.map((row) => Object.freeze(row))),
  allocations: Object.freeze(allocations.map((row) => Object.freeze(row))),
  shipments: Object.freeze(shipments.map((row) => Object.freeze(row))),
});
