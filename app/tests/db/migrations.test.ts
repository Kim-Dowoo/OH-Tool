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

  it("blocks direct allocations beyond either the request or model capacity", () => {
    const db = createTestDatabase();
    runMigrations(db);
    seedRequestAndInventory(db);
    createAllocation(db, { id: "A-1", requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-001" });

    expect(() =>
      createAllocation(db, { id: "A-2", requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-002" }),
    ).toThrow();
    expect(() =>
      db.prepare("UPDATE model_inventory SET total_quantity = 0 WHERE model_code = 'MODEL-A'").run(),
    ).toThrow();
  });

  it("preserves active organization and partner relationships", () => {
    const db = createTestDatabase();
    runMigrations(db);

    db.prepare(
      `INSERT INTO organization_mappings
        (team_raw, department_name, team_name, sales_rep, sales_rep_email, active, updated_at)
       VALUES ('Raw Team', 'Department', 'Team', 'Sales Rep', 'rep@example.invalid', 1, '2026-09-17T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO partners
        (partner_code, partner_name, team_raw, department_name, team_name, sales_rep, sales_rep_email, active, updated_at)
       VALUES ('P-1', 'Partner', 'Raw Team', 'Department', 'Team', 'Sales Rep', 'rep@example.invalid', 1, '2026-09-17T00:00:00.000Z')`,
    ).run();

    expect(db.prepare("SELECT team_raw, active FROM partners WHERE partner_code = 'P-1'").get()).toEqual({
      team_raw: "Raw Team",
      active: 1,
    });
  });

  it("upgrades a database created by the original initial migration", () => {
    const db = createTestDatabase();
    db.exec(`
      CREATE TABLE allocations (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        model_code TEXT NOT NULL,
        serial_number TEXT NOT NULL UNIQUE,
        storage_location TEXT,
        status TEXT NOT NULL,
        allocated_at TEXT NOT NULL,
        cancelled_at TEXT
      );
    `);

    runMigrations(db);

    expect(db.prepare("SELECT name FROM pragma_table_info('allocations') WHERE name = 'cancel_reason'").get()).toEqual({
      name: "cancel_reason",
    });
  });

  it("blocks direct active-allocation updates that violate request state or request capacity", () => {
    const db = createTestDatabase();
    runMigrations(db);
    seedRequestAndInventory(db);
    createAllocation(db, { id: "A-1", requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-001" });
    createAllocation(db, { id: "A-2", requestId: "REQ-2", modelCode: "MODEL-A", serialNumber: "SN-002" });
    db.prepare("UPDATE requests SET status = 'CANCELLED' WHERE id = 'REQ-2'").run();

    expect(() => db.prepare("UPDATE allocations SET request_id = 'REQ-2' WHERE id = 'A-1'").run()).toThrow();

    db.prepare("UPDATE requests SET status = 'REVIEWED', quantity = 2 WHERE id = 'REQ-1'").run();
    db.prepare("UPDATE allocations SET request_id = 'REQ-1' WHERE id = 'A-2'").run();
    expect(() => db.prepare("UPDATE requests SET quantity = 1 WHERE id = 'REQ-1'").run()).toThrow();
  });

  it("blocks moving an active allocation to a zero-capacity model", () => {
    const db = createTestDatabase();
    runMigrations(db);
    seedRequestAndInventory(db);
    db.prepare(
      `INSERT INTO model_inventory (model_code, family, total_quantity, updated_at)
       VALUES ('MODEL-B', 'FAMILY-B', 0, '2026-09-17T00:00:00.000Z')`,
    ).run();
    createAllocation(db, { id: "A-1", requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-001" });

    expect(() => db.prepare("UPDATE allocations SET model_code = 'MODEL-B' WHERE id = 'A-1'").run()).toThrow();
  });
});
