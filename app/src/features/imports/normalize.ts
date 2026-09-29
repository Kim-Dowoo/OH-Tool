import type ExcelJS from "exceljs";

export function normalizePeriod(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{2})[.\-/](\d{1,2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}.${String(month).padStart(2, "0")}`;
}

export function normalizeSerialNumber(value: unknown): string {
  return String(value ?? "").trim();
}

export function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    return "";
  }
  return String(value).trim();
}

export function isFormula(cell: ExcelJS.Cell): boolean {
  const value = cell.value;
  return !!value && typeof value === "object" && ("formula" in value || "sharedFormula" in value);
}

export function findHeaders(
  sheet: ExcelJS.Worksheet,
  required: readonly string[],
  maxRow = 10,
): { row: number; columns: Map<string, number> } | null {
  for (let rowNumber = 1; rowNumber <= Math.min(maxRow, sheet.rowCount); rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const columns = new Map<string, number>();
    let duplicateRequiredHeader = false;
    row.eachCell((cell, column) => {
      const text = cellText(cell);
      if (required.includes(text) && columns.has(text)) duplicateRequiredHeader = true;
      if (text && !columns.has(text)) columns.set(text, column);
    });
    if (required.every((header) => columns.has(header)) && !duplicateRequiredHeader) return { row: rowNumber, columns };
  }
  return null;
}

export function columnCell(sheet: ExcelJS.Worksheet, row: number, columns: Map<string, number>, header: string): ExcelJS.Cell {
  return sheet.getRow(row).getCell(columns.get(header) ?? 0);
}
