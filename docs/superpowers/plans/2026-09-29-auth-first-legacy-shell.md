# Auth-First Legacy Workspace Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the prior OH dashboard shell while retaining Supabase-backed authentication and real shared workflow data.

**Architecture:** A reusable authenticated workspace shell owns the legacy sidebar, header, and Supabase logout action. The root route always starts at login; successful sign-in resolves the active profile and redirects to the appropriate role workspace. Admin and user content components render into the shell with their existing Supabase query and command boundaries.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase SSR/Auth, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-auth-first-legacy-shell-design.md`

## Global Constraints

- `/` always redirects to `/login`.
- Authentication remains employee-ID/password based; no role picker, demo data, or browser-local request storage.
- A successful sign-in redirects only to the active profile's `/admin` or `/user` workspace.
- Logout clears the Supabase session and returns to `/login`.
- Keep the existing Supabase RLS and RPC command boundaries.
- User menu order is exactly `OH 등록`, `OH 요청 현황`, `배정 및 출고 현황`.

## Review Focus

- Visiting `/` with an existing session still opens the login screen.
- A pending user never reaches a role workspace after signing in.
- Logout prevents a subsequent `/admin` or `/user` request without reauthentication.
- Admin dashboard totals use live rows, not fixture values.
- Empty live data renders usable empty states instead of demo-looking content.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `app/src/components/workspace-shell.tsx` | Legacy sidebar/header shell and logout action. |
| `app/src/app/page.tsx` | Auth-first root redirect. |
| `app/src/app/(auth)/actions.ts` | Role-aware post-login redirect. |
| `app/src/components/admin-workspace.tsx` | Legacy-style admin navigation and live dashboard panels. |
| `app/src/components/user-workspace.tsx` | Legacy-style user navigation within the shared shell. |
| `app/src/lib/oh/queries.ts` | Live dashboard aggregation readers. |
| `app/tests/workspace/*` | Root/login/logout and shell behavior. |
| `app/tests/oh/*` | Role menus and live-data dashboard rendering. |

### Task 1: Add auth-first routing and reusable workspace shell

**Files:**
- Create: `app/src/components/workspace-shell.tsx`
- Modify: `app/src/app/page.tsx`, `app/src/app/(auth)/actions.ts`, `app/src/app/(workspace)/layout.tsx`, `app/src/app/page.module.css`
- Test: `app/tests/workspace/auth-first-shell.test.tsx`

**Interfaces:**
- Produces `WorkspaceShell({ role, menu, children })` and uses `signOut()`.
- Changes `signInWithEmployeeId` to redirect to `getWorkspaceDestination(profile)` after session creation.

- [ ] **Step 1: Write failing routing and shell tests**

Test that root redirects to `/login`, the shell renders the legacy sidebar/header and logout button, and a logout action returns to login.

- [ ] **Step 2: Run the targeted test and verify it fails**

Run: `npm test -- --run tests/workspace/auth-first-shell.test.tsx`

Expected: FAIL because the shell and auth-first redirect do not exist.

- [ ] **Step 3: Implement the root redirect, profile-aware post-login redirect, and shell**

Preserve session protection in workspace routes; only the public root always routes to login. Use the existing `signOut` server action from the shared header.

- [ ] **Step 4: Run targeted tests and lint**

Run: `npm test -- --run tests/workspace/auth-first-shell.test.tsx && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/workspace-shell.tsx app/src/app/page.tsx app/src/app/'(auth)'/actions.ts app/src/app/'(workspace)'/layout.tsx app/src/app/page.module.css app/tests/workspace
git commit -m "feat: restore auth-first workspace shell"
```

### Task 2: Restore the legacy-style user workspace

**Files:**
- Modify: `app/src/components/user-workspace.tsx`, `app/src/app/(workspace)/user/page.tsx`, `app/src/app/page.module.css`
- Test: `app/tests/oh/user-requests.test.tsx`

**Interfaces:**
- Consumes `WorkspaceShell`, `createRequest`, `listOwnRequests`, `listOwnAllocations`, and `listOwnShipments`.
- Produces the required three-item sidebar menu and live form/status views.

- [ ] **Step 1: Extend the failing user workspace test**

Assert the exact sidebar menu labels/order and that the request form and live status tables render inside the legacy shell.

- [ ] **Step 2: Run the targeted user test and verify it fails**

Run: `npm test -- --run tests/oh/user-requests.test.tsx`

Expected: FAIL because user content is not rendered through the legacy shell.

- [ ] **Step 3: Render user views through the shell**

Replace horizontal tabs with the legacy sidebar navigation while preserving the first `OH 등록` view, request save behavior, and live empty states.

- [ ] **Step 4: Run targeted user tests and lint**

Run: `npm test -- --run tests/oh/user-requests.test.tsx && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/user-workspace.tsx app/src/app/'(workspace)'/user app/src/app/page.module.css app/tests/oh/user-requests.test.tsx
git commit -m "feat: restore user workspace layout"
```

### Task 3: Restore the legacy-style administrator workspace with live metrics

**Files:**
- Modify: `app/src/lib/oh/queries.ts`, `app/src/components/admin-workspace.tsx`, `app/src/app/(workspace)/admin/page.tsx`, `app/src/app/page.module.css`
- Test: `app/tests/oh/admin-operations.test.tsx`

**Interfaces:**
- Produces `listAdminDashboardData()` with live request, allocation, shipment, and revenue totals.
- Consumes the existing approval, inventory, allocation, and shipment RPC command adapters.

- [ ] **Step 1: Extend failing admin tests**

Assert the legacy five-item sidebar, dashboard metric labels, and that empty data produces zero-value cards rather than fixture rows.

- [ ] **Step 2: Run the targeted administrator test and verify it fails**

Run: `npm test -- --run tests/oh/admin-operations.test.tsx`

Expected: FAIL because live dashboard data and legacy layout are absent.

- [ ] **Step 3: Implement live dashboard aggregation and legacy navigation**

Use live Supabase rows to populate the dashboard cards; retain the existing request, stock, allocation, shipment, and approval operations in their matching menu views.

- [ ] **Step 4: Run targeted administrator tests and lint**

Run: `npm test -- --run tests/oh/admin-operations.test.tsx && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/oh/queries.ts app/src/components/admin-workspace.tsx app/src/app/'(workspace)'/admin app/src/app/page.module.css app/tests/oh/admin-operations.test.tsx
git commit -m "feat: restore administrator dashboard layout"
```

### Task 4: Verify and document the restored experience

**Files:**
- Modify: `app/README.md`
- Test: `app/tests/workspace/auth-first-shell.test.tsx`, `app/tests/oh/user-requests.test.tsx`, `app/tests/oh/admin-operations.test.tsx`

**Interfaces:**
- Consumes all prior task interfaces.
- Documents authentication-first navigation and the initial-admin promotion prerequisite.

- [ ] **Step 1: Add login/logout regression coverage**

Test root-to-login behavior, a successful active-profile route destination, and logout returning to login.

- [ ] **Step 2: Update operational copy**

Document that users always start at login and that the initial Supabase administrator must be active before accessing admin screens.

- [ ] **Step 3: Run full verification**

Run from `app/`:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/README.md app/tests app/src
git commit -m "feat: finalize auth-first OH workspace"
```

## Spec Coverage Review

- Auth-first entry and logout: Tasks 1 and 4.
- Legacy visual shell: Tasks 1 through 3.
- Live Supabase user workflows: Task 2.
- Live Supabase administrator workflows and dashboard: Task 3.
- Regression coverage and operations guidance: Task 4.
