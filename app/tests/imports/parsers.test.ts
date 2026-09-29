import { describe, expect, it } from "vitest";

import { parseInventoryWorkbook } from "@/features/imports/inventory-parser";
import { normalizePeriod, normalizeSerialNumber } from "@/features/imports/normalize";
import { parseOrganizationWorkbook } from "@/features/imports/organization-parser";
import { parseRequestWorkbook } from "@/features/imports/request-parser";
import { buildRequestWorkbook, buildWorkbook, requestHeaders } from "../helpers/build-workbook";

const request = (number: unknown, period: unknown = 26.9, model = "MODEL-A") => [
  number, period, "DEMO001", "가상영업부 가상팀", "파트너A", "영업01", "RCM",
  "고객A", "BrandA", "Old-A", model, 1, "FAMILY-A",
];

describe("request workbook", () => {
  it("normalizes a numeric period and skips the Sample row", async () => {
    const result = await parseRequestWorkbook(await buildRequestWorkbook([
      request("Sample", 26.09), request(1, 26.9),
    ]));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ sourceRow: 4, period: "26.09", partnerCode: "DEMO001", quantity: 1 });
  });

  it("rejects an uncertain header without guessing columns", async () => {
    const headers = [...requestHeaders];
    headers[10] = "unknown";
    const result = await parseRequestWorkbook(await buildWorkbook([["title"], headers, request(1)]));
    expect(result.rows).toHaveLength(0);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "MISSING_HEADERS" }));
  });

  it("rejects formulas in critical cells even with a cached result", async () => {
    const row = request(1);
    row[10] = { formula: '"MODEL-A"', result: "MODEL-A" };
    const result = await parseRequestWorkbook(await buildRequestWorkbook([row]));
    expect(result.rows).toHaveLength(0);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "FORMULA_CELL", sourceRow: 3, column: "요청 기종" }));
  });

  it("reports a formula in the row-number column instead of silently skipping it", async () => {
    const row = request(1);
    row[0] = { formula: "1+1", result: 2 };
    const result = await parseRequestWorkbook(await buildRequestWorkbook([row]));
    expect(result.rows).toHaveLength(0);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "FORMULA_CELL", sourceRow: 3, column: "#" }));
  });

  it("rejects ambiguous duplicate header names", async () => {
    const headers = [...requestHeaders, "요청 기종"];
    const result = await parseRequestWorkbook(await buildWorkbook([["title"], headers, request(1)]));
    expect(result.rows).toHaveLength(0);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "MISSING_HEADERS" }));
  });

  it("skips unnumbered rows but reports numbered invalid rows", async () => {
    const bad = request(2);
    bad[11] = 0;
    const result = await parseRequestWorkbook(await buildRequestWorkbook([request(null), bad]));
    expect(result.rows).toHaveLength(0);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "INVALID_QUANTITY", sourceRow: 4 }));
    expect(result.issues).not.toContainEqual(expect.objectContaining({ sourceRow: 3 }));
  });

  it("retains duplicate candidates and warns for review", async () => {
    const result = await parseRequestWorkbook(await buildRequestWorkbook([request(1), request(2)]));
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].candidateKey).not.toBe(result.rows[1].candidateKey);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "DUPLICATE_CANDIDATE", sourceRow: 4 }));
  });
});

describe("inventory workbook", () => {
  const summary = ["Family", "ITEM CODE", "배정 가능 수량", "배정 수량", "잔여 수량"];
  const detail = ["Family", "ITEM CODE", "SN", "보관장소", "파트너사명", "배정 월도", "배정 여부", "배정 확인"];

  it("finds both sections and preserves SN as a string", async () => {
    const result = await parseInventoryWorkbook(await buildWorkbook([
      ["inventory"], summary, ["FAMILY-A", "MODEL-A", 2, 1, 1], [],
      detail, ["FAMILY-A", "MODEL-A", 123, "Shelf", "파트너A", 26.9, 1, "확인"],
    ]));
    expect(result.rows).toContainEqual(expect.objectContaining({ section: "SUMMARY", modelCode: "MODEL-A", totalQuantity: 2 }));
    expect(result.rows).toContainEqual(expect.objectContaining({ section: "DETAIL", serialNumber: "123" }));
  });

  it("warns when Summary allocations disagree with Detail", async () => {
    const result = await parseInventoryWorkbook(await buildWorkbook([
      summary, ["FAMILY-A", "MODEL-A", 2, 2, 0], [], detail,
      ["FAMILY-A", "MODEL-A", "000123", "Shelf", "파트너A", "26.09", 1, "확인"],
    ]));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "RECONCILIATION_MISMATCH", severity: "warning" }));
    expect(result.rows).toContainEqual(expect.objectContaining({ section: "DETAIL", serialNumber: "000123" }));
  });

  it("accepts minimal Summary and Detail section headers", async () => {
    const result = await parseInventoryWorkbook(await buildWorkbook([
      ["Family", "ITEM CODE", "배정 가능 수량"], ["FAMILY-A", "MODEL-A", 3],
      [], ["Family", "ITEM CODE", "SN"], ["FAMILY-A", "MODEL-A", "SN-1"],
    ]));
    expect(result.rows).toContainEqual(expect.objectContaining({ section: "SUMMARY", totalQuantity: 3 }));
    expect(result.rows).toContainEqual(expect.objectContaining({ section: "DETAIL", serialNumber: "SN-1" }));
    expect(result.issues).toHaveLength(0);
  });

  it("finds a Detail header after row 100 within the supported worksheet", async () => {
    const filler = Array.from({ length: 99 }, () => [] as unknown[]);
    const result = await parseInventoryWorkbook(await buildWorkbook([
      summary, ["FAMILY-A", "MODEL-A", 2, 1, 1], ...filler,
      detail, ["FAMILY-A", "MODEL-A", "SN-1", "Shelf", "파트너A", "26.09", 1, "확인"],
    ]));
    expect(result.issues).not.toContainEqual(expect.objectContaining({ code: "MISSING_HEADERS" }));
    expect(result.rows).toContainEqual(expect.objectContaining({ section: "DETAIL", sourceRow: 103, serialNumber: "SN-1" }));
  });

  it("rejects a repeated Detail SN instead of returning it for import", async () => {
    const result = await parseInventoryWorkbook(await buildWorkbook([
      summary, ["FAMILY-A", "MODEL-A", 2, 0, 2], detail,
      ["FAMILY-A", "MODEL-A", "SN-1"], ["FAMILY-A", "MODEL-A", "SN-1"],
    ]));
    expect(result.rows.filter((row) => row.section === "DETAIL")).toHaveLength(1);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "DUPLICATE_SN", sourceRow: 5 }));
  });

  it("rejects formula quantities and SN cells", async () => {
    const result = await parseInventoryWorkbook(await buildWorkbook([
      summary, ["FAMILY-A", "MODEL-A", { formula: "1+1", result: 2 }, 0, 2],
      detail, ["FAMILY-A", "MODEL-A", { formula: '"SN-1"', result: "SN-1" }],
    ]));
    expect(result.rows).toHaveLength(0);
    expect(result.issues.filter((issue) => issue.code === "FORMULA_CELL")).toHaveLength(2);
  });

  it("reports formula-only rows in both inventory sections", async () => {
    const result = await parseInventoryWorkbook(await buildWorkbook([
      summary, [{ formula: '"FAMILY-A"' }], detail,
      [null, null, { formula: '"SN-1"' }],
    ]));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "FORMULA_CELL", sourceRow: 2, column: "Family" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "FORMULA_CELL", sourceRow: 4, column: "SN" }));
  });

  it("warns on an allocated Detail model absent from Summary", async () => {
    const result = await parseInventoryWorkbook(await buildWorkbook([
      summary, ["FAMILY-A", "MODEL-A", 2, 0, 2], detail,
      ["FAMILY-B", "MODEL-B", "SN-B", "Shelf", "파트너A", "26.09", 1, "확인"],
    ]));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "MISSING_SUMMARY_MODEL", severity: "warning", sourceRow: 4 }));
  });

  it("warns on a Detail Family that differs from its Summary model", async () => {
    const result = await parseInventoryWorkbook(await buildWorkbook([
      summary, ["FAMILY-A", "MODEL-A", 2, 1, 1], detail,
      ["FAMILY-B", "MODEL-A", "SN-A", "Shelf", "파트너A", "26.09", 1, "확인"],
    ]));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "FAMILY_MISMATCH", severity: "warning", sourceRow: 4 }));
  });
});

describe("organization workbook", () => {
  it("preserves raw team and leaves department mapping unset", async () => {
    const result = await parseOrganizationWorkbook(await buildWorkbook([
      ["organization"], ["ITSS CODE", "Team", "파트너사명", "담당 DM"],
      ["DEMO001", "가상영업부 가상팀", "파트너A", "영업01"],
    ]));
    expect(result.rows[0]).toMatchObject({ partnerCode: "DEMO001", teamRaw: "가상영업부 가상팀", departmentName: null, teamName: null, sourceRow: 3 });
  });

  it("reports a formula-only organization row", async () => {
    const result = await parseOrganizationWorkbook(await buildWorkbook([
      ["ITSS CODE", "Team", "파트너사명", "담당 DM"],
      [{ formula: '"DEMO001"' }],
    ]));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "FORMULA_CELL", sourceRow: 2, column: "ITSS CODE" }));
  });
});

it("normalizes periods and text serials without losing leading zeroes", () => {
  expect(normalizePeriod(26.9)).toBe("26.09");
  expect(normalizePeriod("26/12")).toBe("26.12");
  expect(normalizePeriod("26.13")).toBeNull();
  expect(normalizeSerialNumber(" 000123 ")).toBe("000123");
  expect(normalizeSerialNumber(123)).toBe("123");
});
