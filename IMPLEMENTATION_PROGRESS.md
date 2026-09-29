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

- Add edit/deactivation actions to the master-data UI, then begin the additive source-import and transaction persistence schema. Financial data, reconciliation runs and reporting are not yet implemented.
