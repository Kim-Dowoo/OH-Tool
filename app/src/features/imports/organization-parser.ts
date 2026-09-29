import { loadSafeWorkbook } from "@/lib/security/file-safety";
import { cellText, columnCell, findHeaders, isFormula } from "./normalize";
import type { ImportIssue, OrganizationImportRow, ParseResult } from "./types";

const HEADERS = ["ITSS CODE", "Team", "파트너사명", "담당 DM"] as const;

export async function parseOrganizationWorkbook(buffer: Buffer): Promise<ParseResult<OrganizationImportRow>> {
  const workbook = await loadSafeWorkbook(buffer);
  const sheet = workbook.worksheets[0];
  const rows: OrganizationImportRow[] = [];
  const issues: ImportIssue[] = [];
  const result = { rows, issues, sheetName: sheet.name, skippedSampleRows: [] as number[] };
  const header = findHeaders(sheet, HEADERS);
  if (!header) {
    issues.push({ code: "MISSING_HEADERS", message: "Required organization headers were not found", severity: "error" });
    return result;
  }
  for (let sourceRow = header.row + 1; sourceRow <= sheet.rowCount; sourceRow++) {
    const getCell = (name: string) => columnCell(sheet, sourceRow, header.columns, name);
    if (HEADERS.every((name) => !cellText(getCell(name)))) continue;
    const formulaHeader = HEADERS.find((name) => isFormula(getCell(name)));
    if (formulaHeader) {
      issues.push({ code: "FORMULA_CELL", message: "Formula cells cannot be imported", severity: "error", sourceRow, column: formulaHeader });
      continue;
    }
    const missing = HEADERS.find((name) => !cellText(getCell(name)));
    if (missing) {
      issues.push({ code: "MISSING_VALUE", message: "A required organization field is blank", severity: "error", sourceRow, column: missing });
      continue;
    }
    rows.push({
      sourceRow,
      partnerCode: cellText(getCell("ITSS CODE")),
      teamRaw: cellText(getCell("Team")),
      partnerName: cellText(getCell("파트너사명")),
      salesRep: cellText(getCell("담당 DM")),
      departmentName: null,
      teamName: null,
    });
  }
  return result;
}
