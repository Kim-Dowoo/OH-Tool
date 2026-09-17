import Database from "better-sqlite3";

import type { AllocateInput, AllocationRecord } from "@/lib/repositories/contracts";

export function createTestDatabase(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  return db;
}

export function seedRequestAndInventory(db: Database.Database): void {
  db.prepare(
    `INSERT INTO import_batches
      (id, import_type, sha256, source_label, total_rows, imported_rows, rejected_rows, created_at)
     VALUES (?, 'REQUESTS', ?, 'synthetic-requests.xlsx', 2, 2, 0, ?)`
  ).run("BATCH-1", "fixture-request-hash", "2026-09-17T00:00:00.000Z");

  db.prepare(
    `INSERT INTO model_inventory (model_code, family, total_quantity, storage_location, updated_at)
     VALUES ('MODEL-A', 'FAMILY-A', 2, 'Synthetic shelf', ?)`
  ).run("2026-09-17T00:00:00.000Z");

  const insertRequest = db.prepare(
    `INSERT INTO requests (
      id, import_batch_id, source_row, source_number, period, partner_code, team_raw,
      partner_name, sales_rep, requested_model, requested_family, quantity, status, created_at
    ) VALUES (?, 'BATCH-1', ?, ?, '26.09', 'PARTNER-1', 'Synthetic team',
      'Synthetic Partner', 'Synthetic Rep', 'MODEL-A', 'FAMILY-A', 1, 'REVIEWED', ?)`
  );
  insertRequest.run("REQ-1", 2, "SYN-001", "2026-09-17T00:00:00.000Z");
  insertRequest.run("REQ-2", 3, "SYN-002", "2026-09-17T00:00:00.000Z");
}

export function createAllocation(db: Database.Database, input: AllocateInput): AllocationRecord {
  const allocatedAt = input.allocatedAt ?? "2026-09-17T00:00:00.000Z";
  const id = input.id ?? `ALLOCATION-${input.serialNumber}`;
  db.prepare(
    `INSERT INTO allocations
      (id, request_id, model_code, serial_number, storage_location, status, allocated_at)
     VALUES (?, ?, ?, ?, ?, 'ALLOCATED', ?)`
  ).run(id, input.requestId, input.modelCode, input.serialNumber, input.storageLocation ?? null, allocatedAt);

  return {
    id,
    requestId: input.requestId,
    modelCode: input.modelCode,
    serialNumber: input.serialNumber,
    storageLocation: input.storageLocation ?? null,
    status: "ALLOCATED",
    allocatedAt,
    cancelledAt: null,
    cancelReason: null,
  };
}
