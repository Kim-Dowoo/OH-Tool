# Supabase Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a read-only OH management dashboard to Vercel using only synthetic Supabase data.

**Architecture:** The existing local SQLite flow remains separate. In `APP_MODE=demo`, a server-side Supabase read repository supplies normalized dashboard data; the Next.js UI has no mutation controls and every write/import endpoint rejects demo mode. Supabase contains only `demo_`-prefixed tables protected with RLS policies that permit anonymous reads but no writes.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Supabase Postgres, `@supabase/supabase-js`, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-29-supabase-demo-design.md`

## Global Constraints

- Never put actual OH requests, serial numbers, revenue, employee names, emails, ITSS codes, Excel files, SQLite files, or backups in Supabase, Vercel, GitHub, tests, screenshots, or logs.
- Only `demo_`-prefixed Supabase tables are in scope; seeded serial values use the `DEMO-` prefix.
- `APP_MODE=demo` is mandatory on Vercel. Missing Supabase public configuration must fail closed with a clear server error.
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may be exposed to the browser. Do not add or use a service-role key in application code.
- Enable RLS on every demo table; the anon role has `SELECT` only and no INSERT, UPDATE, DELETE, or EXECUTE policy.
- Demo mode must reject all local imports and write/mutation APIs with HTTP 403, and show `DEMO — 가상 데이터이며 실제 데이터를 입력하지 마세요` on every page.
- Preserve existing local SQLite behavior when `APP_MODE=local`.
- Keep Supabase/Vercel credentials in ignored `.env.local` and platform environment-variable settings only.

## Review Focus

- Missing URL or anon key in demo mode must fail without falling back to local SQLite; test in Task 1.
- anon client must not use a service-role key or execute any mutation; test in Task 2.
- Synthetic seed must be idempotent and contain no unprefixed serials or actual-like identifiers; test in Task 1.
- Direct requests to existing import commit/preview APIs in demo mode must return 403; test in Task 3.
- Dashboard totals must equal seeded request/allocation/shipment rows, including zero-shipment models; test in Task 2.

---

### Task 1: Demo database schema, RLS, and deterministic seed

**Files:**
- Create: `app/supabase/migrations/202609290001_demo_schema.sql`
- Create: `app/supabase/seed.demo.sql`
- Create: `app/src/lib/supabase/config.ts`
- Create: `app/tests/supabase/demo-schema.test.ts`
- Modify: `app/.env.example`
- Modify: `app/package.json`

**Interfaces:**
- Produces: `getDemoSupabaseConfig(env): { url: string; anonKey: string }`
- Produces: `demo_organizations`, `demo_requests`, `demo_inventory`, `demo_allocations`, `demo_shipments`
- Consumes: `APP_MODE` from `src/lib/config/runtime-mode.ts`

- [ ] **Step 1: Write failing config and SQL-structure tests**

```ts
it("requires public Supabase configuration in demo mode", () => {
  expect(() => getDemoSupabaseConfig({ APP_MODE: "demo" })).toThrow("Supabase");
});

it("uses only demo-prefixed tables with RLS and SELECT policy", () => {
  expect(schemaSql).toContain("ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY");
  expect(schemaSql).not.toMatch(/CREATE POLICY.*(INSERT|UPDATE|DELETE)/s);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/supabase/demo-schema.test.ts`

Expected: FAIL because config and schema artifacts do not exist.

- [ ] **Step 3: Implement schema, RLS policies, synthetic seed and config**

Create all foreign keys among the five `demo_` tables. Seed exactly 3 departments, 5 teams, 6 fictional partners, 4 models, 20 requests, and matching partial allocation/shipment rows. Use `ON CONFLICT` upserts or a demo-table-only truncate/reinsert sequence so rerunning seed never adds duplicates. Add public URL/anon key names to `.env.example`; install `@supabase/supabase-js`.

- [ ] **Step 4: Run focused tests and seed safety check**

Run: `npm test -- tests/supabase/demo-schema.test.ts`

Expected: PASS; SQL asserts RLS, no mutation policies, `DEMO-` serials, and deterministic seed rows.

- [ ] **Step 5: Commit**

```bash
git add app/supabase app/src/lib/supabase app/tests/supabase app/.env.example app/package.json app/package-lock.json
git commit -m "feat: add safe synthetic Supabase demo schema"
```

### Task 2: Read-only Supabase dashboard repository

**Files:**
- Create: `app/src/features/demo/types.ts`
- Create: `app/src/features/demo/demo-repository.ts`
- Create: `app/src/app/api/demo/dashboard/route.ts`
- Test: `app/tests/demo/demo-repository.test.ts`
- Test: `app/tests/api/demo-dashboard.test.ts`

**Interfaces:**
- Consumes: `getDemoSupabaseConfig(env)` and Supabase `demo_` tables
- Produces: `getDemoDashboard(): Promise<DemoDashboard>`
- Produces: `GET /api/demo/dashboard` returning `DemoDashboard`

- [ ] **Step 1: Write failing repository and route tests**

```ts
it("returns grouped request, allocation, shipment and revenue metrics", async () => {
  const dashboard = await repository.getDashboard();
  expect(dashboard.totals).toEqual({ requested: 20, allocated: expect.any(Number), shipped: expect.any(Number), revenue: expect.any(Number) });
});

it("does not expose mutation methods", () => {
  expect("createRequest" in repository).toBe(false);
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm test -- tests/demo/demo-repository.test.ts tests/api/demo-dashboard.test.ts`

Expected: FAIL because the demo repository and route do not exist.

- [ ] **Step 3: Implement normalized read models and server-only query repository**

Use `createClient(url, anonKey)` only on the server. Query the five demo tables through select statements, calculate totals and group by partner, department and team, and map only display-safe synthetic fields into `DemoDashboard`. Return 404 outside demo mode and never import the local SQLite client.

- [ ] **Step 4: Run focused tests with mocked Supabase responses**

Run: `npm test -- tests/demo/demo-repository.test.ts tests/api/demo-dashboard.test.ts`

Expected: PASS; tests assert table reads, aggregation including zero-shipment inventory, no local DB import, and safe error handling.

- [ ] **Step 5: Commit**

```bash
git add app/src/features/demo app/src/app/api/demo app/tests/demo app/tests/api/demo-dashboard.test.ts
git commit -m "feat: read synthetic dashboard data from Supabase"
```

### Task 3: Demo dashboard UI and mutation boundary

**Files:**
- Create: `app/src/features/demo/demo-dashboard.tsx`
- Create: `app/src/features/demo/demo-dashboard.module.css`
- Modify: `app/src/app/page.tsx`
- Modify: `app/src/app/page.module.css`
- Modify: `app/src/app/layout.tsx`
- Modify: `app/src/app/api/imports/preview/route.ts`
- Modify: `app/src/app/api/imports/commit/route.ts`
- Test: `app/tests/demo/demo-dashboard.test.tsx`
- Test: `app/tests/api/imports.test.ts`

**Interfaces:**
- Consumes: `DemoDashboard` from Task 2 and `getRuntimeMode()`
- Produces: demo warning banner and dashboard cards/tables
- Produces: 403 for import preview/commit in demo mode

- [ ] **Step 1: Write failing UI and demo-boundary tests**

```tsx
it("shows the fixed demo warning and synthetic dashboard metrics", () => {
  render(<DemoDashboard dashboard={fixture} />);
  expect(screen.getByText("DEMO — 가상 데이터이며 실제 데이터를 입력하지 마세요")).toBeVisible();
});

it("rejects Excel preview in demo mode", async () => {
  await expect(previewRoute(request, { APP_MODE: "demo" })).resolves.toMatchObject({ status: 403 });
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm test -- tests/demo/demo-dashboard.test.tsx tests/api/imports.test.ts`

Expected: FAIL because the dashboard and demo API guard do not exist.

- [ ] **Step 3: Implement responsive dashboard and central demo write guard**

Render totals, model inventory, and partner/department/team summary tables from `DemoDashboard`. Replace the starter page only in demo mode; preserve a minimal local-mode entry point. Apply one reusable `assertDemoReadOnly()` guard before import parsing or file access, returning 403 with no cell/file content in the response.

- [ ] **Step 4: Run focused and browser-render tests**

Run: `npm test -- tests/demo/demo-dashboard.test.tsx tests/api/imports.test.ts`

Expected: PASS; the warning is always present, no upload/mutation controls render, and demo requests receive 403.

- [ ] **Step 5: Commit**

```bash
git add app/src/features/demo app/src/app app/tests/demo app/tests/api/imports.test.ts
git commit -m "feat: add read-only Supabase demo dashboard"
```

### Task 4: Supabase provisioning, Vercel configuration, and deployment verification

**Files:**
- Create: `app/docs/VERCEL_SUPABASE_DEPLOYMENT.md`
- Modify: `app/README.md`
- Test: `app/tests/config/runtime-mode.test.ts`

**Interfaces:**
- Consumes: Supabase migration/seed from Task 1 and Vercel project `fbkr-ai-project/oh-tool`
- Produces: documented deployment values and verified Preview/Production deployment

- [ ] **Step 1: Write failing deployment-configuration tests**

```ts
it("fails on Vercel without APP_MODE=demo", () => {
  expect(() => assertSafeRuntime({ VERCEL: "1" })).toThrow("APP_MODE=demo");
});
```

- [ ] **Step 2: Run focused test to verify the Vercel guard**

Run: `npm test -- tests/config/runtime-mode.test.ts`

Expected: PASS; existing fail-closed behavior remains intact.

- [ ] **Step 3: Apply the Supabase migration and seed through the authenticated project dashboard**

Execute only `app/supabase/migrations/202609290001_demo_schema.sql` and `app/supabase/seed.demo.sql` in project `dtcybsobkoifapfxxomq`. Verify row counts and anon read/no-write behavior. Stop if any SQL screen shows non-`demo_` table targets.

- [ ] **Step 4: Configure Vercel after app code is on `main`**

Set Root Directory to `app`. Set Preview and Production `APP_MODE=demo`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; do not add a service-role key. Deploy Preview first, verify the warning and dashboard, then promote/produce from `main`. Keep Vercel Authentication enabled.

- [ ] **Step 5: Verify deployed read-only behavior**

Run: Vercel Preview URL and `GET /api/demo/dashboard`; send import preview/commit requests and confirm HTTP 403. Confirm git-sensitive-file verifier passes and that no SQLite/Excel file is tracked.

- [ ] **Step 6: Commit docs and deployment preparation**

```bash
git add app/docs/VERCEL_SUPABASE_DEPLOYMENT.md app/README.md app/tests/config/runtime-mode.test.ts
git commit -m "docs: prepare safe Supabase demo deployment"
```

## Plan Self-Review

- Spec coverage: Tasks 1–4 cover synthetic schema/seed, RLS, read-only repository/UI, mode boundary, platform configuration, and deployment verification.
- Type consistency: Task 1 defines config used by Task 2; Task 2 defines `DemoDashboard` used by Task 3; Task 4 uses only Task 1 artifacts and deployed Task 3 behavior.
- Review focus coverage: each listed risk has an owning task test or external verification step.
- Scope: this plan excludes local SQLite business workflow completion and real-data cloud migration, consistent with the spec.
