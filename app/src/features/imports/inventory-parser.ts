import { loadSafeWorkbook } from "@/lib/security/file-safety";
import { cellText, columnCell, findHeaders, isFormula, normalizePeriod, normalizeSerialNumber } from "./normalize";
import type { ImportIssue, InventoryDetailRow, InventoryImportRow, InventorySummaryRow, ParseResult } from "./types";

const SUMMARY_HEADERS = ["Family", "ITEM CODE", "배정 가능 수량"] as const;
const DETAIL_HEADERS = ["Family", "ITEM CODE", "SN"] as const;
const SUMMARY_FIELDS = [...SUMMARY_HEADERS, "배정 수량", "잔여 수량"] as const;
const DETAIL_FIELDS = [...DETAIL_HEADERS, "보관장소", "파트너사명", "배정 월도", "배정 여부", "배정 확인"] as const;

export async function parseInventoryWorkbook(buffer: Buffer): Promise<ParseResult<InventoryImportRow>> {
  const workbook = await loadSafeWorkbook(buffer);
  const sheet = workbook.worksheets[0];
  const rows: InventoryImportRow[] = [];
  const issues: ImportIssue[] = [];
  const result = { rows, issues, sheetName: sheet.name, skippedSampleRows: [] as number[] };
  const summary = findHeaders(sheet, SUMMARY_HEADERS, sheet.rowCount);
  const detail = findHeaders(sheet, DETAIL_HEADERS, sheet.rowCount);
  if (!summary || !detail || summary.row === detail.row) {
    issues.push({ code: "MISSING_HEADERS", message: "Summary or Detail inventory headers were not found", severity: "error" });
    return result;
  }

  const parseQuantity = (value: string): number | null => {
    if (!/^\d+$/.test(value)) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : null;
  };

  const seenSerials = new Set<string>();

  const parseSection = (kind: "SUMMARY" | "DETAIL") => {
    const header = kind === "SUMMARY" ? summary : detail;
    const fields: readonly string[] = kind === "SUMMARY" ? SUMMARY_FIELDS : DETAIL_FIELDS;
    const other = kind === "SUMMARY" ? detail : summary;
    const end = other.row > header.row ? other.row - 1 : sheet.rowCount;
    for (let sourceRow = header.row + 1; sourceRow <= end; sourceRow++) {
      const getCell = (name: string) => header.columns.has(name) ? columnCell(sheet, sourceRow, header.columns, name) : null;
      const getText = (name: string) => {
        const cell = getCell(name);
        return cell ? cellText(cell) : "";
      };
      const formulaHeader = fields.find((name) => {
        const cell = getCell(name);
        return cell && isFormula(cell);
      });
      if (formulaHeader) {
        issues.push({ code: "FORMULA_CELL", message: "Formula cells cannot be imported", severity: "error", sourceRow, column: formulaHeader });
        continue;
      }
      if (fields.every((name) => !getText(name))) continue;
      const family = getText("Family");
      const modelCode = getText("ITEM CODE");
      if (!family || !modelCode) {
        issues.push({ code: "MISSING_VALUE", message: "Family and ITEM CODE are required", severity: "error", sourceRow });
        continue;
      }
      if (kind === "SUMMARY") {
        const totalQuantity = parseQuantity(getText("배정 가능 수량"));
        const allocatedQuantity = header.columns.has("배정 수량") ? parseQuantity(getText("배정 수량")) : 0;
        const remainingText = getText("잔여 수량");
        const remainingQuantity = remainingText ? parseQuantity(remainingText) : null;
        if (totalQuantity === null || allocatedQuantity === null || (remainingText && remainingQuantity === null)) {
          issues.push({ code: "INVALID_QUANTITY", message: "Inventory quantities must be nonnegative integers", severity: "error", sourceRow });
          continue;
        }
        const row: InventorySummaryRow = { section: "SUMMARY", sourceRow, family, modelCode, totalQuantity, allocatedQuantity, remainingQuantity };
        rows.push(row);
      } else {
        const serialNumber = normalizeSerialNumber(getText("SN"));
        if (!serialNumber) {
          issues.push({ code: "MISSING_SN", message: "Detail SN is required", severity: "error", sourceRow, column: "SN" });
          continue;
        }
        if (seenSerials.has(serialNumber)) {
          issues.push({ code: "DUPLICATE_SN", message: "Duplicate SN in Detail", severity: "error", sourceRow, column: "SN" });
          continue;
        }
        const periodText = getText("배정 월도");
        const allocationPeriod = periodText ? normalizePeriod(periodText) : null;
        if (periodText && !allocationPeriod) {
          issues.push({ code: "INVALID_PERIOD", message: "Expected a YY.MM allocation period", severity: "error", sourceRow, column: "배정 월도" });
          continue;
        }
        const flag = getText("배정 여부");
        if (flag && flag !== "0" && flag !== "1") {
          issues.push({ code: "INVALID_ALLOCATION_FLAG", message: "Allocation flag must be 0 or 1", severity: "error", sourceRow, column: "배정 여부" });
          continue;
        }
        const row: InventoryDetailRow = {
          section: "DETAIL", sourceRow, family, modelCode, serialNumber,
          storageLocation: getText("보관장소") || null,
          partnerName: getText("파트너사명") || null,
          allocationPeriod, allocated: flag === "1",
          allocationConfirmation: getText("배정 확인") || null,
        };
        seenSerials.add(serialNumber);
        rows.push(row);
      }
    }
  };

  parseSection("SUMMARY");
  parseSection("DETAIL");
  const summaries = rows.filter((row): row is InventorySummaryRow => row.section === "SUMMARY");
  const details = rows.filter((row): row is InventoryDetailRow => row.section === "DETAIL");
  const summaryByModel = new Map(summaries.map((row) => [row.modelCode, row]));
  for (const row of details) {
    const summaryRow = summaryByModel.get(row.modelCode);
    if (!summaryRow && row.allocated) {
      issues.push({ code: "MISSING_SUMMARY_MODEL", message: "Allocated Detail model has no Summary row", severity: "warning", sourceRow: row.sourceRow, column: "ITEM CODE" });
    }
    if (summaryRow && row.family !== summaryRow.family) {
      issues.push({ code: "FAMILY_MISMATCH", message: "Detail Family differs from Summary", severity: "warning", sourceRow: row.sourceRow, column: "Family" });
    }
  }
  for (const row of summaries) {
    const count = details.filter((detailRow) => detailRow.modelCode === row.modelCode && detailRow.allocated).length;
    if ((summary.columns.has("배정 수량") && count !== row.allocatedQuantity) || (row.remainingQuantity !== null && row.totalQuantity - row.allocatedQuantity !== row.remainingQuantity)) {
      issues.push({ code: "RECONCILIATION_MISMATCH", message: "Summary quantities do not match Detail or remaining balance", severity: "warning", sourceRow: row.sourceRow });
    }
  }
  return result;
}
