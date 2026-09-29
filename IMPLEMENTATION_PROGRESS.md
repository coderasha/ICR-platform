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

## 2026-09-29 — Phase 4 reconciliation-run API

### Delivered

- Added organization-scoped `GET` and `POST /api/v1/organizations/:organizationId/reconciliation-runs` endpoints.
- Run creation validates organization access and active legal-entity ownership, rejects invalid reporting periods, and persists a supplied matching `rulesVersion` alongside a new `DRAFT` run.
- Run listing returns the legal-entity context and persisted match/exception counts without leaking another organization’s records.

### Verification (actual results)

- `pnpm --filter api build`: **passed**.
- `pnpm --filter api lint`: **passed**.
- `pnpm --filter api test`: **6 files, 42 tests passed**.

### Next slice

- Add run queue/execution persistence only after real transactions are staged. This prevents draft runs from presenting fabricated match results.

## 2026-09-29 — Quality gate repair

- Replaced the worker’s no-test failure with a focused lifecycle test for its durable `QUEUED`-only claim guard and wired that guard into the actual BullMQ worker.
- `pnpm test` now completes successfully across the workspace: **API 42 tests passed; worker 1 test passed**.
- `pnpm --filter worker typecheck`: **passed**.

## 2026-09-29 — Executable two-sided reconciliation

### Delivered

- Added the nullable, additive `counterpart_legal_entity_id` field and composite tenant-scoped foreign key in migration `20260929203000_add_run_counterpart_entity`. Existing historical draft runs remain readable; new runs created through the application require both active legal entities.
- Reconciliation run creation now validates both entities belong to the selected organization, are active, and are distinct. Run history returns both entity contexts.
- Added `POST /api/v1/organizations/:organizationId/reconciliation-runs/:id/queue`. Only `DRAFT` or `FAILED` two-sided runs can be queued; failed queue submission is durably recorded as `FAILED` rather than leaving a misleading state.
- The worker now consumes an independent `icr-reconciliation` queue. It claims only durable `QUEUED` runs and executes the exact-reference, same-currency, opposite-decimal rule inside a PostgreSQL serializable transaction.
- Execution writes auditable match records and primary/counterpart match items, creates `MISSING_COUNTERPART` exceptions for every unmatched transaction, updates transaction statuses, stores an input fingerprint and records accurate run counters/final status. Decimal comparisons use fixed six-place `bigint` values—never JavaScript floating point.
- Updated `/reconciliation` to require primary and counterpart legal-entity selection, show both entities in history, and provide a queue action only for executable draft/failed runs.

### Verification (actual results)

- `pnpm prisma validate` and `pnpm prisma generate`: **passed**.
- `pnpm --filter api test`: **10 files, 50 tests passed**.
- `pnpm --filter worker test`: **3 files, 5 tests passed** (including fixed-decimal/no-reuse reconciliation behavior).
- API build/lint, worker typecheck/lint, and web lint/direct TypeScript validation: **passed**.

### Current constraints before production release

- The execution worker currently supports the shipped `exact-reference-v1` strategy only. Tolerance/date-window/many-to-many rules need explicit versioned implementations and test vectors before being enabled.
- Imported transactions are deliberately terminally marked `MATCHED` or `EXCEPTION`; reversing/re-running financial outcomes needs an explicit controlled remediation workflow rather than mutating history.
- Object storage is still a local development adapter, and end-to-end worker/database/Redis tests, audit events, approval/assignment UI, exports, monitoring/alerting and deployment infrastructure remain release work.

## 2026-09-29 — Audit evidence foundation

### Delivered

- Added additive migration `20260929204500_add_audit_events` and an append-only, organization-scoped `AuditEvent` model. It captures actor (when a user initiates an action), action, entity identity, before/after JSON evidence, bounded metadata and timestamp; application code exposes no update or delete operation for audit records.
- Added a permission-protected `GET /api/v1/organizations/:organizationId/audit-events` endpoint. It applies the same tenant non-enumeration rules as other organization resources, returns the newest 200 records and includes actor display context.
- Reconciliation run creation and queueing record actor-attributed evidence. Exception assignment/status changes record their prior and resulting state. The worker records completed and failed reconciliation outcomes within/alongside its durable run handling, including counters, deterministic fingerprint and rule version.
- `audit:read` was already present in the idempotent RBAC seed and is granted to platform/org administrators and the auditor role.

### Verification (actual results)

- `pnpm prisma validate` and `pnpm prisma generate`: **passed**.
- API tests/build/lint: **50 tests passed; build and lint passed**.
- Worker tests/typecheck/lint: **5 tests passed; typecheck and lint passed**.
- Web lint/direct TypeScript validation and root `pnpm test`: **passed**.

### Remaining audit work

- Audit coverage is currently focused on reconciliation and exception operations. Import, master-data, role-management and authentication events should be added before a regulated production release.
- The first audit reader is an authorized API; a dedicated filterable audit UI and retained/exportable compliance archive remain future work.

## 2026-09-29 — Audit workspace

- Added `/audit`, a permission-aware audit-history workspace linked from the dashboard navigation. It loads only authorized organizations, handles expired sessions, communicates access denial separately from empty history, and presents the latest event timestamp, action, actor/system-worker identity, entity and before/after evidence.
- The page calls the organization-scoped audit endpoint with the HttpOnly cookie session; it persists neither event data nor credentials in browser storage.
- Web lint and direct TypeScript validation, API tests/build, and worker typecheck/tests: **passed**.

## 2026-09-29 — Operational readiness endpoints

- Added `GET /api/v1/health` for liveness and `GET /api/v1/ready` for database-backed readiness.
- Readiness does a minimal database probe and returns a generic 503 on failure, without infrastructure host, credential, or driver-error disclosure.
- Added healthy/unavailable unit coverage.
- `pnpm test`: **passed** across the workspace (**API 44 tests; worker 1 test**).
- `pnpm --filter api build` and `pnpm --filter api lint`: **passed**.

## 2026-09-29 — Browser-session CSRF hardening

- Cookie-authenticated `POST`, `PATCH`, `PUT`, and `DELETE` requests now require the configured `WEB_ORIGIN`. This protects the browser session path from cross-origin state changes.
- Bearer-token clients remain supported and do not require a browser `Origin` header.
- Added negative cross-origin and positive Bearer compatibility coverage.
- `pnpm test`: **passed** across the workspace (**API 46 tests; worker 1 test**).
- `pnpm --filter api build` and `pnpm --filter api lint`: **passed**.

## 2026-09-29 — Reconciliation run workspace

- Added `/reconciliation`, an API-connected organization selector, draft-run form, and persisted run-history table.
- The UI limits creation to active legal entities and clearly labels draft runs as non-executed until normalized transaction staging is available.
- `pnpm --filter web lint` and `pnpm --filter web exec tsc --noEmit`: **passed**.

## 2026-09-29 — CSV normalization kernel

- Added a deterministic CSV parser and canonical transaction-row normalizer to the worker.
- It handles quoted CSV values, preserves financial amounts as decimal strings, normalizes currency codes, and reports actionable errors with original row numbers.
- Validation rejects absent source keys, invalid ISO dates, non-ISO currencies, and amounts exceeding six decimal places.
- `pnpm test`: **passed** across the workspace (**API 46 tests; worker 4 tests**).
- `pnpm --filter worker typecheck`: **passed**.

### Next slice

- Connect secure object storage to this parser, persist `ImportRow` validation output in bounded batches, then create normalized transactions transactionally. No upload is yet represented as a completed import.

## 2026-09-29 — Storage boundary

- Added a local-development storage adapter behind a dedicated service boundary. It generates opaque import keys, never accepts a caller-provided filesystem path, rejects empty content, prevents traversal, and returns a SHA-256 integrity hash.
- The adapter is suitable for local development; production object-store configuration remains a required deployment implementation rather than an assumed capability.
- `pnpm --filter api test`: **9 files, 48 tests passed**.
- `pnpm --filter api build` and `pnpm --filter api lint`: **passed**.

## 2026-09-29 — Authenticated CSV upload staging

- Added `POST /api/v1/organizations/:organizationId/imports/upload` for staged CSV uploads.
- The endpoint applies a 10 MB decoded-content limit, only accepts CSV, verifies organization access before storage, and generates the storage key and SHA-256 integrity hash on the server.
- It persists a durable draft batch only after staging storage content; callers cannot select arbitrary filesystem paths or assert a false hash.
- `pnpm --filter api build`, `pnpm --filter api lint`, and `pnpm --filter api test` (**48 tests**) all passed.

### Next slice

- Wire stored CSV content through the worker normalizer and persist its row-level results in bounded batches. Add cleanup handling for orphaned local objects when downstream database validation fails.

## 2026-09-29 — Worker CSV validation staging

- The `icr-imports` worker now reads staged CSV content through the guarded storage-root path, normalizes it, and persists row-level raw data, normalized output, validation errors and `VALID`/`REJECTED` states.
- Import batches receive persisted total/valid/rejected counts. At this point the worker deliberately records `FAILED` after validation staging because normalized transactions are not yet persisted; it never labels staged rows as a completed financial import.
- CSV/read failures produce bounded, durable failure reasons.
- `pnpm --filter worker typecheck` and `pnpm --filter worker test` (**4 tests**) passed.

### Next slice

- Transactionally create normalized `Transaction` records from valid staged rows, handling duplicate source-record keys and preserving rejected rows. Only then may a batch reach a completed import status.

## 2026-09-29 — Transactional normalized import

- Valid normalized CSV rows are now persisted as organization-scoped `Transaction` records inside a database transaction.
- The worker detects both repeated keys within a file and existing organization source-record keys. It never overwrites prior source records.
- Fully successful batches transition to `COMPLETED`; row validation or duplicate conditions yield `COMPLETED_WITH_ERRORS` with accurate imported/valid/rejected counts and a durable reason.
- Rows become `IMPORTED` only when every valid row in that batch was persisted, avoiding a misleading all-imported marker in partial outcomes.
- `pnpm test`: **passed** across the workspace (**API 48 tests; worker 4 tests**); worker typecheck passed.

### Next slice

- Add API/UI import history and row-error review, then queue reconciliation runs over these persisted transactions.

## 2026-09-29 — Import review workspace

- Added `/imports`, an API-connected CSV staging and batch-history workspace.
- Users select an authorized organization and active legal entity, stage a CSV subject to the server-enforced 10 MB limit, and review persisted status/count/error outcomes.
- The UI explicitly states that upload/staging is not a completed import.
- `pnpm --filter web lint` and `pnpm --filter web exec tsc --noEmit`: **passed**.

## 2026-09-29 — Import queue controls

- Refactored the import-history workspace to provide per-batch Queue actions for eligible `DRAFT`/`FAILED` batches.
- Queueing shows an in-flight state and refreshes persisted history only after the API confirms the transition.
- Improved client-side base64 conversion to avoid an unbounded function-argument spread for allowed upload sizes.
- `pnpm --filter web lint` and `pnpm --filter web exec tsc --noEmit`: **passed**.

## 2026-09-29 — Operational documentation and correlation

- Added a validated `X-Request-Id` response header for API request correlation; clients may supply a constrained ID or receive a generated UUID.
- Added [docs/OPERATIONS.md](docs/OPERATIONS.md) covering local services, additive migrations, health/readiness, production configuration boundaries, backups and recovery.
- `pnpm --filter api build`, `pnpm --filter api lint`, and workspace `pnpm test` all passed (**API 48 tests; worker 4 tests**).

## 2026-09-29 — Exceptions workflow API

- Added organization-scoped exception listing and update endpoints.
- Listing includes legal-entity, run and related transaction context for investigation without cross-tenant leakage.
- Assignment and controlled state transitions are server-enforced: `PROPOSED → APPROVED → RESOLVED`; direct resolution is rejected.
- `pnpm --filter api build`, `pnpm --filter api lint`, and `pnpm --filter api test` (**48 tests**) passed.

## 2026-09-29 — Exceptions workflow test coverage

- Added focused regression tests proving inaccessible organization exceptions are not disclosed and an exception cannot resolve before approval.
- `pnpm --filter api test`: **10 files, 50 tests passed**.
- `pnpm --filter api build` and `pnpm --filter api lint`: **passed**.

## 2026-09-29 — Workspace navigation

- Added real sidebar routes for the implemented Reconciliation, Data Management/Imports, and Master Data workspaces.
- `pnpm --filter web lint` and `pnpm --filter web exec tsc --noEmit`: **passed**.

## 2026-09-29 — Exceptions workspace

- Added `/exceptions`, an API-connected investigation list with organization scope, severity/status, financial exposure, legal entity, run context and durable descriptions.
- The UI presents Resolve only for `APPROVED` exceptions; server-side lifecycle enforcement remains authoritative.
- Added the Exceptions route to the main application navigation.
- `pnpm --filter web lint` and `pnpm --filter web exec tsc --noEmit`: **passed**.

## 2026-09-29 — Transaction ledger API

- Added `GET /api/v1/organizations/:organizationId/transactions` with organization access enforcement, server pagination (1–100 rows), legal-entity filtering and document-reference search.
- Queries use a transactionally consistent items/count response and include legal-entity context while retaining precise database decimal values.
- `pnpm --filter api build`, `pnpm --filter api lint`, and `pnpm --filter api test` (**50 tests**) passed.

## 2026-09-29 — Transaction ledger workspace

- Added `/transactions`, an API-connected transaction ledger with organization selection, reference search, server paging, currency-aware string amount display, entity context and status.
- Added Transactions to application navigation.
- Refactored the paginated loader to eliminate the exhaustive-deps warning without weakening lint rules. Web lint and TypeScript validation pass cleanly.
