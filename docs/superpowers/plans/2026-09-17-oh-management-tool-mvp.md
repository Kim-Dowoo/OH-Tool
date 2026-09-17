# OH Management Tool MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 업무 데이터는 Windows PC 안에만 보관하면서 Excel 요청 가져오기, 기종별 재고, SN 배정, 출고, 매출, 통계, Outlook 메일 초안을 관리하는 로컬 웹앱과 가상 데이터 전용 Vercel 데모를 만든다.

**Architecture:** 저장소 루트에는 문서와 운영 스크립트를 두고 `app/`에 Next.js App Router 애플리케이션을 둔다. 로컬 모드는 SQLite와 실제 Excel을 사용하고, Vercel 데모 모드는 읽기 전용 가상 저장소만 사용한다. 도메인 서비스는 `Repository` 인터페이스에만 의존하여 두 모드의 데이터 경계를 강제한다.

**Tech Stack:** Node.js 24, Next.js App Router, TypeScript, React, SQLite, `better-sqlite3`, ExcelJS, Zod, Vitest, Testing Library, Playwright, GitHub private repository, Vercel demo deployment

**Spec:** `docs/superpowers/specs/2026-09-17-oh-management-tool-design.md`

## Global Constraints

- 실제 업무 데이터는 사용자 PC 밖으로 전송하지 않는다.
- 실제 데이터 저장소는 로컬 SQLite 파일이다.
- GitHub에는 소스 코드, 문서, 가상 샘플만 저장한다.
- Vercel은 기능 시연용이며 가상 데이터만 사용한다.
- Vercel 데모에서는 Excel 업로드·다운로드와 실제 데이터 입력을 비활성화한다.
- Power Automate, Power BI, Microsoft Graph API는 사용하지 않는다.
- SharePoint 파일은 사용자가 직접 내려받고 로컬 앱에서 가져온다.
- Outlook 메일은 자동 전송하지 않는다.
- 현재 `input-samples/*.xlsx`는 실제 식별정보 가능성이 있으므로 절대 Git에 추가하지 않는다.
- 요청 원본 구조와 매핑은 `docs/EXCEL_SOURCE_ANALYSIS.md`를 기준으로 한다.

---

## Planned File Structure

```text
OH 관리 Tool/
├─ .gitignore                         # 실제 데이터와 로컬 비밀정보 차단
├─ README.md                          # 설치, 실행, 백업, 데모 설명
├─ app/
│  ├─ package.json
│  ├─ next.config.ts
│  ├─ vitest.config.ts
│  ├─ playwright.config.ts
│  ├─ src/
│  │  ├─ app/
│  │  │  ├─ layout.tsx
│  │  │  ├─ page.tsx                 # 대시보드
│  │  │  ├─ imports/page.tsx
│  │  │  ├─ requests/page.tsx
│  │  │  ├─ inventory/page.tsx
│  │  │  ├─ shipments/page.tsx
│  │  │  └─ api/                     # 업로드·배정·출고 Route Handlers
│  │  ├─ features/
│  │  │  ├─ imports/                 # Excel 파싱·검증·확정
│  │  │  ├─ organizations/           # 파트너·조직 매핑
│  │  │  ├─ inventory/               # 수량·잔여 계산
│  │  │  ├─ requests/                # 요청 상태와 배정
│  │  │  ├─ shipments/               # 출고·매출·메일 초안
│  │  │  └─ dashboard/               # 집계 쿼리와 화면
│  │  ├─ lib/
│  │  │  ├─ config/runtime-mode.ts
│  │  │  ├─ db/client.ts
│  │  │  ├─ db/migrations.ts
│  │  │  ├─ repositories/contracts.ts
│  │  │  ├─ repositories/local-repository.ts
│  │  │  ├─ repositories/demo-repository.ts
│  │  │  └─ security/file-safety.ts
│  │  └─ demo/seed.ts
│  ├─ migrations/001_initial.sql
│  ├─ tests/                         # 단위·통합 테스트
│  │  └─ helpers/fixtures.ts         # 완전한 가상 테스트 데이터 생성기
│  └─ e2e/                           # 브라우저 흐름 테스트
├─ scripts/
│  ├─ run-local.ps1
│  ├─ backup-local.ps1
│  └─ verify-no-sensitive-files.ps1
├─ data/                              # Git 제외, SQLite 위치
├─ backups/                           # Git 제외, EFS 암호화 백업
├─ exports/                           # Git 제외, Excel 내보내기
└─ input-samples/                     # xlsx Git 제외
```

## Shared Test Fixture Contracts

`app/tests/helpers/fixtures.ts` owns every synthetic record used in the plan. It never reads `input-samples/*.xlsx`.

```ts
export function createTestDatabase(): Database.Database;
export function seedRequestAndInventory(db: Database.Database): void;
export function createAllocation(db: Database.Database, input: AllocateInput): AllocationRecord;
export function buildRequestWorkbook(rows: unknown[][]): Promise<Buffer>;
export function validRequestFile(): Promise<File>;
export function validRequestPreview(): ImportPreview;
export function validRequestPreviewWithTwoRows(): ImportPreview;
export function createImportTestContext(): {
  service: ImportService;
  repository: OhRepository;
};
export function createAllocationTestContext(): {
  service: AllocationService;
  repository: TestOhRepository;
};
export function createOrganizationTestContext(): {
  service: OrganizationService;
  repository: TestOhRepository;
};
export function createShipmentTestContext(): {
  service: ShipmentService;
  repository: TestOhRepository;
};
export function createDashboardTestContext(): {
  service: DashboardService;
  repository: TestOhRepository;
};
export function unallocatedRequest(): RequestRecord;
export function demoAllocateInput(): AllocateInput;
export function demoShipInput(): ShipInput;
export function demoImport(): ImportCommit;
export function uploadSyntheticRequestWorkbook(page: Page): Promise<void>;
export function shipmentExportRow(overrides?: Partial<ShipmentExportRow>): ShipmentExportRow;
export function readExportedCell(
  workbook: Buffer,
  sheetName: string,
  header: string,
  rowNumber: number,
): Promise<string | number | null>;
export function createBackupTestContext(): Promise<{
  source: { path: string };
  backupDirectory: string;
}>;
```

`TestOhRepository` extends `OhRepository` only inside tests with deterministic seed methods:

```ts
export interface TestOhRepository extends OhRepository {
  seedInventory(input: { modelCode: string; family?: string; totalQuantity: number }): Promise<void>;
  seedAllocatedRequest(input: { requestId?: string; quantity: number }): Promise<void>;
  seedDashboardScenario(): Promise<void>;
  getRequest(id: string): Promise<RequestRecord>;
}
```

---

### Task 1: 저장소 안전장치와 Next.js 기반 구성

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `scripts/verify-no-sensitive-files.ps1`
- Create: `app/package.json` and standard Next.js scaffold files
- Create: `app/src/lib/config/runtime-mode.ts`
- Test: `app/tests/config/runtime-mode.test.ts`

**Interfaces:**
- Produces: `getRuntimeMode(): "local" | "demo"`
- Produces: `assertSafeRuntime(): void`
- Produces: root-level Git exclusions consumed by every later task

- [ ] **Step 1: 실제 데이터 차단 검증을 먼저 작성한다**

```powershell
$blocked = @(
  'input-samples/*.xlsx',
  'data/**',
  'backups/**',
  'exports/**',
  '.env',
  '.env.*'
)
$tracked = git ls-files
foreach ($pattern in $blocked) {
  if ($tracked | Where-Object { $_ -like $pattern }) {
    throw "민감 파일이 Git에 포함됨: $pattern"
  }
}
```

- [ ] **Step 2: 테스트가 아직 실행되지 않음을 확인한다**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-no-sensitive-files.ps1`

Expected: FAIL because the script and `.gitignore` have not been created.

- [ ] **Step 3: Git 제외 규칙과 앱 기반을 만든다**

`.gitignore` must contain:

```gitignore
input-samples/*.xlsx
data/**
!data/.gitkeep
backups/**
!backups/.gitkeep
exports/**
!exports/.gitkeep
.env
.env.*
!.env.example
app/.next/
app/node_modules/
app/coverage/
app/test-results/
app/playwright-report/
_work/
```

Scaffold and install:

```powershell
git init -b main
npx create-next-app@latest app --ts --eslint --app --src-dir --use-npm --no-tailwind --import-alias "@/*" --yes
Set-Location app
npm install better-sqlite3 exceljs zod server-only
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @types/better-sqlite3 tsx cross-env @playwright/test
```

Set these scripts in `app/package.json`:

```json
{
  "scripts": {
    "dev": "next dev -H 127.0.0.1",
    "build": "next build",
    "start": "next start -H 127.0.0.1",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "backup": "tsx scripts/backup.ts"
  }
}
```

`.env.example` contains only non-secret examples:

```dotenv
APP_MODE=local
LOCAL_DB_PATH=../data/oh-management.db
```

`runtime-mode.ts`:

```ts
export type RuntimeMode = "local" | "demo";

export function getRuntimeMode(env = process.env): RuntimeMode {
  return env.APP_MODE === "demo" ? "demo" : "local";
}

export function assertSafeRuntime(env = process.env): void {
  if (env.VERCEL === "1" && getRuntimeMode(env) !== "demo") {
    throw new Error("Vercel에서는 APP_MODE=demo만 허용됩니다.");
  }
}
```

- [ ] **Step 4: 모드 테스트와 민감 파일 검사를 통과시킨다**

```ts
import { describe, expect, it } from "vitest";
import { assertSafeRuntime, getRuntimeMode } from "@/lib/config/runtime-mode";

describe("runtime mode", () => {
  it("defaults to local outside Vercel", () => {
    expect(getRuntimeMode({})).toBe("local");
  });

  it("rejects local mode on Vercel", () => {
    expect(() => assertSafeRuntime({ VERCEL: "1", APP_MODE: "local" })).toThrow();
  });

  it("allows demo mode on Vercel", () => {
    expect(() => assertSafeRuntime({ VERCEL: "1", APP_MODE: "demo" })).not.toThrow();
  });
});
```

Run: `npm run lint; npm run test -- tests/config/runtime-mode.test.ts; powershell -ExecutionPolicy Bypass -File ..\scripts\verify-no-sensitive-files.ps1`

Expected: all commands PASS and `git status --short` does not list any `.xlsx` file.

- [ ] **Step 5: 기반 구성을 커밋한다**

```powershell
git add .gitignore .env.example README.md START_HERE.md docs scripts app
git commit -m "chore: initialize safe local OH management app"
```

---

### Task 2: SQLite 스키마와 로컬 Repository

**Files:**
- Create: `app/migrations/001_initial.sql`
- Create: `app/src/lib/db/client.ts`
- Create: `app/src/lib/db/migrations.ts`
- Create: `app/src/lib/repositories/contracts.ts`
- Create: `app/src/lib/repositories/local-repository.ts`
- Test: `app/tests/db/migrations.test.ts`
- Test: `app/tests/repositories/local-repository.test.ts`

**Interfaces:**
- Produces: `openDatabase(path?: string): Database.Database`
- Produces: `runMigrations(db): void`
- Produces: `OhRepository` with requests, inventory, allocations, shipments, imports, organizations and dashboard methods
- Consumes: `getRuntimeMode()` from Task 1

- [ ] **Step 1: 스키마 제약 테스트를 작성한다**

```ts
it("rejects a duplicate serial number", () => {
  const db = createTestDatabase();
  runMigrations(db);
  seedRequestAndInventory(db);
  createAllocation(db, { requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-001" });
  expect(() =>
    createAllocation(db, { requestId: "REQ-2", modelCode: "MODEL-A", serialNumber: "SN-001" }),
  ).toThrow();
});
```

- [ ] **Step 2: 제약 테스트의 실패를 확인한다**

Run: `npm test -- tests/db/migrations.test.ts`

Expected: FAIL because database modules and tables do not exist.

- [ ] **Step 3: 초기 스키마와 Repository 계약을 구현한다**

The migration creates these tables with foreign keys enabled:

```sql
CREATE TABLE import_batches (
  id TEXT PRIMARY KEY,
  import_type TEXT NOT NULL CHECK (import_type IN ('REQUESTS','INVENTORY','ORGANIZATION')),
  sha256 TEXT NOT NULL UNIQUE,
  source_label TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  imported_rows INTEGER NOT NULL,
  rejected_rows INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE model_inventory (
  model_code TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0),
  storage_location TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
  source_row INTEGER NOT NULL,
  source_number TEXT,
  period TEXT NOT NULL,
  partner_code TEXT NOT NULL,
  team_raw TEXT NOT NULL,
  department_name TEXT,
  team_name TEXT,
  partner_name TEXT NOT NULL,
  sales_rep TEXT NOT NULL,
  deal_type TEXT,
  end_user TEXT,
  current_brand TEXT,
  current_model TEXT,
  requested_model TEXT NOT NULL,
  requested_family TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('RECEIVED','REVIEWED','PARTIALLY_ALLOCATED','ALLOCATED','SHIPPED','CANCELLED')),
  created_at TEXT NOT NULL,
  UNIQUE(import_batch_id, source_row)
);

CREATE TABLE allocations (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  model_code TEXT NOT NULL REFERENCES model_inventory(model_code),
  serial_number TEXT NOT NULL UNIQUE,
  storage_location TEXT,
  status TEXT NOT NULL CHECK (status IN ('ALLOCATED','SHIPPED','CANCELLED')),
  allocated_at TEXT NOT NULL,
  cancelled_at TEXT
);

CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  allocation_id TEXT NOT NULL UNIQUE REFERENCES allocations(id),
  shipped_at TEXT NOT NULL,
  revenue INTEGER NOT NULL CHECK (revenue >= 0),
  note TEXT,
  created_at TEXT NOT NULL
);
```

Also create `organization_mappings`, `partners` and append-only `audit_events` tables defined by the design spec.

The central contract must include exact result types:

```ts
export interface InventoryBalance {
  modelCode: string;
  family: string;
  totalQuantity: number;
  allocatedQuantity: number;
  remainingQuantity: number;
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
```

- [ ] **Step 4: 마이그레이션과 Repository 테스트를 통과시킨다**

Run: `npm test -- tests/db tests/repositories/local-repository.test.ts`

Expected: schema creation, foreign keys, unique SN, nonnegative quantity and transaction rollback tests PASS.

- [ ] **Step 5: 데이터 기반을 커밋한다**

```powershell
git add app/migrations app/src/lib/db app/src/lib/repositories app/tests/db app/tests/repositories
git commit -m "feat: add local SQLite repository"
```

---

### Task 3: Excel 구조 탐지와 파서

**Files:**
- Create: `app/src/features/imports/types.ts`
- Create: `app/src/features/imports/normalize.ts`
- Create: `app/src/features/imports/request-parser.ts`
- Create: `app/src/features/imports/inventory-parser.ts`
- Create: `app/src/features/imports/organization-parser.ts`
- Create: `app/src/lib/security/file-safety.ts`
- Test: `app/tests/imports/*.test.ts`
- Test: `app/tests/helpers/build-workbook.ts`

**Interfaces:**
- Produces: `parseRequestWorkbook(buffer): Promise<ParseResult<RequestImportRow>>`
- Produces: `parseInventoryWorkbook(buffer): Promise<ParseResult<InventoryImportRow>>`
- Produces: `parseOrganizationWorkbook(buffer): Promise<ParseResult<OrganizationImportRow>>`
- Produces: `inspectXlsxUpload(file): Promise<SafeUpload>`

- [ ] **Step 1: 실제 열 구조를 가상 데이터로 재현한 실패 테스트를 작성한다**

```ts
it("normalizes the request period and skips the Sample row", async () => {
  const buffer = await buildRequestWorkbook([
    ["Sample", 26.09, "DEMO001", "가상영업부 가상팀", "파트너A", "영업01", "RCM", "고객A", "BrandA", "Old-A", "MODEL-A", 1, "FAMILY-A"],
    [1, 26.9, "DEMO001", "가상영업부 가상팀", "파트너A", "영업01", "RCM", "고객A", "BrandA", "Old-A", "MODEL-A", 1, "FAMILY-A"],
  ]);
  const result = await parseRequestWorkbook(buffer);
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0].period).toBe("26.09");
  expect(result.rows[0].sourceRow).toBe(4);
});
```

Add tests for missing headers, formulas in critical cells, blank numbered rows, duplicate request candidates, numeric SN with leading-zero-safe string output, and Summary/Detail reconciliation warnings.

- [ ] **Step 2: 파서 테스트가 실패하는지 확인한다**

Run: `npm test -- tests/imports`

Expected: FAIL because parsers do not exist.

- [ ] **Step 3: 헤더 탐지와 정규화를 구현한다**

```ts
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
```

The request parser scans the first 10 rows for all required headers. The inventory parser independently locates `배정 가능 수량` for Summary and `SN` for Detail. Both parsers return row-level issues rather than silently dropping invalid rows.

- [ ] **Step 4: 파일 안전성 및 파서 테스트를 통과시킨다**

Run: `npm test -- tests/imports`

Expected: all parser, normalization, file-size, extension and formula-cell tests PASS.

- [ ] **Step 5: Excel 파서를 커밋한다**

```powershell
git add app/src/features/imports app/src/lib/security app/tests/imports app/tests/helpers
git commit -m "feat: parse and validate OH source workbooks"
```

---

### Task 4: 가져오기 미리보기와 트랜잭션 확정

**Files:**
- Create: `app/src/features/imports/import-service.ts`
- Create: `app/src/app/api/imports/preview/route.ts`
- Create: `app/src/app/api/imports/commit/route.ts`
- Create: `app/src/app/imports/page.tsx`
- Create: `app/src/features/imports/import-preview.tsx`
- Test: `app/tests/imports/import-service.test.ts`
- Test: `app/tests/api/imports.test.ts`

**Interfaces:**
- Produces: `previewImport(type, file): Promise<ImportPreview>`
- Produces: `commitImport(token, acceptedRows): Promise<ImportCommitResult>`
- Consumes: Excel parsers from Task 3 and `OhRepository.saveImportBatch()` from Task 2

- [ ] **Step 1: 원자적 저장과 동일 파일 중복 테스트를 작성한다**

```ts
it("rolls back every row when one accepted row cannot be saved", async () => {
  const { service, repository } = createImportTestContext();
  const preview = validRequestPreviewWithTwoRows();
  preview.rows[1].requestedModel = "";
  await expect(service.commit(preview)).rejects.toThrow();
  expect(await repository.listRequests({})).toHaveLength(0);
});

it("warns when the same SHA-256 file was imported", async () => {
  const { service } = createImportTestContext();
  await service.commit(validRequestPreview());
  const repeated = await service.preview(await validRequestFile());
  expect(repeated.issues).toContainEqual(expect.objectContaining({ code: "DUPLICATE_FILE" }));
});
```

- [ ] **Step 2: 서비스 테스트의 실패를 확인한다**

Run: `npm test -- tests/imports/import-service.test.ts tests/api/imports.test.ts`

Expected: FAIL because preview tokens and commit transaction do not exist.

- [ ] **Step 3: 2단계 가져오기 흐름을 구현한다**

Preview tokens are random UUIDs stored only in the local process for 30 minutes and contain the SHA-256 hash, import type and parsed rows. Commit requires the token and exact accepted row numbers. The server recalculates business validation before one SQLite transaction.

```ts
export interface ImportPreview {
  token: string;
  importType: "REQUESTS" | "INVENTORY" | "ORGANIZATION";
  sha256: string;
  rows: PreviewRow[];
  issues: ImportIssue[];
  expiresAt: string;
}
```

The UI shows valid, warning and rejected counts; row number; issue reason; and a final confirmation button. It never echoes full sensitive cell contents into server logs.

- [ ] **Step 4: API와 화면 테스트를 통과시킨다**

Run: `npm test -- tests/imports/import-service.test.ts tests/api/imports.test.ts`

Expected: preview, expiry, duplicate file, selective acceptance and rollback tests PASS.

- [ ] **Step 5: 가져오기 흐름을 커밋한다**

```powershell
git add app/src/app/imports app/src/app/api/imports app/src/features/imports app/tests
git commit -m "feat: add reviewed transactional Excel imports"
```

---

### Task 5: 조직·파트너 매핑 관리

**Files:**
- Create: `app/src/features/organizations/service.ts`
- Create: `app/src/features/organizations/mapping-form.tsx`
- Create: `app/src/app/settings/organizations/page.tsx`
- Create: `app/src/app/api/organizations/route.ts`
- Test: `app/tests/organizations/service.test.ts`

**Interfaces:**
- Produces: `mapRawTeam(input: TeamMappingInput): Promise<TeamMapping>`
- Produces: `resolveRequestOrganization(request): OrganizationResolution`
- Consumes: organization and partner rows imported by Task 4

- [ ] **Step 1: 원본 Team을 임의 분할하지 않는 테스트를 작성한다**

```ts
it("keeps an unknown Team value unresolved until the user maps it", async () => {
  const { service } = createOrganizationTestContext();
  const result = await service.resolve("가상영업부 강북 가상영업팀");
  expect(result).toEqual({ status: "UNMAPPED", teamRaw: "가상영업부 강북 가상영업팀" });
});
```

- [ ] **Step 2: 매핑 테스트의 실패를 확인한다**

Run: `npm test -- tests/organizations/service.test.ts`

Expected: FAIL because mapping service does not exist.

- [ ] **Step 3: 부·팀 매핑과 파트너 대조를 구현한다**

The settings page lists each distinct `team_raw`, accepts `departmentName`, `teamName` and an optional sales-representative email, and shows mismatches where the same ITSS code has a different partner name or sales representative. Saving a mapping updates unresolved requests in one transaction and appends one audit event. The email input is normalized to lowercase and validated with Zod; an empty email remains valid.

- [ ] **Step 4: 매핑 및 감사 테스트를 통과시킨다**

Run: `npm test -- tests/organizations/service.test.ts`

Expected: unresolved, resolved, remapped and partner mismatch tests PASS.

- [ ] **Step 5: 조직 매핑을 커밋한다**

```powershell
git add app/src/features/organizations app/src/app/settings app/src/app/api/organizations app/tests/organizations
git commit -m "feat: map source teams to departments and teams"
```

---

### Task 6: 재고 수량과 SN 배정 규칙

**Files:**
- Create: `app/src/features/inventory/service.ts`
- Create: `app/src/features/requests/allocation-service.ts`
- Create: `app/src/app/api/allocations/route.ts`
- Create: `app/src/app/inventory/page.tsx`
- Create: `app/src/app/requests/page.tsx`
- Test: `app/tests/inventory/service.test.ts`
- Test: `app/tests/requests/allocation-service.test.ts`

**Interfaces:**
- Produces: `getInventoryBalance(modelCode): Promise<InventoryBalance>`
- Produces: `allocateRequest(input: AllocateInput): Promise<AllocationRecord>`
- Produces: `cancelAllocation(id, reason): Promise<void>`
- Consumes: imported inventory totals and requests

- [ ] **Step 1: 재고 초과와 중복 SN 실패 테스트를 작성한다**

```ts
it("does not allocate beyond remaining quantity", async () => {
  const { service, repository } = createAllocationTestContext();
  await repository.seedInventory({ modelCode: "MODEL-A", totalQuantity: 1 });
  await service.allocate({ requestId: "REQ-1", modelCode: "MODEL-A", serialNumber: "SN-001" });
  await expect(
    service.allocate({ requestId: "REQ-2", modelCode: "MODEL-A", serialNumber: "SN-002" }),
  ).rejects.toThrow("배정 가능한 수량이 없습니다.");
});
```

Add tests for model mismatch, duplicate SN, blank SN, partial allocation, complete allocation and cancellation after shipment.

- [ ] **Step 2: 배정 테스트의 실패를 확인한다**

Run: `npm test -- tests/inventory tests/requests/allocation-service.test.ts`

Expected: FAIL because allocation service does not exist.

- [ ] **Step 3: 트랜잭션 기반 배정과 상태 계산을 구현한다**

```ts
function statusForAllocationCount(quantity: number, active: number): RequestStatus {
  if (active === 0) return "REVIEWED";
  if (active < quantity) return "PARTIALLY_ALLOCATED";
  return "ALLOCATED";
}
```

The allocation transaction reads the current balance, validates requested model and quantity, inserts the unique SN, recalculates request status and writes an audit event. Cancellation is rejected when the allocation status is `SHIPPED`.

- [ ] **Step 4: 재고 및 배정 테스트를 통과시킨다**

Run: `npm test -- tests/inventory tests/requests/allocation-service.test.ts`

Expected: balance, concurrency transaction, state and constraint tests PASS.

- [ ] **Step 5: 재고와 배정을 커밋한다**

```powershell
git add app/src/features/inventory app/src/features/requests app/src/app/inventory app/src/app/requests app/src/app/api/allocations app/tests
git commit -m "feat: allocate serial numbers against model inventory"
```

---

### Task 7: 출고·매출·Outlook 메일 초안

**Files:**
- Create: `app/src/features/shipments/service.ts`
- Create: `app/src/features/shipments/mail-draft.ts`
- Create: `app/src/app/shipments/page.tsx`
- Create: `app/src/app/api/shipments/route.ts`
- Test: `app/tests/shipments/service.test.ts`
- Test: `app/tests/shipments/mail-draft.test.ts`

**Interfaces:**
- Produces: `shipAllocation(input: ShipInput): Promise<ShipmentRecord>`
- Produces: `buildMailDraft(request, allocations): MailDraft`
- Consumes: allocated requests from Task 6

- [ ] **Step 1: 출고 상태와 메일 본문 테스트를 작성한다**

```ts
it("marks the request shipped only after every allocation ships", async () => {
  const { service, repository } = createShipmentTestContext();
  await repository.seedAllocatedRequest({ requestId: "REQ-1", quantity: 2 });
  await service.ship({ allocationId: "A-1", shippedAt: "2026-09-17", revenue: 1000000 });
  expect((await repository.getRequest("REQ-1")).status).toBe("ALLOCATED");
  await service.ship({ allocationId: "A-2", shippedAt: "2026-09-17", revenue: 1200000 });
  expect((await repository.getRequest("REQ-1")).status).toBe("SHIPPED");
});
```

- [ ] **Step 2: 출고 테스트의 실패를 확인한다**

Run: `npm test -- tests/shipments`

Expected: FAIL because shipment and mail draft modules do not exist.

- [ ] **Step 3: 출고 트랜잭션과 메일 초안을 구현한다**

```ts
export interface MailDraft {
  to: string;
  subject: string;
  body: string;
  mailtoUrl: string;
}
```

The mail body lists partner, requested model, each assigned SN and shipment date. `mailtoUrl` uses `encodeURIComponent`; the service does not send email. When no mapped email exists, `to` and `mailtoUrl` are empty while subject and body remain copyable. Revenue is a nonnegative integer in KRW and is stored per shipped allocation.

- [ ] **Step 4: 출고·매출·메일 테스트를 통과시킨다**

Run: `npm test -- tests/shipments`

Expected: duplicate shipment, negative revenue, full shipment state and encoded mail draft tests PASS.

- [ ] **Step 5: 출고 기능을 커밋한다**

```powershell
git add app/src/features/shipments app/src/app/shipments app/src/app/api/shipments app/tests/shipments
git commit -m "feat: record shipments revenue and Outlook drafts"
```

---

### Task 8: 운영 화면과 탐색 구조

**Files:**
- Modify: `app/src/app/layout.tsx`
- Modify: `app/src/app/globals.css`
- Create: `app/src/components/navigation.tsx`
- Create: `app/src/components/status-badge.tsx`
- Create: `app/src/components/filter-bar.tsx`
- Modify: operational pages created by Tasks 4–7
- Test: `app/tests/ui/navigation.test.tsx`
- Test: `app/tests/ui/requests-page.test.tsx`

**Interfaces:**
- Produces: consistent navigation for Dashboard, 가져오기, 요청, 재고, 출고, 조직 설정
- Consumes: services and pages from Tasks 4–7

- [ ] **Step 1: 관리자 핵심 동선 테스트를 작성한다**

```tsx
it("shows unallocated requests and opens the allocation form", async () => {
  render(<RequestsPage initialRows={[unallocatedRequest()]} />);
  expect(screen.getByText("미배정")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "SN 배정" }));
  expect(screen.getByLabelText("SN")).toBeInTheDocument();
});
```

- [ ] **Step 2: UI 테스트의 실패를 확인한다**

Run: `npm test -- tests/ui`

Expected: FAIL because shared navigation and accessible form controls do not exist.

- [ ] **Step 3: 데스크톱 우선 운영 UI를 구현한다**

Use plain CSS with one responsive breakpoint. Tables keep visible headers, filters are URL search parameters, forms have explicit labels, confirmation is required for cancellation and import commit, and no destructive action relies on color alone.

- [ ] **Step 4: UI 단위 테스트와 접근성 선택자 테스트를 통과시킨다**

Run: `npm test -- tests/ui; npm run lint`

Expected: navigation, form labels, status text, filter persistence and confirmation tests PASS.

- [ ] **Step 5: 운영 UI를 커밋한다**

```powershell
git add app/src/app app/src/components app/tests/ui
git commit -m "feat: add local operations interface"
```

---

### Task 9: 팀·파트너·영업사원별 대시보드

**Files:**
- Create: `app/src/features/dashboard/service.ts`
- Create: `app/src/features/dashboard/dashboard-view.tsx`
- Create: `app/src/features/exports/shipment-export.ts`
- Create: `app/src/app/api/exports/shipments/route.ts`
- Modify: `app/src/app/page.tsx`
- Test: `app/tests/dashboard/service.test.ts`
- Test: `app/tests/dashboard/dashboard-view.test.tsx`
- Test: `app/tests/exports/shipment-export.test.ts`

**Interfaces:**
- Produces: `getDashboard(filter): Promise<DashboardSummary>`
- Produces: `buildShipmentExport(rows): Promise<Buffer>`
- Consumes: requests, allocations, shipments and organization mappings

- [ ] **Step 1: 집계가 중복되지 않는 테스트를 작성한다**

```ts
it("sums shipped revenue once per shipment and groups by sales representative", async () => {
  const { service, repository } = createDashboardTestContext();
  await repository.seedDashboardScenario();
  const summary = await service.getDashboard({ periodFrom: "26.09", periodTo: "26.09" });
  expect(summary.totalRequested).toBe(3);
  expect(summary.totalAllocated).toBe(2);
  expect(summary.totalShipped).toBe(1);
  expect(summary.confirmedRevenue).toBe(1000000);
expect(summary.bySalesRep).toContainEqual(
    expect.objectContaining({ label: "영업01", shipped: 1, revenue: 1000000 }),
  );
});

it("escapes formula-like exported text", async () => {
  const workbook = await buildShipmentExport([
    shipmentExportRow({ partnerName: "=HYPERLINK(\"https://example.invalid\")" }),
  ]);
  expect(await readExportedCell(workbook, "출고 내역", "파트너사명", 2)).toBe(
    "'=HYPERLINK(\"https://example.invalid\")",
  );
});
```

- [ ] **Step 2: 대시보드 테스트의 실패를 확인한다**

Run: `npm test -- tests/dashboard tests/exports`

Expected: FAIL because dashboard queries do not exist.

- [ ] **Step 3: 필터와 집계를 구현한다**

Dashboard filters are period, partner, department, team, sales representative and model. Summary counts use request quantity for requested, active allocation count for allocated, shipment count for shipped and `SUM(shipments.revenue)` for revenue. Unmapped organizations appear under `미분류` rather than disappearing.

The export route writes the filtered shipment rows to `exports/` only in local mode and streams the generated `.xlsx` to the browser. Text beginning with `=`, `+`, `-` or `@` is prefixed with an apostrophe before ExcelJS writes it. The export includes request number, period, organization, sales representative, partner, model, SN, shipment date and confirmed revenue.

- [ ] **Step 4: 집계와 화면 테스트를 통과시킨다**

Run: `npm test -- tests/dashboard tests/exports`

Expected: grouping, date-period boundary, zero-data and unmapped organization tests PASS.

- [ ] **Step 5: 대시보드를 커밋한다**

```powershell
git add app/src/features/dashboard app/src/features/exports app/src/app/page.tsx app/src/app/api/exports app/tests/dashboard app/tests/exports
git commit -m "feat: add operational and revenue dashboard"
```

---

### Task 10: 로컬 실행과 암호화 백업

**Files:**
- Create: `scripts/run-local.ps1`
- Create: `scripts/backup-local.ps1`
- Create: `app/scripts/backup.ts`
- Create: `app/tests/backup/backup.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: one-command local start bound to `127.0.0.1`
- Produces: SQLite backup into the Windows EFS-encrypted `backups/` directory
- Consumes: SQLite path and migrations from Task 2

- [ ] **Step 1: 백업 생성·복원 테스트를 작성한다**

```ts
it("backs up a live database and restores readable request rows", async () => {
  const { source, backupDirectory } = await createBackupTestContext();
  const backupPath = await createBackup(source.path, backupDirectory);
  const restored = openDatabase(backupPath);
  expect(restored.prepare("select count(*) as count from requests").get()).toEqual({ count: 1 });
});
```

- [ ] **Step 2: 백업 테스트의 실패를 확인한다**

Run: `npm test -- tests/backup/backup.test.ts`

Expected: FAIL because backup function does not exist.

- [ ] **Step 3: 안전한 로컬 실행과 백업을 구현한다**

`run-local.ps1` sets `APP_MODE=local`, checks that the DB path is outside Git, runs migrations and starts Next.js with `-H 127.0.0.1`. `backup-local.ps1` enables Windows EFS using `cipher /E /A backups`, verifies encryption using `cipher /C backups`, runs SQLite online backup and deletes encrypted backups older than 30 days.

The script stops with a clear error if EFS cannot be enabled; it does not silently create an unencrypted backup.

- [ ] **Step 4: 백업과 바인딩 검증을 통과시킨다**

Run: `npm test -- tests/backup/backup.test.ts; powershell -ExecutionPolicy Bypass -File ..\scripts\backup-local.ps1 -VerifyOnly`

Expected: backup/restore PASS and the verify-only command reports an EFS-encrypted backup directory.

- [ ] **Step 5: 운영 스크립트를 커밋한다**

```powershell
git add scripts app/scripts app/tests/backup README.md
git commit -m "feat: add safe local runner and encrypted backups"
```

---

### Task 11: Vercel 가상 데이터 데모 경계

**Files:**
- Create: `app/src/demo/seed.ts`
- Create: `app/src/lib/repositories/demo-repository.ts`
- Create: `app/src/lib/repositories/get-repository.ts`
- Create: `app/src/components/demo-banner.tsx`
- Modify: `app/src/app/layout.tsx`
- Modify: mutation Route Handlers
- Test: `app/tests/demo/demo-boundary.test.ts`

**Interfaces:**
- Produces: `getRepository(): Promise<OhRepository>`
- Produces: read-only demo repository with synthetic Korean labels and no real identifiers
- Consumes: runtime mode from Task 1 and Repository contract from Task 2

- [ ] **Step 1: 데모 쓰기 차단 테스트를 작성한다**

```ts
it("rejects every mutation in demo mode", async () => {
  const repository = createDemoRepository();
  await expect(repository.allocate(demoAllocateInput())).rejects.toThrow("데모에서는 변경할 수 없습니다.");
  await expect(repository.ship(demoShipInput())).rejects.toThrow("데모에서는 변경할 수 없습니다.");
  await expect(repository.saveImportBatch(demoImport())).rejects.toThrow("데모에서는 변경할 수 없습니다.");
});
```

- [ ] **Step 2: 경계 테스트의 실패를 확인한다**

Run: `npm test -- tests/demo/demo-boundary.test.ts`

Expected: FAIL because demo repository and banner do not exist.

- [ ] **Step 3: 읽기 전용 데모와 경고 배너를 구현한다**

`getRepository()` dynamically imports `local-repository` only in local mode so Vercel pages cannot open SQLite. Every mutation route returns HTTP 403 in demo mode. The persistent banner says `DEMO — 실제 데이터를 입력하지 마세요`. Upload controls and export links are not rendered in demo mode.

- [ ] **Step 4: 데모 빌드와 경계 테스트를 통과시킨다**

Run: `$env:APP_MODE='demo'; npm test -- tests/demo/demo-boundary.test.ts; npm run build`

Expected: tests PASS, build succeeds without creating `data/*.db`, and no upload endpoint accepts a file.

- [ ] **Step 5: 데모 모드를 커밋한다**

```powershell
git add app/src/demo app/src/lib/repositories app/src/components app/src/app app/tests/demo
git commit -m "feat: enforce synthetic read-only Vercel demo"
```

---

### Task 12: 전체 흐름 검증과 GitHub·Vercel 연결 준비

**Files:**
- Create: `app/e2e/local-workflow.spec.ts`
- Create: `app/e2e/demo-safety.spec.ts`
- Create: `docs/LOCAL_USER_GUIDE.md`
- Create: `docs/GITHUB_VERCEL_SETUP.md`
- Modify: `README.md`
- Modify: `START_HERE.md`

**Interfaces:**
- Verifies: import → organization mapping → inventory → allocation → shipment → revenue → dashboard → mail draft
- Verifies: demo mode contains only synthetic data and blocks mutation

- [ ] **Step 1: 두 개의 브라우저 흐름 테스트를 작성한다**

```ts
test("local administrator completes one OH shipment", async ({ page }) => {
  await page.goto("/imports");
  await uploadSyntheticRequestWorkbook(page);
  await page.getByRole("button", { name: "가져오기 확정" }).click();
  await page.goto("/requests");
  await page.getByRole("button", { name: "SN 배정" }).click();
  await page.getByLabel("SN").fill("DEMO-SN-0001");
  await page.getByRole("button", { name: "배정 확정" }).click();
  await page.goto("/shipments");
  await page.getByLabel("확정 매출").fill("1000000");
  await page.getByRole("button", { name: "출고 확정" }).click();
  await expect(page.getByText("1,000,000원")).toBeVisible();
});
```

The second test runs with `APP_MODE=demo`, confirms the demo banner and verifies that `/api/imports/preview`, `/api/allocations` and `/api/shipments` return 403.

- [ ] **Step 2: 전체 흐름 테스트의 초기 실패를 확인한다**

Run: `npm run test:e2e`

Expected: FAIL until all routes, labels and fixtures from Tasks 1–11 are complete.

- [ ] **Step 3: 사용자 문서와 배포 절차를 완성한다**

`LOCAL_USER_GUIDE.md` documents first run, import order, mapping, allocation, shipment, mail draft, backup and restore. `GITHUB_VERCEL_SETUP.md` requires a private repository, GitHub 2FA, Vercel root directory `app`, `APP_MODE=demo` for Preview and Production, Vercel Authentication for All Deployments, and no database or storage integration.

- [ ] **Step 4: 최종 검증을 실행한다**

Run:

```powershell
Set-Location app
npm run lint
npm run test
$env:APP_MODE='local'; npm run build
$env:APP_MODE='demo'; npm run build
npm run test:e2e
Set-Location ..
powershell -ExecutionPolicy Bypass -File scripts/verify-no-sensitive-files.ps1
git status --short
```

Expected: lint, unit, integration, local build, demo build, both end-to-end flows and sensitive-file check PASS. `git status --short` contains no `.xlsx`, `.db`, backup, export or `.env` file.

- [ ] **Step 5: 검증된 MVP를 커밋한다**

```powershell
git add README.md START_HERE.md docs app/e2e
git commit -m "test: verify local OH workflow and demo boundary"
```

---

## Implementation Order and Checkpoints

1. Tasks 1–4: 실제 데이터 보호와 Excel 가져오기까지 완성한다.
2. 사용자가 익명 구조 기준의 가져오기 미리보기를 확인한다.
3. Tasks 5–7: 조직, 배정, 출고, 매출과 메일 초안을 완성한다.
4. 사용자가 실제 로컬 복사본으로 한 건을 시험한다.
5. Tasks 8–10: 운영 화면, 대시보드, 백업을 완성한다.
6. Task 11: 가상 데이터 전용 Vercel 데모를 완성한다.
7. Task 12: 전체 검증 후 GitHub와 Vercel을 연결한다.

GitHub 연결 전에는 반드시 `verify-no-sensitive-files.ps1`을 통과해야 한다. Vercel 프로젝트에는 DB, Blob, Outlook, SharePoint 연결을 추가하지 않는다.
