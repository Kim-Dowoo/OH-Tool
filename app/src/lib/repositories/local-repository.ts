import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

import type {
  AllocateInput,
  AllocationRecord,
  DashboardFilter,
  DashboardGroup,
  DashboardSummary,
  ImportCommit,
  ImportCommitResult,
  InventoryBalance,
  OhRepository,
  RequestFilter,
  RequestRecord,
  RequestStatus,
  ShipmentRecord,
  ShipInput,
} from "./contracts";

type QueryValue = string | number;
type SqlRow = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asRequest(row: SqlRow): RequestRecord {
  return {
    id: String(row.id),
    importBatchId: String(row.import_batch_id),
    sourceRow: Number(row.source_row),
    sourceNumber: asNullableString(row.source_number),
    period: String(row.period),
    partnerCode: String(row.partner_code),
    teamRaw: String(row.team_raw),
    departmentName: asNullableString(row.department_name),
    teamName: asNullableString(row.team_name),
    partnerName: String(row.partner_name),
    salesRep: String(row.sales_rep),
    dealType: asNullableString(row.deal_type),
    endUser: asNullableString(row.end_user),
    currentBrand: asNullableString(row.current_brand),
    currentModel: asNullableString(row.current_model),
    requestedModel: String(row.requested_model),
    requestedFamily: String(row.requested_family),
    quantity: Number(row.quantity),
    status: String(row.status) as RequestStatus,
    createdAt: String(row.created_at),
  };
}

function asAllocation(row: SqlRow): AllocationRecord {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    modelCode: String(row.model_code),
    serialNumber: String(row.serial_number),
    storageLocation: asNullableString(row.storage_location),
    status: String(row.status) as AllocationRecord["status"],
    allocatedAt: String(row.allocated_at),
    cancelledAt: asNullableString(row.cancelled_at),
    cancelReason: asNullableString(row.cancel_reason),
  };
}

function asShipment(row: SqlRow): ShipmentRecord {
  return {
    id: String(row.id),
    allocationId: String(row.allocation_id),
    shippedAt: String(row.shipped_at),
    revenue: Number(row.revenue),
    note: asNullableString(row.note),
    createdAt: String(row.created_at),
  };
}

function buildRequestWhere(filter: RequestFilter, alias = "r"): { clause: string; values: QueryValue[] } {
  const clauses: string[] = [];
  const values: QueryValue[] = [];
  const add = (column: string, value: string | undefined, operator = "=") => {
    if (value !== undefined) {
      clauses.push(`${alias}.${column} ${operator} ?`);
      values.push(value);
    }
  };

  add("period", filter.periodFrom, ">=");
  add("period", filter.periodTo, "<=");
  add("partner_code", filter.partnerCode);
  add("department_name", filter.departmentName);
  add("team_name", filter.teamName);
  add("sales_rep", filter.salesRep);
  add("requested_model", filter.modelCode);
  add("status", filter.status);
  return { clause: clauses.length === 0 ? "" : `WHERE ${clauses.join(" AND ")}`, values };
}

export function createLocalRepository(db: Database.Database): OhRepository {
  const writeAuditEvent = (action: string, entityType: string, entityId: string, changedFields: string[]) => {
    db.prepare(
      `INSERT INTO audit_events (id, occurred_at, action, entity_type, entity_id, changed_fields, succeeded)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
    ).run(randomUUID(), now(), action, entityType, entityId, JSON.stringify(changedFields));
  };

  const recalculateRequestStatus = (requestId: string) => {
    const request = db.prepare("SELECT quantity FROM requests WHERE id = ?").get(requestId) as SqlRow | undefined;
    if (!request) throw new Error("요청을 찾을 수 없습니다.");
    const active = db.prepare(
      "SELECT COUNT(*) AS count FROM allocations WHERE request_id = ? AND status IN ('ALLOCATED', 'SHIPPED')",
    ).get(requestId) as SqlRow;
    const allocated = Number(active.count);
    const status: RequestStatus = allocated === 0
      ? "REVIEWED"
      : allocated < Number(request.quantity)
        ? "PARTIALLY_ALLOCATED"
        : "ALLOCATED";
    db.prepare("UPDATE requests SET status = ? WHERE id = ?").run(status, requestId);
  };

  return {
    async saveImportBatch(input: ImportCommit): Promise<ImportCommitResult> {
      const batchId = input.id ?? randomUUID();
      const createdAt = input.createdAt ?? now();
      const rejectedRows = input.rejectedRows ?? 0;
      const rows = input.importType === "REQUESTS"
        ? input.requests ?? []
        : input.importType === "INVENTORY"
          ? input.inventory ?? []
          : input.organizations ?? [];
      const importedRows = input.importedRows ?? rows.length;

      db.transaction(() => {
        db.prepare(
          `INSERT INTO import_batches
            (id, import_type, sha256, source_label, total_rows, imported_rows, rejected_rows, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(batchId, input.importType, input.sha256, input.sourceLabel, input.totalRows, importedRows, rejectedRows, createdAt);

        if (input.importType === "REQUESTS") {
          const insertRequest = db.prepare(
            `INSERT INTO requests (
              id, import_batch_id, source_row, source_number, period, partner_code, team_raw, department_name,
              team_name, partner_name, sales_rep, deal_type, end_user, current_brand, current_model,
              requested_model, requested_family, quantity, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          );
          for (const request of input.requests ?? []) {
            insertRequest.run(
              request.id, batchId, request.sourceRow, request.sourceNumber, request.period, request.partnerCode,
              request.teamRaw, request.departmentName, request.teamName, request.partnerName, request.salesRep,
              request.dealType, request.endUser, request.currentBrand, request.currentModel, request.requestedModel,
              request.requestedFamily, request.quantity, request.status ?? "RECEIVED", createdAt,
            );
          }
        }

        if (input.importType === "INVENTORY") {
          const upsertInventory = db.prepare(
            `INSERT INTO model_inventory (model_code, family, total_quantity, storage_location, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(model_code) DO UPDATE SET
               family = excluded.family,
               total_quantity = excluded.total_quantity,
               storage_location = excluded.storage_location,
               updated_at = excluded.updated_at`,
          );
          for (const inventory of input.inventory ?? []) {
            upsertInventory.run(inventory.modelCode, inventory.family, inventory.totalQuantity, inventory.storageLocation ?? null, createdAt);
          }
        }

        if (input.importType === "ORGANIZATION") {
          const upsertOrganization = db.prepare(
            `INSERT INTO organization_mappings
              (team_raw, department_name, team_name, sales_rep, sales_rep_email, active, updated_at)
             VALUES (?, ?, ?, ?, ?, COALESCE(?, 1), ?)
             ON CONFLICT(team_raw) DO UPDATE SET
               department_name = excluded.department_name,
               team_name = excluded.team_name,
               sales_rep = COALESCE(excluded.sales_rep, organization_mappings.sales_rep),
               sales_rep_email = COALESCE(excluded.sales_rep_email, organization_mappings.sales_rep_email),
               active = CASE WHEN ? IS NULL THEN organization_mappings.active ELSE ? END,
               updated_at = excluded.updated_at`,
          );
          const upsertPartner = db.prepare(
            `INSERT INTO partners
              (partner_code, partner_name, team_raw, department_name, team_name, sales_rep, sales_rep_email, active, updated_at)
             VALUES (?, ?, ?, ?, ?, COALESCE(?, ''), ?, COALESCE(?, 1), ?)
             ON CONFLICT(partner_code) DO UPDATE SET
               partner_name = excluded.partner_name,
               team_raw = excluded.team_raw,
               department_name = excluded.department_name,
               team_name = excluded.team_name,
               sales_rep = CASE WHEN excluded.sales_rep = '' THEN partners.sales_rep ELSE excluded.sales_rep END,
               sales_rep_email = COALESCE(excluded.sales_rep_email, partners.sales_rep_email),
               active = CASE WHEN ? IS NULL THEN partners.active ELSE ? END,
               updated_at = excluded.updated_at`,
          );
          for (const organization of input.organizations ?? []) {
            const organizationActive = organization.active === undefined ? null : organization.active ? 1 : 0;
            upsertOrganization.run(
              organization.teamRaw,
              organization.departmentName,
              organization.teamName,
              organization.salesRep ?? null,
              organization.salesRepEmail ?? null,
              organizationActive,
              createdAt,
              organizationActive,
              organizationActive,
            );
            if (organization.partnerCode && organization.partnerName) {
              const partnerActive = organization.partnerActive === undefined ? null : organization.partnerActive ? 1 : 0;
              upsertPartner.run(
                organization.partnerCode,
                organization.partnerName,
                organization.teamRaw,
                organization.departmentName,
                organization.teamName,
                organization.salesRep ?? null,
                organization.salesRepEmail ?? null,
                partnerActive,
                createdAt,
                partnerActive,
                partnerActive,
              );
            }
          }
        }
        writeAuditEvent("IMPORT_COMMITTED", "import_batch", batchId, ["import_type", "imported_rows", "rejected_rows"]);
      })();

      return { batchId, importedRows, rejectedRows };
    },

    async listRequests(filter: RequestFilter): Promise<RequestRecord[]> {
      const where = buildRequestWhere(filter);
      const rows = db.prepare(`SELECT * FROM requests r ${where.clause} ORDER BY r.created_at, r.id`).all(...where.values) as SqlRow[];
      return rows.map(asRequest);
    },

    async getInventoryBalances(): Promise<InventoryBalance[]> {
      const rows = db.prepare(
        `SELECT
           i.model_code,
           i.family,
           i.total_quantity,
           COUNT(a.id) AS allocated_quantity
         FROM model_inventory i
         LEFT JOIN allocations a ON a.model_code = i.model_code AND a.status IN ('ALLOCATED', 'SHIPPED')
         GROUP BY i.model_code, i.family, i.total_quantity
         ORDER BY i.model_code`,
      ).all() as SqlRow[];
      return rows.map((row) => {
        const totalQuantity = Number(row.total_quantity);
        const allocatedQuantity = Number(row.allocated_quantity);
        return {
          modelCode: String(row.model_code),
          family: String(row.family),
          totalQuantity,
          allocatedQuantity,
          remainingQuantity: totalQuantity - allocatedQuantity,
        };
      });
    },

    async allocate(input: AllocateInput): Promise<AllocationRecord> {
      if (input.serialNumber.trim() === "") throw new Error("SN은 비워 둘 수 없습니다.");
      const allocation = db.transaction(() => {
        const request = db.prepare(
          "SELECT requested_model, quantity, status FROM requests WHERE id = ?",
        ).get(input.requestId) as SqlRow | undefined;
        if (!request) throw new Error("요청을 찾을 수 없습니다.");
        if (request.requested_model !== input.modelCode) throw new Error("요청 기종과 배정 기종이 일치하지 않습니다.");
        if (request.status === "SHIPPED" || request.status === "CANCELLED") {
          throw new Error("종료된 요청에는 배정할 수 없습니다.");
        }
        const requestAllocationCount = db.prepare(
          "SELECT COUNT(*) AS count FROM allocations WHERE request_id = ? AND status IN ('ALLOCATED', 'SHIPPED')",
        ).get(input.requestId) as SqlRow;
        if (Number(requestAllocationCount.count) >= Number(request.quantity)) {
          throw new Error("요청 수량을 초과하여 배정할 수 없습니다.");
        }

        const balance = db.prepare(
          `SELECT i.total_quantity, COUNT(a.id) AS allocated_quantity
           FROM model_inventory i
           LEFT JOIN allocations a ON a.model_code = i.model_code AND a.status IN ('ALLOCATED', 'SHIPPED')
           WHERE i.model_code = ?
           GROUP BY i.model_code, i.total_quantity`,
        ).get(input.modelCode) as SqlRow | undefined;
        if (!balance || Number(balance.allocated_quantity) >= Number(balance.total_quantity)) {
          throw new Error("배정 가능한 수량이 없습니다.");
        }

        const id = input.id ?? randomUUID();
        const allocatedAt = input.allocatedAt ?? now();
        db.prepare(
          `INSERT INTO allocations
            (id, request_id, model_code, serial_number, storage_location, status, allocated_at)
           VALUES (?, ?, ?, ?, ?, 'ALLOCATED', ?)`,
        ).run(id, input.requestId, input.modelCode, input.serialNumber.trim(), input.storageLocation ?? null, allocatedAt);
        recalculateRequestStatus(input.requestId);
        writeAuditEvent("ALLOCATION_CREATED", "allocation", id, ["request_id", "model_code", "serial_number"]);
        return asAllocation(db.prepare("SELECT * FROM allocations WHERE id = ?").get(id) as SqlRow);
      })();
      return allocation;
    },

    async cancelAllocation(allocationId: string, reason: string): Promise<void> {
      if (reason.trim() === "") throw new Error("취소 사유를 입력해야 합니다.");
      db.transaction(() => {
        const allocation = db.prepare("SELECT * FROM allocations WHERE id = ?").get(allocationId) as SqlRow | undefined;
        if (!allocation) throw new Error("배정을 찾을 수 없습니다.");
        if (allocation.status === "SHIPPED") throw new Error("출고된 배정은 취소할 수 없습니다.");
        db.prepare(
          "UPDATE allocations SET status = 'CANCELLED', cancelled_at = ?, cancel_reason = ? WHERE id = ?",
        ).run(now(), reason.trim(), allocationId);
        recalculateRequestStatus(String(allocation.request_id));
        writeAuditEvent("ALLOCATION_CANCELLED", "allocation", allocationId, ["status", "cancelled_at", "cancel_reason"]);
      })();
    },

    async ship(input: ShipInput): Promise<ShipmentRecord> {
      if (!Number.isInteger(input.revenue) || input.revenue < 0) throw new Error("매출은 0 이상의 정수여야 합니다.");
      const shipment = db.transaction(() => {
        const allocation = db.prepare("SELECT * FROM allocations WHERE id = ?").get(input.allocationId) as SqlRow | undefined;
        if (!allocation) throw new Error("배정을 찾을 수 없습니다.");
        if (allocation.status !== "ALLOCATED") throw new Error("배정 가능한 상태가 아닙니다.");

        const id = input.id ?? randomUUID();
        const createdAt = input.createdAt ?? now();
        db.prepare(
          `INSERT INTO shipments (id, allocation_id, shipped_at, revenue, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(id, input.allocationId, input.shippedAt, input.revenue, input.note ?? null, createdAt);
        db.prepare("UPDATE allocations SET status = 'SHIPPED' WHERE id = ?").run(input.allocationId);

        const request = db.prepare("SELECT quantity FROM requests WHERE id = ?").get(allocation.request_id) as SqlRow;
        const shipped = db.prepare(
          "SELECT COUNT(*) AS count FROM allocations WHERE request_id = ? AND status = 'SHIPPED'",
        ).get(allocation.request_id) as SqlRow;
        if (Number(shipped.count) >= Number(request.quantity)) {
          db.prepare("UPDATE requests SET status = 'SHIPPED' WHERE id = ?").run(allocation.request_id);
        } else {
          recalculateRequestStatus(String(allocation.request_id));
        }
        writeAuditEvent("SHIPMENT_CREATED", "shipment", id, ["allocation_id", "shipped_at", "revenue"]);
        return asShipment(db.prepare("SELECT * FROM shipments WHERE id = ?").get(id) as SqlRow);
      })();
      return shipment;
    },

    async getDashboard(filter: DashboardFilter): Promise<DashboardSummary> {
      const where = buildRequestWhere(filter);
      const metricsCte = `
        WITH filtered_requests AS (
          SELECT * FROM requests r ${where.clause}
        ), allocation_metrics AS (
          SELECT
            r.id AS request_id,
            COUNT(CASE WHEN a.status IN ('ALLOCATED', 'SHIPPED') THEN a.id END) AS allocated,
            COUNT(s.id) AS shipped,
            COALESCE(SUM(s.revenue), 0) AS revenue
          FROM filtered_requests r
          LEFT JOIN allocations a ON a.request_id = r.id
          LEFT JOIN shipments s ON s.allocation_id = a.id
          GROUP BY r.id
        )`;
      const totals = db.prepare(
        `${metricsCte}
         SELECT
           COALESCE(SUM(r.quantity), 0) AS total_requested,
           COALESCE(SUM(m.allocated), 0) AS total_allocated,
           COALESCE(SUM(m.shipped), 0) AS total_shipped,
           COALESCE(SUM(m.revenue), 0) AS confirmed_revenue
         FROM filtered_requests r
         LEFT JOIN allocation_metrics m ON m.request_id = r.id`,
      ).get(...where.values) as SqlRow;

      const groupsFor = (column: "partner_name" | "department_name" | "team_name" | "sales_rep"): DashboardGroup[] => {
        const rows = db.prepare(
          `${metricsCte}
           SELECT
             COALESCE(NULLIF(r.${column}, ''), '미분류') AS label,
             COALESCE(SUM(r.quantity), 0) AS requested,
             COALESCE(SUM(m.allocated), 0) AS allocated,
             COALESCE(SUM(m.shipped), 0) AS shipped,
             COALESCE(SUM(m.revenue), 0) AS revenue
           FROM filtered_requests r
           LEFT JOIN allocation_metrics m ON m.request_id = r.id
           GROUP BY label
           ORDER BY label`,
        ).all(...where.values) as SqlRow[];
        return rows.map((row) => ({
          label: String(row.label),
          requested: Number(row.requested),
          allocated: Number(row.allocated),
          shipped: Number(row.shipped),
          revenue: Number(row.revenue),
        }));
      };

      return {
        totalRequested: Number(totals.total_requested),
        totalAllocated: Number(totals.total_allocated),
        totalShipped: Number(totals.total_shipped),
        confirmedRevenue: Number(totals.confirmed_revenue),
        byPartner: groupsFor("partner_name"),
        byDepartment: groupsFor("department_name"),
        byTeam: groupsFor("team_name"),
        bySalesRep: groupsFor("sales_rep"),
      };
    },
  };
}
