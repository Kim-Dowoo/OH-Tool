import { describe, expect, it } from "vitest";

import { runMigrations } from "@/lib/db/migrations";
import { createLocalRepository } from "@/lib/repositories/local-repository";
import type { RequestImportRecord } from "@/lib/repositories/contracts";
import { createTestDatabase, seedRequestAndInventory } from "../helpers/fixtures";

describe("local repository", () => {
  it("allocates an available serial number and updates the request balance", async () => {
    const db = createTestDatabase();
    runMigrations(db);
    seedRequestAndInventory(db);
    const repository = createLocalRepository(db);

    const allocation = await repository.allocate({
      id: "A-1",
      requestId: "REQ-1",
      modelCode: "MODEL-A",
      serialNumber: "SN-001",
      allocatedAt: "2026-09-17T00:00:00.000Z",
    });

    expect(allocation.status).toBe("ALLOCATED");
    await expect(repository.getInventoryBalances()).resolves.toEqual([
      {
        modelCode: "MODEL-A",
        family: "FAMILY-A",
        totalQuantity: 2,
        allocatedQuantity: 1,
        remainingQuantity: 1,
      },
    ]);
    await expect(repository.listRequests({ status: "ALLOCATED" })).resolves.toHaveLength(1);
  });

  it("rolls back allocation changes when the serial number is already assigned", async () => {
    const db = createTestDatabase();
    runMigrations(db);
    seedRequestAndInventory(db);
    const repository = createLocalRepository(db);
    await repository.allocate({ requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-001" });

    await expect(
      repository.allocate({ requestId: "REQ-2", modelCode: "MODEL-A", serialNumber: "SN-001" }),
    ).rejects.toThrow();

    await expect(repository.listRequests({ status: "REVIEWED" })).resolves.toHaveLength(1);
    await expect(repository.getInventoryBalances()).resolves.toMatchObject([
      { modelCode: "MODEL-A", allocatedQuantity: 1, remainingQuantity: 1 },
    ]);
  });

  it("counts a request quantity once when it has multiple allocations", async () => {
    const db = createTestDatabase();
    runMigrations(db);
    seedRequestAndInventory(db);
    db.prepare("UPDATE requests SET quantity = 2 WHERE id = 'REQ-1'").run();
    const repository = createLocalRepository(db);
    await repository.allocate({ requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-001" });
    await repository.allocate({ requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-002" });

    await expect(repository.getDashboard({})).resolves.toMatchObject({
      totalRequested: 3,
      totalAllocated: 2,
      totalShipped: 0,
      confirmedRevenue: 0,
    });
  });

  it("persists a nonblank cancellation reason without placing the value in audit fields", async () => {
    const db = createTestDatabase();
    runMigrations(db);
    seedRequestAndInventory(db);
    const repository = createLocalRepository(db);
    await repository.allocate({ id: "A-1", requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-001" });

    await repository.cancelAllocation("A-1", "Customer cancelled");

    expect(db.prepare("SELECT cancel_reason FROM allocations WHERE id = 'A-1'").get()).toEqual({
      cancel_reason: "Customer cancelled",
    });
    expect(db.prepare("SELECT changed_fields FROM audit_events WHERE entity_id = 'A-1' AND action = 'ALLOCATION_CANCELLED'").get()).toEqual({
      changed_fields: '["status","cancelled_at","cancel_reason"]',
    });
  });

  it("rejects allocation for terminal requests and requests already at their quantity", async () => {
    const db = createTestDatabase();
    runMigrations(db);
    seedRequestAndInventory(db);
    const repository = createLocalRepository(db);
    await repository.allocate({ requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-001" });

    await expect(
      repository.allocate({ requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-002" }),
    ).rejects.toThrow();
    db.prepare("UPDATE requests SET status = 'CANCELLED' WHERE id = 'REQ-2'").run();
    await expect(
      repository.allocate({ requestId: "REQ-2", modelCode: "MODEL-A", serialNumber: "SN-003" }),
    ).rejects.toThrow();
  });

  it("does not mark a partially allocated request shipped", async () => {
    const db = createTestDatabase();
    runMigrations(db);
    seedRequestAndInventory(db);
    db.prepare("UPDATE requests SET quantity = 2 WHERE id = 'REQ-1'").run();
    const repository = createLocalRepository(db);
    await repository.allocate({ id: "A-1", requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-001" });

    await repository.ship({ id: "S-1", allocationId: "A-1", shippedAt: "2026-09-17", revenue: 0 });

    await expect(repository.listRequests({ status: "PARTIALLY_ALLOCATED" })).resolves.toHaveLength(1);
  });

  it("ships through the repository with exactly one matching shipment row", async () => {
    const db = createTestDatabase();
    runMigrations(db);
    seedRequestAndInventory(db);
    const repository = createLocalRepository(db);
    await repository.allocate({ id: "A-1", requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-001" });

    await repository.ship({ id: "S-1", allocationId: "A-1", shippedAt: "2026-09-17", revenue: 0 });

    expect(db.prepare("SELECT status FROM allocations WHERE id = 'A-1'").get()).toEqual({ status: "SHIPPED" });
    expect(db.prepare("SELECT COUNT(*) AS count FROM shipments WHERE allocation_id = 'A-1'").get()).toEqual({ count: 1 });
  });

  it("rejects inventory imports that would reduce total below active allocations", async () => {
    const db = createTestDatabase();
    runMigrations(db);
    seedRequestAndInventory(db);
    const repository = createLocalRepository(db);
    await repository.allocate({ requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-001" });

    await expect(repository.saveImportBatch({
      id: "INVENTORY-BATCH",
      importType: "INVENTORY",
      sha256: "inventory-hash",
      sourceLabel: "synthetic-inventory.xlsx",
      totalRows: 1,
      inventory: [{ modelCode: "MODEL-A", family: "FAMILY-A", totalQuantity: 0 }],
    })).rejects.toThrow();
    expect(db.prepare("SELECT total_quantity FROM model_inventory WHERE model_code = 'MODEL-A'").get()).toEqual({
      total_quantity: 2,
    });
  });

  it("rolls back a complete import batch when a later row fails", async () => {
    const db = createTestDatabase();
    runMigrations(db);
    const repository = createLocalRepository(db);
    const request = (id: string, sourceRow: number): RequestImportRecord => ({
      id,
      sourceRow,
      sourceNumber: `SYN-${sourceRow}`,
      period: "26.09",
      partnerCode: "PARTNER-1",
      teamRaw: "Synthetic team",
      departmentName: null,
      teamName: null,
      partnerName: "Synthetic Partner",
      salesRep: "Synthetic Rep",
      dealType: null,
      endUser: null,
      currentBrand: null,
      currentModel: null,
      requestedModel: "MODEL-A",
      requestedFamily: "FAMILY-A",
      quantity: 1,
    });

    await expect(repository.saveImportBatch({
      id: "REQUEST-BATCH",
      importType: "REQUESTS",
      sha256: "request-hash",
      sourceLabel: "synthetic-requests.xlsx",
      totalRows: 2,
      requests: [request("REQ-1", 2), request("REQ-2", 2)],
    })).rejects.toThrow();

    expect(db.prepare("SELECT COUNT(*) AS count FROM import_batches").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM requests").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM audit_events").get()).toEqual({ count: 0 });
  });

  it("preserves disabled organization and partner records when re-import omits active flags", async () => {
    const db = createTestDatabase();
    runMigrations(db);
    const repository = createLocalRepository(db);

    await repository.saveImportBatch({
      id: "ORG-BATCH-1",
      importType: "ORGANIZATION",
      sha256: "organization-hash-1",
      sourceLabel: "synthetic-organization.xlsx",
      totalRows: 1,
      organizations: [{
        teamRaw: "Raw Team",
        departmentName: "Department",
        teamName: "Team",
        salesRep: "Sales Rep",
        active: false,
        partnerCode: "P-1",
        partnerName: "Partner",
        partnerActive: false,
      }],
    });
    await repository.saveImportBatch({
      id: "ORG-BATCH-2",
      importType: "ORGANIZATION",
      sha256: "organization-hash-2",
      sourceLabel: "synthetic-organization.xlsx",
      totalRows: 1,
      organizations: [{
        teamRaw: "Raw Team",
        departmentName: "Department",
        teamName: "Team",
        salesRep: "Sales Rep",
        partnerCode: "P-1",
        partnerName: "Partner",
      }],
    });

    expect(db.prepare("SELECT active FROM organization_mappings WHERE team_raw = 'Raw Team'").get()).toEqual({ active: 0 });
    expect(db.prepare("SELECT active FROM partners WHERE partner_code = 'P-1'").get()).toEqual({ active: 0 });
  });

  it("persists a partner identity and its organization relation without a sales representative", async () => {
    const db = createTestDatabase();
    runMigrations(db);
    const repository = createLocalRepository(db);

    await repository.saveImportBatch({
      id: "ORG-BATCH-1",
      importType: "ORGANIZATION",
      sha256: "organization-hash-1",
      sourceLabel: "synthetic-organization.xlsx",
      totalRows: 1,
      organizations: [{
        teamRaw: "Raw Team",
        departmentName: "Department",
        teamName: "Team",
        partnerCode: "P-1",
        partnerName: "Partner",
      }],
    });

    expect(db.prepare("SELECT team_raw, department_name, team_name FROM partners WHERE partner_code = 'P-1'").get()).toEqual({
      team_raw: "Raw Team",
      department_name: "Department",
      team_name: "Team",
    });
  });
});
