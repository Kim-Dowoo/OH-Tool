export type ImportType = "REQUESTS" | "INVENTORY" | "ORGANIZATION";
export type RequestStatus = "RECEIVED" | "REVIEWED" | "PARTIALLY_ALLOCATED" | "ALLOCATED" | "SHIPPED" | "CANCELLED";
export type AllocationStatus = "ALLOCATED" | "SHIPPED" | "CANCELLED";

export interface RequestRecord {
  id: string;
  importBatchId: string;
  sourceRow: number;
  sourceNumber: string | null;
  period: string;
  partnerCode: string;
  teamRaw: string;
  departmentName: string | null;
  teamName: string | null;
  partnerName: string;
  salesRep: string;
  dealType: string | null;
  endUser: string | null;
  currentBrand: string | null;
  currentModel: string | null;
  requestedModel: string;
  requestedFamily: string;
  quantity: number;
  status: RequestStatus;
  createdAt: string;
}

export interface InventoryBalance {
  modelCode: string;
  family: string;
  totalQuantity: number;
  allocatedQuantity: number;
  remainingQuantity: number;
}

export interface AllocationRecord {
  id: string;
  requestId: string;
  modelCode: string;
  serialNumber: string;
  storageLocation: string | null;
  status: AllocationStatus;
  allocatedAt: string;
  cancelledAt: string | null;
}

export interface ShipmentRecord {
  id: string;
  allocationId: string;
  shippedAt: string;
  revenue: number;
  note: string | null;
  createdAt: string;
}

export interface AllocateInput {
  id?: string;
  requestId: string;
  modelCode: string;
  serialNumber: string;
  storageLocation?: string | null;
  allocatedAt?: string;
}

export interface ShipInput {
  id?: string;
  allocationId: string;
  shippedAt: string;
  revenue: number;
  note?: string | null;
  createdAt?: string;
}

export interface RequestImportRecord extends Omit<RequestRecord, "importBatchId" | "createdAt" | "status"> {
  status?: RequestStatus;
}

export interface InventoryImportRecord {
  modelCode: string;
  family: string;
  totalQuantity: number;
  storageLocation?: string | null;
}

export interface OrganizationImportRecord {
  teamRaw: string;
  departmentName: string;
  teamName: string;
  salesRepEmail?: string | null;
  partnerCode?: string;
  partnerName?: string;
  salesRep?: string;
}

export interface ImportCommit {
  id?: string;
  importType: ImportType;
  sha256: string;
  sourceLabel: string;
  totalRows: number;
  importedRows?: number;
  rejectedRows?: number;
  createdAt?: string;
  requests?: RequestImportRecord[];
  inventory?: InventoryImportRecord[];
  organizations?: OrganizationImportRecord[];
}

export interface ImportCommitResult {
  batchId: string;
  importedRows: number;
  rejectedRows: number;
}

export interface RequestFilter {
  periodFrom?: string;
  periodTo?: string;
  partnerCode?: string;
  departmentName?: string;
  teamName?: string;
  salesRep?: string;
  modelCode?: string;
  status?: RequestStatus;
}

export type DashboardFilter = Omit<RequestFilter, "status">;

export interface DashboardGroup {
  label: string;
  requested: number;
  allocated: number;
  shipped: number;
  revenue: number;
}

export interface DashboardSummary {
  totalRequested: number;
  totalAllocated: number;
  totalShipped: number;
  confirmedRevenue: number;
  byPartner: DashboardGroup[];
  byDepartment: DashboardGroup[];
  byTeam: DashboardGroup[];
  bySalesRep: DashboardGroup[];
}

export interface OhRepository {
  saveImportBatch(input: ImportCommit): Promise<ImportCommitResult>;
  listRequests(filter: RequestFilter): Promise<RequestRecord[]>;
  getInventoryBalances(): Promise<InventoryBalance[]>;
  allocate(input: AllocateInput): Promise<AllocationRecord>;
  cancelAllocation(allocationId: string, reason: string): Promise<void>;
  ship(input: ShipInput): Promise<ShipmentRecord>;
  getDashboard(filter: DashboardFilter): Promise<DashboardSummary>;
}
