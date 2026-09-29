# ICR implementation progress

## 2026-09-29 — assessment and first delivery slice

### Baseline

- Prisma has organization, legal-entity, RBAC and authentication models only; it has no financial transaction, run, import, exception, audit, or evidence records.
- The API provides JWT login and tenant-scoped organization/legal-entity endpoints with unit and HTTP tests.
- The worker has no jobs or tests. The web application was the untouched Next.js starter.
- `pnpm test` currently fails before API tests complete because the worker has no test files (Vitest exits 1). Subsequent checks are still pending.

### Phased plan and acceptance criteria

1. **Foundation:** deliver a responsive shell, protected session UI, real organization selector, and usable master-data list. Acceptance: no client-side token persistence; authenticated calls work using the session cookie.
2. **Master data:** finish API + UI for counterparties, accounts and relationships, with organization-scoped authorization and tests.
3. **Ingestion:** additive schema, upload metadata, CSV validation/normalization, durable import jobs and worker processing.
4. **Reconciliation:** additive financial schema, deterministic decimal matching, run lifecycle and persisted match/exception results.
5. **Exceptions/reporting:** investigation, approval/audit workflows and authorized exports.
6. **Hardening:** health/readiness, full quality gates, operational documentation, tenant-negative and precision tests.

### Architecture risks

- A substantial additive Prisma migration is required before financial workflows can be implemented; no destructive migration is appropriate.
- Auth was bearer-token only. The UI needs an HttpOnly cookie session and cross-origin local-development CORS controls; this first slice introduces that compatibility layer while retaining bearer authentication for API integrations/tests.
- The frontend has no component/icon/query dependencies, so the first slice intentionally uses native accessible controls and a small local component layer rather than adding dependencies prematurely.

### Foundation delivered

- Added `/login`, with validation, submission/error states, and an API session-based sign-in flow.
- Replaced the starter page with a responsive Ledgerline shell: navigation, account controls, organization filter, real authorized-organization list, create-organization dialog, loading, error and empty states.
- Dashboard financial cards deliberately show `—`/zero only where the persisted financial domain does not exist; no financial metrics or charts are fabricated.
- Login now sets a short-lived `HttpOnly`, `SameSite=Lax` cookie and no longer returns the JWT to browser application code. Existing Bearer authentication remains for programmatic clients and existing API tests.
- Enabled credentialed CORS for the configured `WEB_ORIGIN` (default `http://localhost:3000`). Add `WEB_ORIGIN` to deployment configuration when serving the web application separately.

### Verification (actual results)

- `pnpm --filter api test`: **4 files, 36 tests passed**.
- `pnpm --filter api build`: **passed**.
- `pnpm --filter worker typecheck`: **passed**.
- `pnpm --filter api lint`: **passed**.
- `pnpm --filter web lint`: **passed**.
- `pnpm --filter web exec tsc --noEmit`: **passed**.
- `pnpm --filter web build`: blocked by a Next.js/Turbopack environment failure while its CSS worker binds an internal port (`Operation not permitted`). Retrying outside the sandbox produced the same failure. The supported webpack fallback reached a separate Next.js 16 / TypeScript configuration parsing failure, while direct TypeScript validation passes.
- Root `pnpm test` remains blocked by the pre-existing worker configuration: Vitest finds no worker tests and exits with code 1 before the full task graph completes.

## 2026-09-29 — Phase 2 API foundation

### Delivered

- Repaired the existing Prisma relation declaration syntax and aligned two Prisma client relation names with the already-implemented authentication service. `pnpm prisma validate` and `pnpm prisma generate` now succeed. This is a schema-client correction only; it creates no migration and changes no database table.
- Added organization-scoped endpoints for counterparties, accounts and intercompany relationships:
  - `GET/POST/PATCH /api/v1/organizations/:organizationId/master-data/counterparties`
  - `GET/POST/PATCH /api/v1/organizations/:organizationId/master-data/accounts`
  - `GET/POST/PATCH /api/v1/organizations/:organizationId/master-data/relationships`
- Each operation confirms current organization access server-side, prevents inaccessible-tenant enumeration with a 404, validates legal-entity ownership, enforces unique domain codes through the existing constraints, and supports controlled deactivation through `PATCH` rather than deletion.
- Intercompany relationships reject self-references, cross-organization entity references and invalid effective date ranges.
- Added `master_data:read` and `master_data:manage` to the idempotent RBAC seed. Also removed its invalid `isSystemRole` field, which does not exist in the current schema.

### Verification (actual results)

- `pnpm prisma validate`: **passed**.
- `pnpm prisma generate`: **passed**.
- `pnpm --filter api test`: **5 files, 39 tests passed** (including organization-isolation and relationship validation coverage for the new service).
- `pnpm --filter api build`: **passed**.
- `pnpm --filter api lint`: **passed**.

### Next slice

- Build the API-connected master-data pages/forms over these endpoints, then start the additive financial transaction/import schema. No financial migration has been created yet.

## 2026-09-29 — Phase 2 master-data workspace

### Delivered

- Added `/master-data`, an API-connected workspace for the currently authorized organization.
- Users can browse counterparties, accounts and intercompany relationships in responsive tables, with loading, empty, error and organization-selection states.
- Added creation dialogs for all three record types. The UI submits only after the API confirms success, surfaces API validation/conflict messages, and refreshes from persisted records.
- The master-data navigation is now a real route. Unimplemented navigation destinations were removed instead of presenting inert production-looking controls.

### Verification (actual results)

- `pnpm --filter web lint`: **passed**.
- `pnpm --filter web exec tsc --noEmit`: **passed**.
- `pnpm --filter api test`: **5 files, 39 tests passed**.
- `pnpm --filter api build`: **passed**.

### Next slice

- Add edit actions to the master-data UI, then begin the additive source-import and transaction persistence schema. Financial data, reconciliation runs and reporting are not yet implemented.

## 2026-09-29 — Phase 2 activation controls

- Added in-table **Deactivate/Reactivate** controls for counterparties, accounts and intercompany relationships. These call the existing organization-scoped PATCH API and use a disabled in-flight state to prevent repeat submission.
- The UI updates the persisted activation result only after the API confirms it; failed updates retain the prior visible state.
- `pnpm --filter web lint` and `pnpm --filter web exec tsc --noEmit`: **passed**.

## 2026-09-29 — Phase 3 ingestion persistence foundation

### Delivered

- Added additive migration `20260929193000_add_import_staging`; no table, record, or column is removed or rewritten.
- Added organization-scoped source-system records and durable import batches. An import batch records a generated storage key, SHA-256 content hash, original filename, source/legal-entity context, file type, column mapping, lifecycle state, row counts and bounded failure reason.
- Added row-level import staging, preserving raw input, normalized result and validation errors without treating upload success as an import result.
- Added a per-organization idempotency constraint so a retry cannot silently create duplicate import batches.
- Added indexes for the intended organization/status/history queries and organization-scoped composite legal-entity foreign-key integrity.

### Verification (actual results)

- `pnpm prisma validate`: **passed**.
- `pnpm prisma generate`: **passed**.
- `pnpm --filter api build`: **passed**.
- `pnpm --filter worker typecheck`: **passed**.

### Next slice

- Implement authorized source-system and import-batch APIs, secure object storage adapter, then queue bounded CSV processing in the worker. XLSX is deliberately not claimed until a compatible parser and validation path are implemented.

## 2026-09-29 — Phase 3 ingestion API

### Delivered

- Added permission-protected source-system and import-batch APIs under the organization route.
- A draft import batch validates organization, legal entity and source-system ownership; normalizes a client filename; creates an opaque generated storage key; persists the client-provided SHA-256 hash; and enforces a scoped idempotency key.
- Import batches can be listed with legal-entity/source context and moved only from `DRAFT` or `FAILED` to `QUEUED`. This prevents accidental repeat queueing and preserves a durable lifecycle record before worker processing exists.
- Added `imports:read` and `imports:manage` to the RBAC seed.

### Verification (actual results)

- `pnpm --filter api build`: **passed**.
- `pnpm --filter api lint`: **passed**.
- `pnpm --filter api test`: **5 files, 39 tests passed**.
- `pnpm prisma validate`: **passed**.

### Next slice

- Add object-storage upload completion checks and a queue producer/worker consumer for CSV. Until those exist, import batch creation is deliberately a staged metadata operation, not a completed import.

## 2026-09-29 — Phase 3 queue contract

### Delivered

- Added BullMQ producer logic after the durable `QUEUED` batch update. Jobs use the batch ID as their queue job ID, bounded retries, exponential backoff and bounded retained history.
- Queue submission failure rolls the batch to `FAILED` with a durable, operator-actionable reason; it is never left falsely queued.
- Replaced the worker placeholder with an `icr-imports` BullMQ consumer. It atomically moves a queued batch to `PROCESSING` and records a durable failure when there are no staged rows or no transaction-normalization implementation.
- This worker behavior is intentionally conservative: it does **not** mark imports complete until secure file retrieval, row validation and transaction persistence are implemented.
- Added required API/worker workspace dependencies from the existing package store with no network download.

### Verification (actual results)

- `pnpm --filter api build`: **passed**.
- `pnpm --filter worker typecheck`: **passed**.
- `pnpm --filter api lint`: **passed**.
- `pnpm --filter api test`: **5 files, 39 tests passed**.

### Next slice

- Implement an authenticated object-storage adapter and CSV row staging; only then enable a worker transition to a successful import result. Add transaction persistence before implementing reconciliation matching.

## 2026-09-29 — Phase 4 financial persistence foundation

### Delivered

- Added additive migration `20260929194500_add_transactions_and_runs` for normalized transactions and reconciliation-run records.
- Authoritative transaction amounts are PostgreSQL `DECIMAL(20,6)`; no `number` field is used for financial value.
- A transaction has organization/legal-entity scope, raw source payload, source-record idempotency, a currency, document reference, date and explicit reconciliation status.
- A run has a bounded lifecycle, immutable rules-version reference, optional input fingerprint, counters, failure reason and UTC processing timestamps. The database rejects an end date preceding its start date.

### Verification (actual results)

- `pnpm prisma validate`: **passed**.
- `pnpm prisma generate`: **passed**.
- `pnpm --filter api build`: **passed**.
- `pnpm --filter worker typecheck`: **passed**.

### Next slice

- Implement CSV row validation to produce normalized transaction records, then implement deterministic reconciliation matching over persisted transactions. No reconciliation results are fabricated before that pipeline exists.

## 2026-09-29 — Phase 4 deterministic matching kernel

### Delivered

- Added a pure, deterministic exact-reference matching kernel, deliberately isolated from HTTP and worker concerns.
- Amounts are parsed from the persisted decimal string into fixed six-decimal `bigint` values; floating-point arithmetic is not used.
- The first rule matches only normalized document reference, identical currency and exactly opposite signed values. It never reuses a candidate, preventing accidental many-to-one matching.

### Verification (actual results)

- `pnpm --filter api test`: **6 files, 42 tests passed**.
- `pnpm --filter api build`: **passed**.
- `pnpm --filter api lint`: **passed**.

### Next slice

- Persist run inputs and match results, then implement controlled tolerance/date strategies with explicit rules versions and exception output. CSV transaction staging remains required before workers can execute this rule over real data.

## 2026-09-29 — Phase 4 match and exception persistence

### Delivered

- Added additive migration `20260929200000_add_matches_and_exceptions`.
- Every persisted match records its reconciliation run, deterministic rule code, currency, exact decimal variance, and one-or-more linked transaction IDs with a side marker.
- Added durable exceptions with organization/run scope, optional transaction linkage, currency-aware exposure, severity, state, assignee, due date and resolution timestamp.
- Added scoped indexes for open/high-severity exception workflows and run result history.

### Verification (actual results)

- `pnpm prisma validate`: **passed**.
- `pnpm prisma generate`: **passed**.
- `pnpm --filter api build`: **passed**.
- `pnpm --filter api test`: **6 files, 42 tests passed**.

### Next slice

- Add reconciliation-run APIs and transactional persistence for the deterministic matching output. CSV transaction staging is still required before real worker execution.
