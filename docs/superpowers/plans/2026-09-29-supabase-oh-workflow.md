# Supabase OH Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser-only OH demo with a Supabase-backed, employee-ID authenticated workflow for request registration, approval, allocation, and shipment.

**Architecture:** Next.js uses Supabase Auth sessions stored in cookies and PostgreSQL RLS for all reads. Mutations that affect stock, allocations, shipments, or account approval run through security-definer RPC functions that atomically enforce role, status, and inventory constraints. The UI is split into user and administrator workspaces determined by the active `profiles` row.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth, `@supabase/ssr`, `@supabase/supabase-js`, PostgreSQL RLS/RPC, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-29-supabase-oh-workflow-design.md`

## Global Constraints

- The visible login identifier is a numeric 10-digit employee ID; never show or log the internal Auth email alias.
- A new account is always `USER` and `PENDING`; client input cannot select role or activation status.
- The user-provided initial administrator employee ID is promoted manually in Supabase SQL only after its first signup; do not commit it in code, migrations, or environment files.
- Use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; never use or commit a Supabase secret/service-role key.
- Users can read and create only their own data after activation. Administrators operate on all data.
- User menu order and labels are exactly `OH 등록`, `OH 요청 현황`, `배정 및 출고 현황`.
- An administrator login click must show employee-ID/password authentication, never set an administrator role directly.
- Reads must reflect other users' changes after navigation or refresh; realtime subscription is not in scope.

## Review Focus

- A forged signup payload containing `ADMIN` or `ACTIVE` must still create a pending user profile.
- A pending or suspended account must be unable to read, create, allocate, or ship data even if it calls Supabase directly.
- An administrator cannot allocate a duplicate, unavailable, wrong-model, or excess-quantity SN.
- An administrator cannot ship an unallocated or already shipped SN.
- A user cannot infer another user's requests, allocation SNs, shipment rows, or approval records through direct table/API calls.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `app/supabase/migrations/202609290001_oh_workflow.sql` | PostgreSQL schema, RLS policies, profile trigger, RPC functions, audit triggers |
| `app/supabase/seed/initial-admin.sql` | Manual, parameterized one-time promotion instructions; no employee ID committed |
| `app/src/lib/auth/employee-id.ts` | Employee-ID validation and private Supabase Auth alias conversion |
| `app/src/lib/supabase/{browser,server,middleware}.ts` | Scoped Supabase client creation and session refresh |
| `app/src/lib/oh/{types,queries,commands}.ts` | Typed data readers and RPC mutation boundaries |
| `app/src/app/(auth)/*` | Signup and signin views/actions with employee-ID/password fields |
| `app/src/app/(workspace)/*` | Authenticated shell and role-specific routes |
| `app/src/components/user-workspace.tsx` | User registration, request history, allocation/shipment presentation |
| `app/src/components/admin-workspace.tsx` | Approval, SN inventory, allocation, and shipment operations |
| `app/src/components/legacy-demo-*` | Removed once production workspace replaces the role-selection demo |
| `app/tests/{auth,oh,workspace}/*` | Unit and integration coverage for helpers, permissions, and screen behavior |
| `app/tests/e2e/oh-workflow.spec.ts` | Browser workflow test against a dedicated Supabase test project/local stack |
| `.env.example`, `README.md`, `vercel.json`, `app/next.config.ts` | Required public environment variables and dynamic Vercel deployment configuration |

### Task 1: Add Supabase runtime configuration and employee-ID primitives

**Files:**
- Modify: `app/package.json`, `app/package-lock.json`, `app/next.config.ts`, `vercel.json`, `README.md`
- Create: `app/.env.example`, `app/src/lib/auth/employee-id.ts`, `app/tests/auth/employee-id.test.ts`
- Modify: `app/src/lib/config/runtime-mode.ts`, `app/tests/config/runtime-mode.test.ts`

**Interfaces:**
- Produces `parseEmployeeId(value: string): string | null` and `toAuthAlias(employeeId: string): string`.
- Produces `getSupabasePublicConfig(env): { url: string; publishableKey: string }` that fails safely for missing or malformed public configuration.

- [ ] **Step 1: Write the failing employee-ID/config tests**

```ts
expect(parseEmployeeId("1234567890")).toBe("1234567890");
expect(parseEmployeeId("800003086")).toBeNull();
expect(toAuthAlias("1234567890")).toBe("1234567890@auth.oh-tool.invalid");
expect(() => getSupabasePublicConfig({})).toThrow("Supabase public configuration is required");
```

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run: `npm test -- --run tests/auth/employee-id.test.ts tests/config/runtime-mode.test.ts` from `app/`.

Expected: FAIL because the Supabase configuration and employee-ID helpers do not exist.

- [ ] **Step 3: Add Supabase dependencies and implement the helpers**

Install `@supabase/ssr` and `@supabase/supabase-js`. Replace static demo-only runtime configuration with dynamic Supabase public-config validation. Keep aliases private to the auth helper and do not emit them in UI error messages.

- [ ] **Step 4: Add public configuration documentation**

Create `.env.example` with placeholders only for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Update Vercel configuration to build the dynamic App Router app; remove the demo static-export build command and preserve secret exclusion guidance.

- [ ] **Step 5: Run targeted tests and lint**

Run: `npm test -- --run tests/auth/employee-id.test.ts tests/config/runtime-mode.test.ts && npm run lint` from `app/`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/package-lock.json app/.env.example app/src/lib/auth app/src/lib/config app/tests/auth app/tests/config app/next.config.ts vercel.json README.md
git commit -m "feat: configure Supabase runtime"
```

### Task 2: Create the Supabase schema, RLS policies, and transaction RPCs

**Files:**
- Create: `app/supabase/migrations/202609290001_oh_workflow.sql`, `app/supabase/seed/initial-admin.sql`, `app/tests/oh/schema-contract.test.ts`

**Interfaces:**
- Produces enum-backed `profiles`, `requests`, `inventory_serials`, `allocations`, `shipments`, and append-only `audit_events` tables.
- Produces RPC functions `approve_profile(target_profile_id uuid)`, `register_inventory_serial(model_code text, serial_number text, storage_location text)`, `allocate_serial(request_id uuid, serial_number text)`, and `ship_allocation(allocation_id uuid, shipped_at date, revenue integer, note text)`.

- [ ] **Step 1: Write failing schema contract tests**

Write a test that reads the migration text only to execute it against the dedicated PostgreSQL/Supabase test database, then verifies these outcomes with distinct admin and user sessions: forged profile metadata remains pending, user visibility is self-only, allocation rejects duplicate/wrong-model/excess SN, and shipment rejects non-allocated SN.

- [ ] **Step 2: Run the schema contract test against the isolated test Supabase database**

Run: `npm test -- --run tests/oh/schema-contract.test.ts` with the test Supabase environment configured.

Expected: FAIL because migrations and RPCs do not exist.

- [ ] **Step 3: Implement schema and profile trigger**

Create enum types and tables with UUID primary keys, foreign keys, uniqueness constraints, and indexes for owner/status joins. Add an `auth.users` trigger that derives the 10-digit employee ID from trusted signup metadata, but always inserts `USER/PENDING`.

- [ ] **Step 4: Implement RLS and RPC functions**

Enable RLS for every table. Use `auth.uid()` and an `is_active_admin()` helper in policies. Implement RPCs with `SECURITY DEFINER`, fixed `search_path`, explicit caller role/status checks, row locks where stock is consumed, status transitions, and append-only audit events. Revoke direct mutation permissions where RPC ownership is required.

- [ ] **Step 5: Add initial-admin operational SQL**

Write a parameterized SQL Editor snippet that the project owner runs after the first signup to promote a supplied employee ID. The committed file must use a placeholder, never a real employee ID.

- [ ] **Step 6: Run schema contract tests**

Run: `npm test -- --run tests/oh/schema-contract.test.ts`.

Expected: PASS against the isolated test database.

- [ ] **Step 7: Commit**

```bash
git add app/supabase app/tests/oh/schema-contract.test.ts
git commit -m "feat: add Supabase OH schema and policies"
```

### Task 3: Implement session-backed signup, signin, and approval gating

**Files:**
- Create: `app/src/lib/supabase/browser.ts`, `app/src/lib/supabase/server.ts`, `app/src/lib/supabase/middleware.ts`, `app/src/app/(auth)/actions.ts`, `app/src/app/(auth)/login/page.tsx`, `app/src/app/(auth)/signup/page.tsx`, `app/src/app/(workspace)/layout.tsx`, `app/src/app/(workspace)/pending/page.tsx`, `app/middleware.ts`
- Modify: `app/src/app/page.tsx`
- Create: `app/tests/auth/session-actions.test.ts`, `app/tests/workspace/approval-gate.test.tsx`

**Interfaces:**
- Consumes `parseEmployeeId`, `toAuthAlias`, and public Supabase config from Task 1.
- Consumes `profiles` and RLS rules from Task 2.
- Produces `signUpWithEmployeeId(input)`, `signInWithEmployeeId(input)`, `signOut()`, and `requireActiveProfile()`.

- [ ] **Step 1: Write failing auth/approval tests**

Test that signup sends only the derived alias plus employee ID metadata, login accepts an employee ID but does not display the alias, unauthenticated users redirect to login, pending users redirect to the approval page, and inactive users cannot render workspace menus.

- [ ] **Step 2: Run targeted auth tests and verify failure**

Run: `npm test -- --run tests/auth/session-actions.test.ts tests/workspace/approval-gate.test.tsx`.

Expected: FAIL because no session/client boundary exists.

- [ ] **Step 3: Implement Supabase SSR clients and auth actions**

Use cookie-aware server clients and browser clients from `@supabase/ssr`. Perform signup/signin/signout in server actions; map Auth failures to generic Korean copy. Do not accept a role or approval field from the form.

- [ ] **Step 4: Implement route protection**

Use middleware only to refresh the Supabase session. In the workspace layout, load the profile once and redirect based on unauthenticated, pending, suspended, active-user, and active-admin states. Replace the direct demo role-selection login screen entirely.

- [ ] **Step 5: Run targeted auth tests**

Run: `npm test -- --run tests/auth/session-actions.test.ts tests/workspace/approval-gate.test.tsx`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/supabase app/src/app/'(auth)' app/src/app/'(workspace)' app/middleware.ts app/src/app/page.tsx app/tests/auth app/tests/workspace
git commit -m "feat: add employee ID authentication"
```

### Task 4: Implement user request registration and status views

**Files:**
- Create: `app/src/lib/oh/types.ts`, `app/src/lib/oh/queries.ts`, `app/src/lib/oh/commands.ts`, `app/src/components/user-workspace.tsx`, `app/src/app/(workspace)/user/page.tsx`
- Modify: `app/src/components/request-details.tsx`, `app/src/app/page.module.css`
- Create: `app/tests/oh/user-requests.test.tsx`, `app/tests/oh/user-isolation.test.ts`

**Interfaces:**
- Consumes active session/profile from Task 3 and RLS tables from Task 2.
- Produces `createRequest(input: CreateRequestInput)`, `listOwnRequests()`, `listOwnAllocations()`, and `listOwnShipments()`.

- [ ] **Step 1: Write failing user-flow tests**

```tsx
expect(screen.getAllByRole("button", { name: /OH 등록|OH 요청 현황|배정 및 출고 현황/ })).toHaveLength(3);
await user.click(screen.getByRole("button", { name: "OH 등록" }));
await user.type(screen.getByLabelText("요청 기종"), "OH-100");
await user.click(screen.getByRole("button", { name: "요청 저장" }));
expect(await screen.findByText("접수")).toBeTruthy();
```

Also test that a different active user cannot retrieve the created request through the query boundary.

- [ ] **Step 2: Run targeted user tests and verify failure**

Run: `npm test -- --run tests/oh/user-requests.test.tsx tests/oh/user-isolation.test.ts`.

Expected: FAIL because user workspace readers and mutation do not exist.

- [ ] **Step 3: Implement typed user query and command boundaries**

Create typed mapping for Supabase rows. `createRequest` must derive `created_by` from the authenticated session and never accept it from the form. Query functions should request only RLS-permitted fields and sort newest requests first.

- [ ] **Step 4: Implement user workspace navigation**

Replace the old user demo sidebar with exactly these ordered tabs: `OH 등록`, `OH 요청 현황`, `배정 및 출고 현황`. The third tab combines allocation and shipment rows for the current user, with clear status and empty states.

- [ ] **Step 5: Run targeted user tests**

Run: `npm test -- --run tests/oh/user-requests.test.tsx tests/oh/user-isolation.test.ts`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/oh app/src/components/user-workspace.tsx app/src/app/'(workspace)'/user app/src/components/request-details.tsx app/src/app/page.module.css app/tests/oh
git commit -m "feat: add user OH request and status workspace"
```

### Task 5: Implement administrator approval, SN inventory, allocation, and shipment operations

**Files:**
- Create: `app/src/components/admin-workspace.tsx`, `app/src/app/(workspace)/admin/page.tsx`
- Modify: `app/src/lib/oh/queries.ts`, `app/src/lib/oh/commands.ts`, `app/src/app/page.module.css`
- Create: `app/tests/oh/admin-operations.test.tsx`, `app/tests/oh/allocation-shipment-rpc.test.ts`

**Interfaces:**
- Consumes `approveProfile`, `registerInventorySerial`, `allocateSerial`, and `shipAllocation` RPC boundaries from Task 2.
- Produces an administrator workspace with `가입 승인`, `요청 관리`, `SN 재고`, `OH 배정`, and `출고 관리` sections.

- [ ] **Step 1: Write failing administrator workflow tests**

Test that only an active admin sees all five operations, approval activates a pending account, an available matching-model SN can be allocated, a duplicate or unavailable SN shows an error, and a successfully shipped allocation appears in the owner’s shipment data.

- [ ] **Step 2: Run targeted administrator tests and verify failure**

Run: `npm test -- --run tests/oh/admin-operations.test.tsx tests/oh/allocation-shipment-rpc.test.ts`.

Expected: FAIL because administrator command views do not exist.

- [ ] **Step 3: Implement administrator query and mutation adapters**

Call only the Task 2 RPCs for approval, stock registration, allocation, and shipment. Refresh read models after successful actions. Translate known RPC errors to the exact Korean action-level error state without exposing database internals.

- [ ] **Step 4: Implement administrator workspace**

Provide requests with remaining quantity, SN inventory registration/listing, matching available-SN selection for allocation, and allocated-SN shipment form with date, revenue defaulting to `0`, and optional note. Do not provide direct table writes or a role-toggle login path.

- [ ] **Step 5: Run targeted administrator tests**

Run: `npm test -- --run tests/oh/admin-operations.test.tsx tests/oh/allocation-shipment-rpc.test.ts`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/admin-workspace.tsx app/src/app/'(workspace)'/admin app/src/lib/oh app/src/app/page.module.css app/tests/oh
git commit -m "feat: add administrator allocation and shipment workflow"
```

### Task 6: Replace legacy demo artifacts, run end-to-end checks, and document deployment

**Files:**
- Delete: `app/src/components/demo-workspace.tsx`, `app/src/components/demo-banner.tsx`, `app/src/demo/seed.ts`, `app/tests/demo/dashboard.test.tsx`, related demo-only tests
- Modify: `app/src/app/layout.tsx`, `README.md`, `docs/USER_PREPARATION_CHECKLIST.md`
- Create: `app/tests/e2e/oh-workflow.spec.ts`, `docs/SUPABASE_VERCEL_SETUP.md`

**Interfaces:**
- Consumes all prior task interfaces.
- Produces deployment instructions that use public Supabase settings only, SQL migration application steps, initial-admin promotion instructions, and Vercel environment-variable instructions.

- [ ] **Step 1: Write failing end-to-end workflow tests**

Use distinct test users: sign up a user, verify pending gate, promote with the test admin fixture, create a request, register and allocate an SN as admin, ship it, then sign in as the user and verify `배정 및 출고 현황` displays the same SN and shipment date. Include direct-request checks that enforce user isolation.

- [ ] **Step 2: Run the end-to-end test and verify failure**

Run: `npm run test:e2e -- tests/e2e/oh-workflow.spec.ts` against the dedicated test Supabase project/local Supabase stack.

Expected: FAIL until all production paths are wired.

- [ ] **Step 3: Remove demo-only surface area and finish navigation**

Remove localStorage role persistence, role-select buttons, static seed imports, and static-export/demo-only assumptions. Keep only shared Supabase-backed routes and session-aware navigation.

- [ ] **Step 4: Write operational setup documentation**

Document migration application in the user-provided Supabase project, disabling email confirmation for employee-ID alias signup, the parameterized initial-admin promotion operation, Vercel public environment variables, and secret-key rotation/exclusion. Never reproduce a real secret or the administrator employee ID in this document.

- [ ] **Step 5: Run full verification**

Run from `app/`:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run test:e2e -- tests/e2e/oh-workflow.spec.ts
npm run build
```

Expected: all commands pass; Vercel build is dynamic rather than static export.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: launch shared Supabase OH workflow"
```

## Spec Coverage Review

- Employee-ID authentication and pending approval: Tasks 1 and 3.
- Profile roles, RLS, audit trail, atomic business constraints: Task 2.
- User request, allocation, and shipment visibility with exact menu labels/order: Task 4.
- Administrator approval, SN stock, allocation, and shipment operations: Task 5.
- Dynamic Vercel deployment, setup instructions, and full multi-user verification: Task 6.

The updated navigation labels and the removal of immediate administrator role login are covered in Tasks 3, 4, and 6.
