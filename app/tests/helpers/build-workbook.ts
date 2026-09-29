import ExcelJS from "exceljs";

export const requestHeaders = [
  "#", "월도", "ITSS CODE", "Team", "파트너사명", "담당 DM", "Deal Type",
  "End-user", "현, 사용 Brand", "현, 사용기종", "요청 기종", "요청 수량", "Family",
];

export async function buildWorkbook(
  rows: unknown[][],
  sheetName = "Sheet1",
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  for (const row of rows) sheet.addRow(row as ExcelJS.CellValue[]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function buildRequestWorkbook(rows: unknown[][]): Promise<Buffer> {
  return buildWorkbook([["OH request"], requestHeaders, ...rows]);
}
