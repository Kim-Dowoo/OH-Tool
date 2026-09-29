export type ImportIssueSeverity = "error" | "warning";

export interface ImportIssue {
  code: string;
  message: string;
  severity: ImportIssueSeverity;
  sourceRow?: number;
  column?: string;
}

export interface ParseResult<T> {
  rows: T[];
  issues: ImportIssue[];
  sheetName: string | null;
  skippedSampleRows: number[];
}

export interface RequestImportRow {
  sourceRow: number;
  sourceNumber: string;
  period: string;
  partnerCode: string;
  teamRaw: string;
  partnerName: string;
  salesRep: string;
  dealType: string | null;
  endUser: string | null;
  currentBrand: string | null;
  currentModel: string | null;
  requestedModel: string;
  quantity: number;
  requestedFamily: string;
  candidateKey: string;
}

export type InventoryImportRow = InventorySummaryRow | InventoryDetailRow;

export interface InventorySummaryRow {
  section: "SUMMARY";
  sourceRow: number;
  family: string;
  modelCode: string;
  totalQuantity: number;
  allocatedQuantity: number;
  remainingQuantity: number | null;
}

export interface InventoryDetailRow {
  section: "DETAIL";
  sourceRow: number;
  family: string;
  modelCode: string;
  serialNumber: string;
  storageLocation: string | null;
  partnerName: string | null;
  allocationPeriod: string | null;
  allocated: boolean;
  allocationConfirmation: string | null;
}

export interface OrganizationImportRow {
  sourceRow: number;
  partnerCode: string;
  teamRaw: string;
  partnerName: string;
  salesRep: string;
  departmentName: null;
  teamName: null;
}
