import { loadSafeWorkbook } from "@/lib/security/file-safety";
import { cellText, columnCell, findHeaders, isFormula, normalizePeriod } from "./normalize";
import type { ImportIssue, ParseResult, RequestImportRow } from "./types";

const HEADERS = [
  "#", "월도", "ITSS CODE", "Team", "파트너사명", "담당 DM", "Deal Type",
  "End-user", "현, 사용 Brand", "현, 사용기종", "요청 기종", "요청 수량", "Family",
] as const;

export async function parseRequestWorkbook(buffer: Buffer): Promise<ParseResult<RequestImportRow>> {
  const workbook = await loadSafeWorkbook(buffer);
  const rows: RequestImportRow[] = [];
  const issues: ImportIssue[] = [];
  const skippedSampleRows: number[] = [];
  const sheet = workbook.worksheets[0];
  const result = { rows, issues, sheetName: sheet.name, skippedSampleRows };
  const header = findHeaders(sheet, HEADERS);
  if (!header) {
    issues.push({ code: "MISSING_HEADERS", message: "Required request headers were not found in the first 10 rows", severity: "error" });
    return result;
  }
  const seen = new Set<string>();
  for (let sourceRow = header.row + 1; sourceRow <= sheet.rowCount; sourceRow++) {
    const getCell = (name: string) => columnCell(sheet, sourceRow, header.columns, name);
    const sourceNumber = cellText(getCell("#"));
    if (isFormula(getCell("#"))) {
      issues.push({ code: "FORMULA_CELL", message: "Formula cells cannot be imported", severity: "error", sourceRow, column: "#" });
      continue;
    }
    if (!sourceNumber) continue;
    if (sourceNumber.toLowerCase() === "sample") {
      skippedSampleRows.push(sourceRow);
      continue;
    }
    const formulaHeader = HEADERS.find((name) => isFormula(getCell(name)));
    if (formulaHeader) {
      issues.push({ code: "FORMULA_CELL", message: "Formula cells cannot be imported", severity: "error", sourceRow, column: formulaHeader });
      continue;
    }
    const period = normalizePeriod(cellText(getCell("월도")));
    if (!period) {
      issues.push({ code: "INVALID_PERIOD", message: "Expected a YY.MM request period", severity: "error", sourceRow, column: "월도" });
      continue;
    }
    const quantity = Number(cellText(getCell("요청 수량")));
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      issues.push({ code: "INVALID_QUANTITY", message: "Request quantity must be a positive integer", severity: "error", sourceRow, column: "요청 수량" });
      continue;
    }
    const required = ["ITSS CODE", "Team", "파트너사명", "담당 DM", "요청 기종", "Family"] as const;
    const missing = required.find((name) => !cellText(getCell(name)));
    if (missing) {
      issues.push({ code: "MISSING_VALUE", message: "A required request field is blank", severity: "error", sourceRow, column: missing });
      continue;
    }
    const optional = (name: string) => cellText(getCell(name)) || null;
    const partnerCode = cellText(getCell("ITSS CODE"));
    const salesRep = cellText(getCell("담당 DM"));
    const requestedModel = cellText(getCell("요청 기종"));
    const candidateGroup = JSON.stringify([period, partnerCode, salesRep, requestedModel]);
    if (seen.has(candidateGroup)) {
      issues.push({ code: "DUPLICATE_CANDIDATE", message: "Possible duplicate request; review before import", severity: "warning", sourceRow });
    }
    seen.add(candidateGroup);
    rows.push({
      sourceRow,
      sourceNumber,
      period,
      partnerCode,
      teamRaw: cellText(getCell("Team")),
      partnerName: cellText(getCell("파트너사명")),
      salesRep,
      dealType: optional("Deal Type"),
      endUser: optional("End-user"),
      currentBrand: optional("현, 사용 Brand"),
      currentModel: optional("현, 사용기종"),
      requestedModel,
      quantity,
      requestedFamily: cellText(getCell("Family")),
      candidateKey: JSON.stringify([period, partnerCode, salesRep, requestedModel, sourceRow]),
    });
  }
  return result;
}
