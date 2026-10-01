# ICR Platform

ICR Platform is a tenant-scoped intercompany reconciliation workspace: CSV import staging, deterministic two-sided reconciliation, exception investigation, close-period controls, audit history, controlled exports and organization administration.

## Local start

1. Copy `.env.example` to `.env` and replace all placeholder secrets.
2. Start dependencies: `docker compose up -d`.
3. Apply schema changes: `pnpm prisma migrate deploy`.
4. Seed RBAC roles and a development-only demo organization/account:

   ```sh
   pnpm --filter api exec node scripts/seed-rbac.mjs
   pnpm --filter api exec node scripts/seed-local-demo.mjs
   ```

   The local login page offers platform administrator, organization administrator, analyst, reviewer, approver, and auditor personas. Each is seeded with the password `local-development-only`; set `DEV_PASSWORD` before running the seed to override the local-only password.
5. Start the API, worker and web application in separate terminals:

   ```sh
   pnpm --filter api start:dev
   pnpm --filter worker dev
   pnpm --filter web dev
   ```

Use `pnpm test` for the full API and worker suite. See [operations guidance](docs/OPERATIONS.md) for readiness, production storage, recovery and deployment boundaries.
