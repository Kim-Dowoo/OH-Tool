# Task 2 Report — SQLite Schema and Local Repository

## Implementation

- Added idempotent initial SQLite migration with enforced foreign keys, required check constraints, unique serial numbers, organizations, partners, and append-only audit events.
- Added `openDatabase()` with local-only runtime protection and enabled SQLite foreign keys for every opened connection.
- Added `runMigrations()` and central repository contracts for imports, requests, inventory, allocations, shipments, and dashboard aggregates.
- Implemented the local SQLite repository with transactional import commits, allocation/cancellation/shipment writes, audit rows, filtered request reads, inventory balances, and non-duplicating dashboard aggregates.
- Added only synthetic, in-memory SQLite fixtures under `app/tests/helpers`; no input sample workbook was read.

## TDD evidence

### RED

`npm test -- tests/db/migrations.test.ts` failed before implementation because `@/lib/db/migrations` did not exist. Vitest reported: `Cannot find package '@/lib/db/migrations'`.

After the repository existed, the new dashboard regression test was added first and failed as expected:

`npm test -- tests/repositories/local-repository.test.ts`

It reported `totalRequested: 5` when the hand-derived expected total was `3` for a two-SN request plus one unallocated request.

### GREEN

`npm test -- tests/db tests/repositories/local-repository.test.ts` passed with 2 files and 5 tests after the schema/repository implementation and the per-request dashboard aggregate correction.

## Final verification

Run from `app/`:

```text
npx tsc --noEmit
npm run lint
npm test
```

All commands exited successfully. The full Vitest run passed 4 files and 19 tests.

## Files

- `app/migrations/001_initial.sql`
- `app/src/lib/db/client.ts`
- `app/src/lib/db/migrations.ts`
- `app/src/lib/repositories/contracts.ts`
- `app/src/lib/repositories/local-repository.ts`
- `app/tests/helpers/fixtures.ts`
- `app/tests/db/migrations.test.ts`
- `app/tests/repositories/local-repository.test.ts`

## Self-review

- Foreign keys are enabled by both the database client and migration runner.
- SQL writes use bound parameters; dynamic dashboard grouping columns are a fixed internal allowlist.
- Audit events block updates and deletes with SQLite triggers and store only changed field names, not sensitive values.
- Dashboard aggregation calculates allocation metrics per request before summing, preventing multi-allocation request quantities from being counted more than once.
- Runtime protection prevents accidental local database opening when `APP_MODE=demo`; Task 11 will additionally avoid importing this module in demo builds.

## Concerns

- `runMigrations()` resolves the migration from the app working directory, which matches the documented app scripts and test commands. If a future runner invokes it from another working directory, it should provide a stable migration-root convention or update the resolver.

---

## Fix round 1 — 2026-09-17

### Implementation

- Persisted a trimmed, nonblank `allocations.cancel_reason`; cancellation audit rows contain the field name only.
- Added repository and SQLite trigger enforcement for terminal request rejection, request-quantity capacity, model-inventory capacity, and inventory-total reductions below active allocations.
- Changed shipment status calculation so a request becomes `SHIPPED` only when the number of shipped allocations reaches its requested quantity; otherwise it is recalculated as partial/allocated.
- Added active flags and explicit team/department/sales-representative relationship fields for organization mappings and partners. Organization imports now persist those fields.
- Made `openDatabase()` invoke `assertSafeRuntime()` before opening a database.
- Made migration lookup work from either `app/` or the repository root.
- Added a multi-row `saveImportBatch()` rollback test that verifies import batch, requests, and audit rows are all absent after a later-row uniqueness failure.

### RED evidence

Before the fixes, this focused command failed with 8 expected failures:

```text
npm test -- tests/db tests/repositories/local-repository.test.ts
```

The failures showed the exact missing protections: no Vercel assertion, repository-root migration lookup `ENOENT`, no `cancel_reason`, terminal/over-quantity allocations resolving, partial shipping marking a request shipped, inventory re-import resolving below active allocation count, missing organization/partner relation fields, and direct schema allocation capacity not enforced.

The new multi-row import rollback test was included in that RED run and passed immediately because the existing transaction already rolled back the batch, request rows, and audit row correctly; no implementation change was needed for that existing behavior.

### GREEN and final verification

Focused GREEN:

```text
npm test -- tests/db tests/repositories/local-repository.test.ts
3 files passed, 14 tests passed
```

Final verification from `app/`:

```text
npx tsc --noEmit
npm run lint
npm test
```

Typecheck and lint exited successfully. Full Vitest passed 5 files and 29 tests.

### Fix-round self-review

- SQLite triggers protect direct SQL paths, while public repository mutations repeat the relevant guards for clear application errors.
- Capacity checks count both allocated and shipped records, while cancelled records release capacity.
- The cancellation reason is retained in the allocation record and excluded from audit payload values.
- The organization-to-partner relationship uses `team_raw` as a foreign key and duplicates department/team/sales-representative fields on partner records for stable reporting.
- The migration resolver is tested after changing the current directory to the repository root.
- A versioned `002_repository_hardening.sql` migration and `schema_migrations` ledger upgrade databases created by the original `001` schema. The compatibility test was written first and failed because `cancel_reason` was absent, then passed after the versioned runner was added.

### Fix-round concerns

- None identified within this fix-round scope.

---

## Fix round 3 — 2026-09-17

### Implementation

- Added versioned migration `004_shipment_status_integrity.sql` that enforces the allocation/shipment one-to-one relation.
- A shipment may be inserted only for an allocated record; its `AFTER INSERT` trigger atomically changes that allocation to `SHIPPED` once the shipment exists.
- `SHIPPED` status now requires exactly one shipment. A shipment-bearing allocation cannot revert to `ALLOCATED` or `CANCELLED`; a shipment cannot be deleted or moved while attached to a shipped allocation.
- Removed the repository’s redundant allocation status update. The repository inserts the shipment and the database trigger performs the guarded transition.

### RED evidence

```text
npm test -- tests/db/migrations.test.ts tests/repositories/local-repository.test.ts
```

Before the migration, the two new direct-SQL tests failed as expected: an allocation could be set to `SHIPPED` with no shipment, and a shipped allocation could be reverted to `ALLOCATED` (or lose its shipment row).

### GREEN and final verification

Focused GREEN:

```text
npm test -- tests/db/migrations.test.ts tests/repositories/local-repository.test.ts
2 files passed, 20 tests passed
```

Final verification from `app/`:

```text
npx tsc --noEmit
npm run lint
npm test
```

Typecheck and lint exited successfully. Full Vitest passed 5 files and 36 tests.

### Fix-round self-review

- The migration is versioned separately so databases that already applied migrations 001–003 receive the guard triggers.
- The trigger ordering resolves SQLite’s immediate-constraint limitation: the shipment exists before the allocation is allowed to become `SHIPPED`.
- Direct-SQL tests cover invalid status-only transition, shipment insertion against a cancelled allocation, status reversion, and shipment deletion; the repository test covers the legitimate transaction path and verifies exactly one row.

### Fix-round concerns

- None identified within this fix-round scope.

---

## Fix round 2 — 2026-09-17

### Implementation

- Added versioned migration `003_allocation_update_guards.sql` to validate every active allocation update that changes `request_id`, `model_code`, or active status. Its counts exclude the allocation being updated, so only the destination request/model capacity is evaluated.
- Added a `requests.quantity` trigger that prevents reduction below the existing active allocation count.
- Changed organization and partner active flags to tri-state import semantics: `undefined` preserves an existing value, explicit `true`/`false` updates it, and new records default active.
- Partner identity rows now persist whenever partner code and name are present, including when sales representative data is omitted; the source organization relationship fields are still saved.

### RED evidence

```text
npm test -- tests/db/migrations.test.ts tests/repositories/local-repository.test.ts
```

The new tests failed as expected with four failures: direct SQL allowed active allocations to move to a terminal request and zero-capacity model, omitted active flags reactivated disabled rows, and a partner with no sales representative was not persisted.

### GREEN and final verification

Focused GREEN:

```text
npm test -- tests/db/migrations.test.ts tests/repositories/local-repository.test.ts
2 files passed, 17 tests passed
```

Final verification from `app/`:

```text
npx tsc --noEmit
npm run lint
npm test
```

Typecheck and lint exited successfully. Full Vitest passed 5 files and 33 tests.

### Fix-round self-review

- The new trigger is in a separate migration so databases that already recorded `002_repository_hardening.sql` receive it.
- Direct update tests cover terminal destination rejection, request-capacity reduction, and target model capacity zero.
- The upserts use `NULL` internally only to represent omitted optional active values; persisted active fields remain constrained to `0` or `1`.
- Missing partner sales representatives are represented as an empty string only for the existing non-null legacy column; imports do not erase an already stored sales representative.

### Fix-round concerns

- None identified within this fix-round scope.

---

## Fix round 4 — 2026-09-29

### Implementation

- Inspected and retained the in-scope partial migration `005_reject_direct_shipped_allocations.sql` and its migration-runner registration.
- The migration adds a `BEFORE INSERT` trigger rejecting any new allocation whose initial status is `SHIPPED`. Migration 004 guarded status updates only, which allowed direct inserts to bypass shipment validation.
- Strengthened the direct-insert regression to require a shipment-related error and verify neither an allocation nor shipment row survives the rejected statement.
- Kept the existing repository shipping regression, which asserts the allocation becomes `SHIPPED` with exactly one matching shipment row.

### RED evidence

Temporarily removed only migration 005 from the runner and executed from `app/`:

```text
npm test -- tests/db/migrations.test.ts tests/repositories/local-repository.test.ts
Test Files  1 failed | 1 passed (2)
Tests       1 failed | 20 passed (21)
```

The direct-insert regression failed with `AssertionError: expected [Function] to throw an error`, confirming that migration 004 alone permits the invalid insertion. Restored migration 005 registration after this controlled regression check.

### GREEN and final verification

Commands executed from `app/`:

```text
npm test -- tests/db/migrations.test.ts tests/repositories/local-repository.test.ts
Test Files  2 passed (2)
Tests       21 passed (21)
Exit code   0

npm test
Test Files  5 passed (5)
Tests       37 passed (37)
Exit code   0

npx tsc --noEmit
Exit code   0

npm run lint
eslint .
Exit code   0
```

`git diff --check` also exited 0. Git emitted only its existing LF-to-CRLF working-copy notices.

### Fix-round self-review

- A separate versioned migration ensures installations that already recorded migrations 001–004 receive the missing insert guard.
- The new trigger affects allocation insertion only. The legitimate shipment `INSERT` still runs migration 004's `AFTER INSERT` trigger, which changes an existing allocation to `SHIPPED` once its shipment exists.
- The regression uses valid seeded request/inventory references, available capacity, and a unique serial number, so unrelated constraints cannot explain the rejection.
- The focused and full suites exercise successful repository `ship()` calls alongside the new rejection case. No repository API changes or unrelated edits were needed.

### Fix-round concerns

- None identified within this fix-round scope. This migration prevents new invalid inserts; it does not repair any invalid rows previously created outside the repository.
