# ICR Platform operations

## Local services

Copy `.env.example` to `.env`, replace every placeholder secret, then start PostgreSQL, Redis and MinIO with `docker compose up -d`. The compose ports bind only to loopback by default.

Run `pnpm prisma migrate deploy` before starting the API or worker against a database that has not received the current migrations. Do not use `prisma migrate reset` outside a disposable local environment.

Start the API and worker separately so import/reconciliation work does not consume API request capacity:

```sh
pnpm --filter api start:dev
pnpm --filter worker dev
pnpm --filter web dev
```

The API exposes `/api/v1/health` for liveness and `/api/v1/ready` for PostgreSQL readiness. Every response has an `X-Request-Id`; retain it in reverse-proxy and application logs when investigating a request.

## Production configuration

Set strong unique values for database, Redis, MinIO and JWT secrets. Set `WEB_ORIGIN` to the exact web application origin. Set `LOCAL_STORAGE_ROOT` only for local development; production uploads require a non-public object-storage adapter before deployment.

The current development storage adapter writes to local disk. It is not a substitute for durable, encrypted object storage or a retention policy in production.

## Backup and recovery

Back up PostgreSQL with `pg_dump` on a tested schedule and keep an independently encrypted copy of imported source files/object storage. Restore first to an isolated environment, apply the exact application migrations, validate row counts and import hashes, then promote only after finance-owner approval.

Never delete import batches, transactions, reconciliation runs, match records, or exceptions to fix a workflow issue. Use a new batch/run and retain the earlier record for auditability.
