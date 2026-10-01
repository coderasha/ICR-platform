# Run ICR Platform locally

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker and Docker Compose

## First-time setup

From the repository root:

```sh
cp .env.example .env
pnpm install
docker compose up -d
pnpm prisma migrate deploy
pnpm prisma generate
pnpm --filter api exec node scripts/seed-rbac.mjs
pnpm --filter api exec node scripts/seed-local-demo.mjs
```

Replace the placeholder secrets in `.env` before sharing or deploying the environment. The compose stack starts PostgreSQL, Redis, and a local S3-compatible test service.

## Start the application

Open three terminals in the repository root:

```sh
pnpm --filter api start:dev
```

```sh
pnpm --filter worker dev
```

```sh
pnpm --filter web dev
```

Open http://localhost:3000.

The development seed creates these persona accounts. Each uses the password `local-development-only`:

```text
platform.admin@icr.local — Platform administrator
org.admin@icr.local      — Organization administrator
analyst@icr.local        — Reconciliation analyst
reviewer@icr.local       — Reconciliation reviewer
approver@icr.local       — Approver
auditor@icr.local        — Auditor
```

In development, the login page presents these as selectable personas and signs in directly after selection. Set `DEV_PASSWORD` before running `seed-local-demo.mjs` to change the shared local-only password. The script refuses to run when `NODE_ENV=production`.

## Verification

```sh
pnpm test
pnpm --filter web build
pnpm prisma migrate status
```

The API liveness endpoint is http://localhost:3003/api/v1/health and the readiness endpoint is http://localhost:3003/api/v1/ready.

## Stop local dependencies

```sh
docker compose down
```

This stops containers but preserves local Docker volumes. To remove the local database, Redis, and S3 test data as well:

```sh
docker compose down --volumes
```
