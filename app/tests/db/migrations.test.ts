import { describe, expect, it } from "vitest";

import { runMigrations } from "@/lib/db/migrations";
import { createAllocation, createTestDatabase, seedRequestAndInventory } from "../helpers/fixtures";

describe("initial SQLite migration", () => {
  it("rejects a duplicate serial number", () => {
    const db = createTestDatabase();
    runMigrations(db);
    seedRequestAndInventory(db);
    createAllocation(db, { requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-001" });

    expect(() =>
      createAllocation(db, { requestId: "REQ-2", modelCode: "MODEL-A", serialNumber: "SN-001" }),
    ).toThrow();
  });

  it("enforces foreign keys and nonnegative inventory totals", () => {
    const db = createTestDatabase();
    runMigrations(db);

    expect(() =>
      db.prepare(
        `INSERT INTO model_inventory (model_code, family, total_quantity, updated_at)
         VALUES ('MODEL-A', 'FAMILY-A', -1, '2026-09-17T00:00:00.000Z')`,
      ).run(),
    ).toThrow();
    expect(() =>
      db.prepare(
        `INSERT INTO allocations (id, request_id, model_code, serial_number, status, allocated_at)
         VALUES ('A-1', 'UNKNOWN', 'UNKNOWN', 'SN-001', 'ALLOCATED', '2026-09-17T00:00:00.000Z')`,
      ).run(),
    ).toThrow();
  });
});
