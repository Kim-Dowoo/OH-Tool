import { describe, expect, it } from "vitest";
import JSZip from "jszip";

import { inspectXlsxUpload, MAX_XLSX_BYTES } from "@/lib/security/file-safety";
import { buildRequestWorkbook } from "../helpers/build-workbook";

describe("xlsx upload inspection", () => {
  it("accepts a synthetic XLSX and returns its bytes and digest", async () => {
    const buffer = await buildRequestWorkbook([]);
    const result = await inspectXlsxUpload(new File([new Uint8Array(buffer)], "safe.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    expect(result.buffer.equals(buffer)).toBe(true);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each(["safe.xlsm", "safe.xls", "safe.csv", "safe.xlsx.txt"])("rejects %s", async (name) => {
    await expect(inspectXlsxUpload(new File(["invalid"], name))).rejects.toThrow();
  });

  it("rejects oversized files before reading bytes", async () => {
    const file = { name: "large.xlsx", size: MAX_XLSX_BYTES + 1, type: "", arrayBuffer: () => { throw new Error("read occurred"); } } as unknown as File;
    await expect(inspectXlsxUpload(file)).rejects.toThrow(/size|크기/i);
  });

  it("rejects a renamed non-ZIP file", async () => {
    await expect(inspectXlsxUpload(new File(["not a ZIP"], "fake.xlsx"))).rejects.toThrow();
  });

  it("rejects an XLSM package renamed to .xlsx", async () => {
    const buffer = await buildRequestWorkbook([]);
    const zip = await JSZip.loadAsync(buffer);
    zip.file("xl/vbaProject.bin", "synthetic macro payload");
    const altered = await zip.generateAsync({ type: "uint8array" });
    await expect(inspectXlsxUpload(new File([altered as unknown as BlobPart], "renamed.xlsx"))).rejects.toThrow();
  });

  it("rejects an unsafe original ZIP entry name even if JSZip normalizes it", async () => {
    const zip = await JSZip.loadAsync(await buildRequestWorkbook([]));
    zip.file("../unexpected.xml", "synthetic unsafe entry");
    const altered = await zip.generateAsync({ type: "uint8array" });
    let rejected = false;
    try {
      await inspectXlsxUpload(new File([altered as unknown as BlobPart], "unsafe.xlsx"));
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });

  it("rejects ZIP content that expands beyond the workbook budget", async () => {
    const zip = await JSZip.loadAsync(await buildRequestWorkbook([]));
    zip.file("xl/large-extra.bin", Buffer.alloc(51 * 1024 * 1024));
    const altered = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    let rejected = false;
    try {
      await inspectXlsxUpload(new File([altered as unknown as BlobPart], "expanded.xlsx"));
    } catch (error) {
      rejected = (error as Error).message.includes("expansion limit");
    }
    expect(rejected).toBe(true);
  }, 15_000);
});
