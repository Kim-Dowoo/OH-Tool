import { demoSeed } from "@/demo/seed";
import { DEMO_MUTATION_ERROR } from "@/lib/security/mutation-guard";
import type { DashboardGroup, OhRepository, RequestFilter, RequestRecord } from "./contracts";

function matches(row: RequestRecord, filter: RequestFilter): boolean {
  return (filter.periodFrom === undefined || row.period >= filter.periodFrom)
    && (filter.periodTo === undefined || row.period <= filter.periodTo)
    && (filter.partnerCode === undefined || row.partnerCode === filter.partnerCode)
    && (filter.departmentName === undefined || row.departmentName === filter.departmentName)
    && (filter.teamName === undefined || row.teamName === filter.teamName)
    && (filter.salesRep === undefined || row.salesRep === filter.salesRep)
    && (filter.modelCode === undefined || row.requestedModel === filter.modelCode)
    && (filter.status === undefined || row.status === filter.status);
}

async function rejectMutation(): Promise<never> { throw new Error(DEMO_MUTATION_ERROR); }

export function createDemoRepository(): OhRepository {
  return {
    saveImportBatch: rejectMutation, allocate: rejectMutation, cancelAllocation: rejectMutation, ship: rejectMutation,
    async listRequests(filter) {
      return demoSeed.requests.filter((row) => matches(row, filter)).map((row) => ({ ...row }));
    },
    async getInventoryBalances() {
      return demoSeed.inventory.map((item) => {
        const allocatedQuantity = demoSeed.allocations.filter((row) => row.modelCode === item.modelCode && row.status !== "CANCELLED").length;
        return { modelCode: item.modelCode, family: item.family, totalQuantity: item.totalQuantity,
          allocatedQuantity, remainingQuantity: item.totalQuantity - allocatedQuantity };
      });
    },
    async getDashboard(filter) {
      const rows = demoSeed.requests.filter((row) => matches(row, filter)).map((request) => {
        const allocations = demoSeed.allocations.filter((row) => row.requestId === request.id && row.status !== "CANCELLED");
        const ids = new Set(allocations.map((row) => row.id));
        const shipments = demoSeed.shipments.filter((row) => ids.has(row.allocationId));
        return { request, requested: request.quantity, allocated: allocations.length,
          shipped: shipments.length, revenue: shipments.reduce((sum, row) => sum + row.revenue, 0) };
      });
      const groupsFor = (field: "partnerName" | "departmentName" | "teamName" | "salesRep"): DashboardGroup[] => {
        const groups = new Map<string, DashboardGroup>();
        for (const row of rows) {
          const label = row.request[field] || "미분류";
          const group = groups.get(label) ?? { label, requested: 0, allocated: 0, shipped: 0, revenue: 0 };
          group.requested += row.requested; group.allocated += row.allocated;
          group.shipped += row.shipped; group.revenue += row.revenue;
          groups.set(label, group);
        }
        return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, "ko"));
      };
      return {
        totalRequested: rows.reduce((sum, row) => sum + row.requested, 0),
        totalAllocated: rows.reduce((sum, row) => sum + row.allocated, 0),
        totalShipped: rows.reduce((sum, row) => sum + row.shipped, 0),
        confirmedRevenue: rows.reduce((sum, row) => sum + row.revenue, 0),
        byPartner: groupsFor("partnerName"), byDepartment: groupsFor("departmentName"),
        byTeam: groupsFor("teamName"), bySalesRep: groupsFor("salesRep"),
      };
    },
  };
}
