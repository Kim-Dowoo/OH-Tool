import { describe, expect, it } from "vitest";

import { runMigrations } from "@/lib/db/migrations";
import { createLocalRepository } from "@/lib/repositories/local-repository";
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
});
