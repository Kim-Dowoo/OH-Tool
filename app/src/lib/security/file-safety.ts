import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import JSZip from "jszip";

export const MAX_XLSX_BYTES = 10 * 1024 * 1024;
export const MAX_XLSX_SHEETS = 5;
export const MAX_XLSX_ROWS = 10_000;
export const MAX_XLSX_EXPANDED_BYTES = 50 * 1024 * 1024;

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface SafeUpload {
  buffer: Buffer;
  sha256: string;
  sourceLabel: string;
}

function assertZipBytes(buffer: Buffer): void {
  if (buffer.length < 4 || buffer.subarray(0, 4).toString("hex") !== "504b0304") {
    throw new Error("XLSX ZIP structure is invalid");
  }
}

async function assertXlsxPackage(buffer: Buffer): Promise<void> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error("XLSX ZIP structure is invalid");
  }
  const names = Object.keys(zip.files);
  if (names.length > 1_000) throw new Error("XLSX ZIP entry count is invalid");
  if (names.some((name) => /(^|\/)vbaProject\.bin$/i.test(name) || name.includes("\\") || name.split("/").includes(".."))) {
    throw new Error("Macro-enabled or unsafe ZIP entries are not allowed");
  }
  let expandedBytes = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    await new Promise<void>((resolve, reject) => {
      const stream = entry.nodeStream();
      stream.on("data", (chunk: Buffer) => {
        expandedBytes += chunk.length;
        if (expandedBytes > MAX_XLSX_EXPANDED_BYTES) {
          stream.pause();
          reject(new Error("XLSX ZIP expansion limit exceeded"));
        }
      });
      stream.on("error", reject);
      stream.on("end", resolve);
    });
  }
  const contentTypesFile = zip.file("[Content_Types].xml");
  if (!contentTypesFile || !zip.file("xl/workbook.xml")) {
    throw new Error("XLSX package parts are missing");
  }
  const contentTypes = await contentTypesFile.async("string");
  if (!contentTypes.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml") || /macroEnabled|vbaProject/i.test(contentTypes)) {
    throw new Error("Only non-macro XLSX packages are allowed");
  }
}

export async function loadSafeWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_XLSX_BYTES) {
    throw new Error("XLSX file size is invalid");
  }
  assertZipBytes(buffer);
  await assertXlsxPackage(buffer);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new Error("XLSX structure is invalid");
  }
  if (workbook.worksheets.length < 1 || workbook.worksheets.length > MAX_XLSX_SHEETS) {
    throw new Error("XLSX sheet count is invalid");
  }
  if (workbook.worksheets.some((sheet) => sheet.rowCount > MAX_XLSX_ROWS)) {
    throw new Error("XLSX row count is invalid");
  }
  return workbook;
}

export async function inspectXlsxUpload(file: File): Promise<SafeUpload> {
  if (!/^[^\\/]+\.xlsx$/i.test(file.name)) throw new Error("Only .xlsx files are allowed");
  if (file.type && file.type !== XLSX_MIME && file.type !== "application/octet-stream") {
    throw new Error("XLSX MIME type is invalid");
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_XLSX_BYTES) {
    throw new Error("XLSX file size is invalid");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length !== file.size) throw new Error("XLSX file size changed while reading");
  await loadSafeWorkbook(buffer);
  return {
    buffer,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    sourceLabel: file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120),
  };
}
