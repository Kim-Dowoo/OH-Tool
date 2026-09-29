import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoRepository } from "@/lib/repositories/demo-repository";
import { demoSeed } from "@/demo/seed";
import { getMutationDenial } from "@/lib/security/mutation-guard";

afterEach(() => vi.unstubAllEnvs());

describe("synthetic demo boundary", () => {
  it("rejects every repository mutation without changing the snapshot", async () => {
    const repository = createDemoRepository();
    const before = await repository.getDashboard({});
    const mutations = [
      () => repository.allocate({ requestId: "DEMO-R1", modelCode: "DEMO-100", serialNumber: "DEMO-SN-001" }),
      () => repository.ship({ allocationId: "DEMO-A1", shippedAt: "2026-09-15", revenue: 1 }),
      () => repository.cancelAllocation("DEMO-A1", "가상 취소"),
      () => repository.saveImportBatch({ importType: "REQUESTS", sha256: "DEMO", sourceLabel: "가상", totalRows: 0 }),
    ];
    for (const mutate of mutations) await expect(mutate()).rejects.toThrow("데모에서는 변경할 수 없습니다.");
    expect(await repository.getDashboard({})).toEqual(before);
  });

  it("derives quantities and revenue consistently from synthetic records", async () => {
    const repository = createDemoRepository();
    expect(await repository.getDashboard({})).toMatchObject({
      totalRequested: 42, totalAllocated: 28, totalShipped: 18, confirmedRevenue: 27_000_000,
    });
    expect(await repository.getInventoryBalances()).toEqual([
      { modelCode: "DEMO-100", family: "가상 컴팩트", totalQuantity: 24, allocatedQuantity: 15, remainingQuantity: 9 },
      { modelCode: "DEMO-200", family: "가상 스탠다드", totalQuantity: 18, allocatedQuantity: 9, remainingQuantity: 9 },
      { modelCode: "DEMO-300", family: "가상 프리미엄", totalQuantity: 14, allocatedQuantity: 4, remainingQuantity: 10 },
    ]);
    expect(demoSeed.allocations.length).toBe(28);
    expect(demoSeed.allocations.every((row) => row.serialNumber.startsWith("DEMO-"))).toBe(true);
  });

  it("honors all request filters and returns independent read results", async () => {
    const repository = createDemoRepository();
    const rows = await repository.listRequests({});
    const first = rows[0];
    for (const filter of [
      { periodFrom: "2026-10" }, { periodTo: "2026-08" }, { partnerCode: "missing" },
      { departmentName: "missing" }, { teamName: "missing" }, { salesRep: "missing" },
      { modelCode: "missing" }, { status: "CANCELLED" as const },
    ]) expect(await repository.listRequests(filter)).toEqual([]);
    expect(await repository.listRequests({ partnerCode: first.partnerCode, modelCode: first.requestedModel })).toHaveLength(1);
    expect(await repository.getDashboard({ teamName: "새봄팀(가상)" })).toMatchObject({
      totalRequested: 20, totalAllocated: 15, totalShipped: 10, confirmedRevenue: 15_000_000,
      byTeam: [{ label: "새봄팀(가상)", requested: 20, allocated: 15, shipped: 10, revenue: 15_000_000 }],
    });
    rows[0].quantity = 999;
    expect((await repository.listRequests({}))[0].quantity).toBe(12);
  });

  it("denies demo mutations before a caller needs to inspect a body", async () => {
    vi.stubEnv("APP_MODE", "demo");
    const denial = getMutationDenial();
    expect(denial?.status).toBe(403);
    expect(await denial?.json()).toEqual({ error: "데모에서는 변경할 수 없습니다." });
    vi.stubEnv("APP_MODE", "local");
    vi.stubEnv("VERCEL", "");
    expect(getMutationDenial()).toBeNull();
    vi.stubEnv("VERCEL", "1");
    expect(() => getMutationDenial()).toThrow("Vercel에서는 APP_MODE=demo만 허용됩니다.");
  });
});
